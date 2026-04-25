import { createClient } from 'jsr:@supabase/supabase-js@2';

interface InvitePayload {
  email: string;
  role: 'admin' | 'manager' | 'view_only';
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
    const callerRole = callerUser.app_metadata?.role as string | undefined;
    if (callerRole !== 'admin') {
      return errorResponse(403, 'Only admins can invite users');
    }

    // ── 3. Parse and validate payload ────────────────────────────────────────
    let payload: InvitePayload;
    try {
      payload = (await req.json()) as InvitePayload;
    } catch {
      return errorResponse(400, 'Invalid JSON body');
    }

    const { email, role } = payload;
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

    // ── 4. Send the invite using the service role client ─────────────────────
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: inviteData, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(
      email,
      { data: {} }, // no user_metadata pre-populated
    );

    if (inviteError) {
      console.error('inviteUserByEmail error:', inviteError);
      return errorResponse(500, inviteError.message ?? 'Failed to send invite');
    }

    const invitedUserId = inviteData.user.id;

    // ── 5. Insert into user_roles ─────────────────────────────────────────────
    const { error: insertError } = await adminClient.from('user_roles').insert({
      user_id: invitedUserId,
      email: email.toLowerCase().trim(),
      role,
      invited_by: callerUser.id,
    });

    if (insertError) {
      // Attempt to clean up the orphaned auth user if role insert fails
      await adminClient.auth.admin.deleteUser(invitedUserId).catch(() => undefined);
      console.error('user_roles insert error:', insertError);
      return errorResponse(500, 'Invite sent but failed to record role. Please contact support.');
    }

    return new Response(JSON.stringify({ message: `Invite sent to ${email}` }), {
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
