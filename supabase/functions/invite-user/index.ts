import { createClient } from 'jsr:@supabase/supabase-js@2';

interface InvitePayload {
  email: string;
  role: 'admin' | 'manager' | 'view_only';
  first_name?: string;
  last_name?: string;
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  try {
    // ── 1. Authenticate the caller using their JWT ────────────────────────────
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return errorResponse(401, 'Missing Authorization header');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Anon client — used only to verify the caller's JWT claims
    const callerClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user: callerUser },
      error: callerError,
    } = await callerClient.auth.getUser();
    if (callerError || !callerUser) {
      return errorResponse(401, 'Invalid caller token');
    }

    // ── 2. Verify the caller is an admin ─────────────────────────────────────
    // Query user_roles directly — getUser() returns raw_app_meta_data from auth.users
    // which does NOT include claims injected by the custom_access_token_hook.
    const adminClientForAuth = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: callerUserRole } = await adminClientForAuth
      .from('user_roles')
      .select('role, is_active')
      .eq('user_id', callerUser.id)
      .maybeSingle();

    if (!callerUserRole?.is_active || callerUserRole?.role !== 'admin') {
      return errorResponse(403, 'Only admins can invite users');
    }

    // ── 3. Parse and validate payload ────────────────────────────────────────
    let payload: InvitePayload;
    try {
      payload = (await req.json()) as InvitePayload;
    } catch {
      return errorResponse(400, 'Invalid JSON body');
    }

    const { email, role, first_name, last_name } = payload;
    if (!email || typeof email !== 'string') {
      return errorResponse(400, 'email is required');
    }
    if (!['admin', 'manager', 'view_only'].includes(role)) {
      return errorResponse(400, 'role must be admin, manager, or view_only');
    }

    // Basic email format validation (no external library needed)
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(email)) {
      return errorResponse(400, 'Invalid email format');
    }

    // ── 4. Resolve or invite the user ────────────────────────────────────────
    // If the user already has an auth account (e.g. signed up via Google/OAuth),
    // inviteUserByEmail will fail. In that case, look up the existing user and
    // just assign them the role — no re-invite needed.
    let targetUserId: string;
    let wasInvited = true;

    const { data: inviteData, error: inviteError } =
      await adminClientForAuth.auth.admin.inviteUserByEmail(email, { data: {} });

    if (inviteError) {
      // "User already registered" — look up the existing user by email
      if (inviteError.message?.toLowerCase().includes('already')) {
        const { data: listData, error: listError } = await adminClientForAuth.auth.admin.listUsers({
          page: 1,
          perPage: 1000,
        });
        if (listError) {
          console.error('listUsers error:', listError);
          return errorResponse(500, listError.message ?? 'Failed to look up existing user');
        }
        const existing = listData?.users?.find(
          (u) => u.email?.toLowerCase() === email.toLowerCase(),
        );
        if (!existing) {
          return errorResponse(500, 'User already exists but could not be located');
        }
        targetUserId = existing.id;
        wasInvited = false;
      } else {
        console.error('inviteUserByEmail error:', inviteError);
        return errorResponse(500, inviteError.message ?? 'Failed to send invite');
      }
    } else {
      targetUserId = inviteData.user.id;
    }

    // ── 5. Upsert into user_roles ─────────────────────────────────────────────
    const { error: upsertError } = await adminClientForAuth.from('user_roles').upsert(
      {
        user_id: targetUserId,
        email: email.toLowerCase().trim(),
        role,
        first_name: first_name?.trim() ?? null,
        last_name: last_name?.trim() ?? null,
        invited_by: callerUser.id,
      },
      { onConflict: 'user_id' },
    );

    if (upsertError) {
      // If we just invited a fresh user, clean up the orphaned auth record
      if (wasInvited) {
        await adminClientForAuth.auth.admin.deleteUser(targetUserId).catch(() => undefined);
      }
      console.error('user_roles upsert error:', upsertError);
      return errorResponse(500, 'Failed to record role. Please contact support.');
    }

    const message = wasInvited ? `Invite sent to ${email}` : `Role assigned to ${email}`;
    return new Response(JSON.stringify({ message }), {
      status: 200,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Unexpected error:', err);
    return errorResponse(500, 'Internal server error');
  }
});

function errorResponse(status: number, message: string): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}
