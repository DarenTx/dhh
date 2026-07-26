import { createClient } from 'jsr:@supabase/supabase-js@2';

Deno.serve(async (req: Request) => {
  const WEBHOOK_SECRET = Deno.env.get('GMAIL_WEBHOOK_SECRET');
  if (WEBHOOK_SECRET) {
    const authHeader = req.headers.get('Authorization') ?? '';
    if (authHeader !== `Bearer ${WEBHOOK_SECRET}`) {
      return new Response('Unauthorized', { status: 401 });
    }
  }

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const GOOGLE_CLIENT_ID = Deno.env.get('GOOGLE_CLIENT_ID')!;
  const GOOGLE_CLIENT_SECRET = Deno.env.get('GOOGLE_CLIENT_SECRET')!;
  const GMAIL_PUBSUB_TOPIC = Deno.env.get('GMAIL_PUBSUB_TOPIC');

  const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: config } = await adminClient
    .from('gmail_config')
    .select('auth_status')
    .eq('id', 1)
    .single();

  if (!config || config.auth_status !== 'connected') {
    console.log('Gmail not connected, skipping watch renewal.');
    return new Response('ok', { status: 200 });
  }

  const { data: refreshToken, error: vaultError } = await adminClient.rpc('get_gmail_refresh_token');
  if (vaultError || !refreshToken) {
    await adminClient.from('gmail_config').update({ auth_status: 'reauth_required' }).eq('id', 1);
    console.error('Failed to retrieve refresh token:', vaultError);
    return new Response('ok', { status: 200 });
  }

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });

  if (!tokenRes.ok) {
    const err = await tokenRes.json() as { error?: string };
    if (err.error === 'invalid_grant') {
      await adminClient.from('gmail_config').update({ auth_status: 'reauth_required' }).eq('id', 1);
      console.error('Refresh token invalid — re-auth required');
    } else {
      console.error('Token refresh failed:', err);
    }
    return new Response('ok', { status: 200 });
  }

  const tokenData = await tokenRes.json() as { access_token?: string };
  const accessToken = tokenData.access_token;
  if (!accessToken) {
    console.error('No access token in response');
    return new Response('ok', { status: 200 });
  }

  if (!GMAIL_PUBSUB_TOPIC) {
    console.error('GMAIL_PUBSUB_TOPIC not configured');
    return new Response('ok', { status: 200 });
  }

  const watchRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/watch', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ labelIds: ['INBOX'], topicName: GMAIL_PUBSUB_TOPIC }),
  });

  if (!watchRes.ok) {
    console.error('Gmail watch() renewal failed:', await watchRes.text());
    return new Response('ok', { status: 200 });
  }

  const watchData = await watchRes.json() as { historyId?: string; expiration?: string };
  console.log(`Watch renewed. historyId=${watchData.historyId}, expiration=${watchData.expiration}`);

  await adminClient
    .from('gmail_config')
    .update({
      last_token_refresh_at: new Date().toISOString(),
      ...(watchData.historyId ? { last_history_id: watchData.historyId } : {}),
    })
    .eq('id', 1);

  return new Response('ok', { status: 200 });
});
