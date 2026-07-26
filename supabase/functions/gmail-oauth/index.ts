import { createClient } from 'jsr:@supabase/supabase-js@2';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  if (req.method !== 'POST') return errorResponse(405, 'Method not allowed');

  const GOOGLE_CLIENT_ID = Deno.env.get('GOOGLE_CLIENT_ID');
  const GOOGLE_CLIENT_SECRET = Deno.env.get('GOOGLE_CLIENT_SECRET');
  const GMAIL_PUBSUB_TOPIC = Deno.env.get('GMAIL_PUBSUB_TOPIC');
  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    return errorResponse(500, 'Missing Google OAuth configuration (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET)');
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return errorResponse(401, 'Missing Authorization header');

  const callerClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: { user }, error: userError } = await callerClient.auth.getUser();
  if (userError || !user) return errorResponse(401, 'Invalid token');

  const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: roleData } = await adminClient
    .from('user_roles')
    .select('role, is_active')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!roleData?.is_active || !['admin', 'manager'].includes(roleData?.role ?? '')) {
    return errorResponse(403, 'Only active admins or managers can manage Gmail settings');
  }

  let body: { action: string; code?: string; redirect_uri?: string };
  try {
    body = await req.json();
  } catch {
    return errorResponse(400, 'Invalid JSON body');
  }

  // -- Action: get_auth_url --------------------------------------------------
  if (body.action === 'get_auth_url') {
    if (!body.redirect_uri) return errorResponse(400, 'Missing redirect_uri');
    const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    url.searchParams.set('client_id', GOOGLE_CLIENT_ID);
    url.searchParams.set('redirect_uri', body.redirect_uri);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', 'https://www.googleapis.com/auth/gmail.modify');
    url.searchParams.set('access_type', 'offline');
    url.searchParams.set('prompt', 'consent');
    url.searchParams.set('state', 'gmail_oauth');
    return jsonResponse({ url: url.toString() });
  }

  // -- Action: exchange_code -------------------------------------------------
  if (body.action === 'exchange_code') {
    if (!body.code || !body.redirect_uri) {
      return errorResponse(400, 'Missing code or redirect_uri');
    }

    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code: body.code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: body.redirect_uri,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenRes.ok) {
      console.error('Token exchange failed:', await tokenRes.text());
      return errorResponse(400, 'Failed to exchange authorization code');
    }

    const tokens = await tokenRes.json() as {
      access_token?: string;
      refresh_token?: string;
      error?: string;
      error_description?: string;
    };

    if (tokens.error || !tokens.refresh_token || !tokens.access_token) {
      return errorResponse(400, tokens.error_description ?? tokens.error ?? 'No refresh token returned.');
    }

    const { error: vaultError } = await adminClient.rpc('upsert_gmail_refresh_token', {
      p_token: tokens.refresh_token,
    });
    if (vaultError) {
      console.error('Vault write failed:', vaultError);
      return errorResponse(500, 'Failed to store credentials');
    }

    let initialHistoryId: string | null = null;
    if (GMAIL_PUBSUB_TOPIC) {
      const watchRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/watch', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${tokens.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ labelIds: ['INBOX'], topicName: GMAIL_PUBSUB_TOPIC }),
      });
      if (watchRes.ok) {
        const watchData = await watchRes.json() as { historyId: string };
        initialHistoryId = watchData.historyId;
      } else {
        console.warn('Gmail watch() setup failed:', await watchRes.text());
      }
    }

    const now = new Date().toISOString();
    const { error: configError } = await adminClient
      .from('gmail_config')
      .update({
        auth_status: 'connected',
        owner_user_id: user.id,
        connected_at: now,
        last_token_refresh_at: now,
        ...(initialHistoryId ? { last_history_id: initialHistoryId } : {}),
      })
      .eq('id', 1);

    if (configError) {
      console.error('Config update failed:', configError);
      return errorResponse(500, 'Failed to update connection status');
    }

    return jsonResponse({ success: true, watch_configured: !!initialHistoryId });
  }

  // -- Action: disconnect ----------------------------------------------------
  if (body.action === 'disconnect') {
    await adminClient
      .from('gmail_config')
      .update({ auth_status: 'disconnected', last_history_id: null })
      .eq('id', 1);
    return jsonResponse({ success: true });
  }

  return errorResponse(400, `Unknown action: ${body.action}`);
});

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

function errorResponse(status: number, message: string): Response {
  return jsonResponse({ error: message }, status);
}
