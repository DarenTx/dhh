import { createClient } from 'jsr:@supabase/supabase-js@2';

const CONFIDENCE_THRESHOLD = 0.75;
const MAX_RETRY_COUNT = 5;
const MAX_ATTACHMENT_BYTES = 20 * 1024 * 1024;
const MAX_BODY_CHARS = 2000;
// Process at most this many messages per invocation to stay within the 60s wall-clock timeout.
// Each message takes ~3-5s (Gemini call + Gmail API). 10 messages ≈ 30-50s — safe margin.
const BATCH_SIZE = 10;

const SUPPORTED_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/heic',
  'image/heif',
];

interface GmailPart {
  mimeType: string;
  filename?: string;
  headers?: { name: string; value: string }[];
  body?: { attachmentId?: string; data?: string; size?: number };
  parts?: GmailPart[];
}

interface Property {
  id: string;
  address_line1: string;
}

interface AllowListEntry {
  pattern: string;
}

Deno.serve(async (req: Request) => {
  // Accept either GMAIL_WEBHOOK_SECRET (Pub/Sub external calls) or
  // SUPABASE_SERVICE_ROLE_KEY (internal function-to-function calls)
  const SUPABASE_SERVICE_ROLE_KEY_CHECK = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const WEBHOOK_SECRET = Deno.env.get('GMAIL_WEBHOOK_SECRET');
  const authHeader = req.headers.get('Authorization') ?? '';
  const validTokens = [
    `Bearer ${SUPABASE_SERVICE_ROLE_KEY_CHECK}`,
    ...(WEBHOOK_SECRET ? [`Bearer ${WEBHOOK_SECRET}`] : []),
  ];
  if (!validTokens.includes(authHeader)) {
    return new Response('Unauthorized', { status: 401 });
  }

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const GOOGLE_CLIENT_ID = Deno.env.get('GOOGLE_CLIENT_ID')!;
  const GOOGLE_CLIENT_SECRET = Deno.env.get('GOOGLE_CLIENT_SECRET')!;
  const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY')!;
  const GEMINI_MODEL = Deno.env.get('GEMINI_MODEL') ?? 'gemini-2.5-flash';
  const ALERT_EMAIL = Deno.env.get('GMAIL_PROCESSOR_ALERT_EMAIL');

  const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: config } = await adminClient
    .from('gmail_config')
    .select('auth_status, owner_user_id, last_history_id')
    .eq('id', 1)
    .single();

  if (!config || config.auth_status !== 'connected') {
    console.log('Gmail not connected, skipping.');
    return new Response('ok', { status: 200 });
  }

  const { data: refreshToken } = await adminClient.rpc('get_gmail_refresh_token');
  if (!refreshToken) {
    await setAuthStatus(adminClient, 'reauth_required');
    return new Response('ok', { status: 200 });
  }

  const accessToken = await getAccessToken(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, refreshToken);
  if (!accessToken) {
    await setAuthStatus(adminClient, 'reauth_required');
    return new Response('ok', { status: 200 });
  }

  await adminClient
    .from('gmail_config')
    .update({ last_token_refresh_at: new Date().toISOString() })
    .eq('id', 1);

  const [allowListResult, propertiesResult, labelsResult] = await Promise.all([
    adminClient.from('gmail_allow_list').select('pattern').eq('is_active', true),
    adminClient.from('properties').select('id, address_line1').eq('is_active', true),
    fetchGmailLabels(accessToken),
  ]);

  const allowList: AllowListEntry[] = allowListResult.data ?? [];
  const properties: Property[] = propertiesResult.data ?? [];
  const labelCache = new Map<string, string>(
    labelsResult.map((l: { name: string; id: string }) => [l.name, l.id]),
  );

  let newHistoryId: string | null = null;
  try {
    const pubsubBody = (await req.json()) as { message?: { data?: string } };
    if (pubsubBody.message?.data) {
      const decoded = atob(pubsubBody.message.data.replace(/-/g, '+').replace(/_/g, '/'));
      const notification = JSON.parse(decoded) as { historyId?: string };
      newHistoryId = notification.historyId ?? null;
    }
  } catch {
    /* not a Pub/Sub request */
  }

  const newMessageIds: string[] = [];

  if (config.last_history_id && newHistoryId) {
    let pageToken: string | undefined;
    do {
      const url = new URL('https://gmail.googleapis.com/gmail/v1/users/me/history');
      url.searchParams.set('startHistoryId', config.last_history_id);
      url.searchParams.set('historyTypes', 'messageAdded');
      if (pageToken) url.searchParams.set('pageToken', pageToken);

      const histRes = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!histRes.ok) break;

      const histData = (await histRes.json()) as {
        history?: { messagesAdded?: { message: { id: string } }[] }[];
        nextPageToken?: string;
      };

      for (const record of histData.history ?? []) {
        for (const added of record.messagesAdded ?? []) {
          if (!newMessageIds.includes(added.message.id)) newMessageIds.push(added.message.id);
        }
      }
      pageToken = histData.nextPageToken;
    } while (pageToken);

    await adminClient.from('gmail_config').update({ last_history_id: newHistoryId }).eq('id', 1);
  }

  const { data: retryRows } = await adminClient
    .from('gmail_processed_messages')
    .select('message_id')
    .eq('status', 'error')
    .lt('retry_count', MAX_RETRY_COUNT)
    .limit(BATCH_SIZE);

  const retryIds = (retryRows ?? []).map((r: { message_id: string }) => r.message_id);
  const allIds = [...new Set([...newMessageIds, ...retryIds])].slice(0, BATCH_SIZE);

  const failedMessageIds: string[] = [];

  for (const msgId of allIds) {
    try {
      await processMessage({
        msgId,
        accessToken,
        adminClient,
        allowList,
        properties,
        labelCache,
        config,
        GEMINI_API_KEY,
        GEMINI_MODEL,
      });
    } catch (err) {
      console.error(`Unhandled error for message ${msgId}:`, err);
      failedMessageIds.push(msgId);
    }
  }

  if (ALERT_EMAIL && failedMessageIds.length > 0) {
    const { data: permFailed } = await adminClient
      .from('gmail_processed_messages')
      .select('message_id')
      .eq('status', 'permanently_failed')
      .in('message_id', failedMessageIds);
    if ((permFailed ?? []).length > 0) {
      console.warn(
        `ALERT: ${permFailed!.length} messages permanently failed. Alert to: ${ALERT_EMAIL}`,
      );
    }
  }

  // Self-chain: if there are still messages to process, fire another invocation
  // so the queue drains without needing the browser to stay open.
  const { count: remaining } = await adminClient
    .from('gmail_processed_messages')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'error')
    .lt('retry_count', MAX_RETRY_COUNT);

  if ((remaining ?? 0) > 0) {
    console.log(`${remaining} messages remaining — firing next batch.`);
    fetch(`${SUPABASE_URL}/functions/v1/process-gmail`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: '{}',
    }).catch(() => {});
  }

  return new Response('ok', { status: 200 });
});

interface ProcessCtx {
  msgId: string;
  accessToken: string;
  adminClient: ReturnType<typeof createClient>;
  allowList: AllowListEntry[];
  properties: Property[];
  labelCache: Map<string, string>;
  config: { owner_user_id: string };
  GEMINI_API_KEY: string;
  GEMINI_MODEL: string;
}

async function processMessage(ctx: ProcessCtx): Promise<void> {
  const { msgId, accessToken, adminClient } = ctx;

  await adminClient
    .from('gmail_processed_messages')
    .upsert(
      { message_id: msgId, status: 'processing', processed_at: new Date().toISOString() },
      { onConflict: 'message_id', ignoreDuplicates: false },
    );

  const { data: existing } = await adminClient
    .from('gmail_processed_messages')
    .select('status')
    .eq('message_id', msgId)
    .single();
  if (
    ['completed', 'skipped_no_match', 'skipped_not_allowed', 'permanently_failed'].includes(
      existing?.status ?? '',
    )
  )
    return;

  const msgRes = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msgId}?format=full`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (!msgRes.ok) {
    await updateStatus(adminClient, msgId, 'error', 'Failed to fetch message');
    return;
  }

  const msg = (await msgRes.json()) as { payload?: GmailPart };
  if (!msg.payload) {
    await updateStatus(adminClient, msgId, 'skipped_no_match', null);
    return;
  }

  const fromHeader = msg.payload.headers?.find((h) => h.name.toLowerCase() === 'from')?.value ?? '';
  const fromEmail = extractEmail(fromHeader);

  if (!matchesAllowList(fromEmail, ctx.allowList)) {
    await updateStatus(adminClient, msgId, 'skipped_not_allowed', null);
    return;
  }

  const { attachments, textContent } = extractParts(msg.payload);
  const matchedPropertyIds: string[] = [];

  if (attachments.length > 0) {
    for (const part of attachments) {
      const matched = await processAttachment(part, msgId, ctx);
      if (matched) matchedPropertyIds.push(matched);
    }
  } else {
    const subject =
      msg.payload.headers?.find((h) => h.name.toLowerCase() === 'subject')?.value ?? '';
    const text = `Subject: ${subject}\n\n${textContent.trim().slice(0, MAX_BODY_CHARS)}`;
    if (text.trim()) {
      const propertyId = await classifyText(
        text,
        ctx.properties,
        ctx.GEMINI_API_KEY,
        ctx.GEMINI_MODEL,
      );
      if (propertyId) matchedPropertyIds.push(propertyId);
    }
  }

  for (const propId of matchedPropertyIds) {
    const prop = ctx.properties.find((p) => p.id === propId);
    if (prop)
      await ensureAndApplyLabel(
        msgId,
        `Properties/${prop.address_line1}`,
        accessToken,
        ctx.labelCache,
      );
  }

  const finalStatus = matchedPropertyIds.length > 0 ? 'completed' : 'skipped_no_match';
  await adminClient
    .from('gmail_processed_messages')
    .update({
      status: finalStatus,
      matched_property_ids: matchedPropertyIds,
      processed_at: new Date().toISOString(),
      error_detail: null,
    })
    .eq('message_id', msgId);
}

async function processAttachment(
  part: GmailPart,
  msgId: string,
  ctx: ProcessCtx,
): Promise<string | null> {
  const { accessToken, adminClient, properties, config, GEMINI_API_KEY, GEMINI_MODEL } = ctx;

  if (!SUPPORTED_MIME_TYPES.includes(part.mimeType)) return null;
  if ((part.body?.size ?? 0) > MAX_ATTACHMENT_BYTES) return null;
  const attachmentId = part.body?.attachmentId;
  if (!attachmentId) return null;

  const attachRes = await fetchWithBackoff(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msgId}/attachments/${attachmentId}`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (!attachRes.ok) return null;

  const attachData = (await attachRes.json()) as { data?: string };
  if (!attachData.data) return null;

  // Convert URL-safe base64 to standard base64 (string op only — no decoding yet)
  const base64Standard = attachData.data.replace(/-/g, '+').replace(/_/g, '/');
  const safeName = (part.filename ?? 'attachment').replace(/[^a-zA-Z0-9._-]/g, '_');

  // Classify with Gemini FIRST — only decode+upload if we have a confirmed match.
  // This avoids crashing on large files when there's no property match (the common case).
  const result = await classifyFile(
    base64Standard,
    part.mimeType,
    properties,
    GEMINI_API_KEY,
    GEMINI_MODEL,
  );
  if (!result || result.confidence < CONFIDENCE_THRESHOLD || !result.property_id) {
    return null;
  }

  // Confirmed match — decode binary and upload directly to final path.
  // Buffer.from() is a native operation; avoids the character-by-character loop
  // that crashes the Deno runtime on large files.
  const padded = base64Standard + '='.repeat((4 - (base64Standard.length % 4)) % 4);
  // deno-lint-ignore no-explicit-any
  const uint8 = (globalThis as any).Buffer
    ? // deno-lint-ignore no-explicit-any
      new Uint8Array((globalThis as any).Buffer.from(padded, 'base64').buffer)
    : Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));

  const finalPath = `${result.property_id}/${msgId}-${safeName}`;
  const { error: uploadError } = await adminClient.storage
    .from('documents')
    .upload(finalPath, uint8, { contentType: part.mimeType, upsert: true });
  if (uploadError) {
    console.error('Upload failed:', uploadError);
    return null;
  }

  await adminClient.from('documents').upsert(
    {
      title: result.title ?? safeName,
      description: result.description ?? null,
      property_id: result.property_id,
      storage_path: finalPath,
      uploaded_by: config.owner_user_id,
    },
    { onConflict: 'storage_path', ignoreDuplicates: true },
  );

  return result.property_id;
}

function buildPropertyListText(properties: Property[]): string {
  return properties.map((p) => `  - id: ${p.id}, address: "${p.address_line1}"`).join('\n');
}

async function classifyFile(
  base64Data: string,
  mimeType: string,
  properties: Property[],
  apiKey: string,
  model: string,
) {
  const prompt = [
    'You are a document classifier for a real estate property management company.',
    'Analyze the attached file and return JSON only — no markdown, no code fences.',
    'Return this exact shape: { "title": string, "description": string, "property_id": string|null, "confidence_by_field": { "title": 0-1, "description": 0-1, "property_id": 0-1 }, "warnings": string[] }',
    'Rules: Choose the property id that best matches any address in the document. Return null if no confident single match. Return null if multiple properties match.',
    'Available properties:',
    buildPropertyListText(properties),
  ].join('\n');

  const raw = await callGemini(
    JSON.stringify({
      generationConfig: { responseMimeType: 'application/json', temperature: 0.1 },
      contents: [
        { role: 'user', parts: [{ text: prompt }, { inlineData: { mimeType, data: base64Data } }] },
      ],
    }),
    apiKey,
    model,
  );
  if (!raw) return null;

  try {
    const p = JSON.parse(raw) as {
      title?: string;
      description?: string;
      property_id?: string | null;
      confidence_by_field?: Record<string, number>;
    };
    return {
      property_id: p.property_id ?? null,
      title: p.title ?? null,
      description: p.description ?? null,
      confidence: p.confidence_by_field?.property_id ?? 0,
    };
  } catch {
    return null;
  }
}

async function classifyText(
  text: string,
  properties: Property[],
  apiKey: string,
  model: string,
): Promise<string | null> {
  const prompt = [
    'You are an email classifier for a real estate property management company.',
    'Analyze the email and return JSON only — no markdown. Shape: { "property_id": string|null, "confidence": number, "reasoning": string }',
    'Return null if no property is clearly referenced or if multiple properties match.',
    '--- EMAIL ---',
    text,
    '--- END EMAIL ---',
    'Available properties:',
    buildPropertyListText(properties),
  ].join('\n');

  const raw = await callGemini(
    JSON.stringify({
      generationConfig: { responseMimeType: 'application/json', temperature: 0.1 },
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
    }),
    apiKey,
    model,
  );
  if (!raw) return null;

  try {
    const p = JSON.parse(raw) as { property_id?: string | null; confidence?: number };
    return (p.confidence ?? 0) >= CONFIDENCE_THRESHOLD && p.property_id ? p.property_id : null;
  } catch {
    return null;
  }
}

async function callGemini(body: string, apiKey: string, model: string): Promise<string | null> {
  const MAX_RETRIES = 3;
  let response!: Response;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body },
    );
    if (response.status !== 429) break;
    let waitMs = Math.min(5_000 * 2 ** attempt, 60_000);
    try {
      const rb = await response.clone().json();
      const d = rb?.error?.details
        ?.find(
          (d: { '@type': string; retryDelay?: string }) =>
            d['@type'] === 'type.googleapis.com/google.rpc.RetryInfo',
        )
        ?.retryDelay?.replace('s', '');
      if (d) waitMs = Math.min(parseFloat(d) * 1_000 + 500, 65_000);
    } catch {
      /* ignore */
    }
    await new Promise((r) => setTimeout(r, waitMs));
  }
  if (!response.ok) {
    console.error('Gemini error:', response.status);
    return null;
  }
  const json = await response.json();
  return json?.candidates?.[0]?.content?.parts?.[0]?.text ?? null;
}

async function fetchGmailLabels(accessToken: string): Promise<{ name: string; id: string }[]> {
  const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/labels', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return [];
  const data = (await res.json()) as { labels?: { name: string; id: string }[] };
  return data.labels ?? [];
}

async function ensureAndApplyLabel(
  msgId: string,
  labelName: string,
  accessToken: string,
  cache: Map<string, string>,
): Promise<void> {
  let labelId = cache.get(labelName);
  if (!labelId) {
    const createRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/labels', {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: labelName }),
    });
    if (createRes.ok) {
      const created = (await createRes.json()) as { id: string; name: string };
      labelId = created.id;
      cache.set(labelName, labelId);
    } else {
      console.warn(`Failed to create label "${labelName}"`);
      return;
    }
  }
  await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${msgId}/modify`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ addLabelIds: [labelId] }),
  });
}

function extractParts(payload: GmailPart): { attachments: GmailPart[]; textContent: string } {
  const attachments: GmailPart[] = [];
  let textContent = '';
  function walk(part: GmailPart) {
    if (part.parts?.length) {
      for (const p of part.parts) walk(p);
      return;
    }
    const disp =
      part.headers?.find((h) => h.name.toLowerCase() === 'content-disposition')?.value ?? '';
    if (
      (disp.toLowerCase().startsWith('attachment') ||
        (!!part.filename && !disp.toLowerCase().startsWith('inline'))) &&
      part.body?.attachmentId &&
      part.filename
    ) {
      attachments.push(part);
    } else if (part.mimeType === 'text/plain' && part.body?.data) {
      textContent += atob(part.body.data.replace(/-/g, '+').replace(/_/g, '/'));
    }
  }
  if (!payload.parts && payload.body?.data && payload.mimeType === 'text/plain') {
    textContent = atob(payload.body.data.replace(/-/g, '+').replace(/_/g, '/'));
  } else {
    walk(payload);
  }
  return { attachments, textContent };
}

function extractEmail(fromHeader: string): string {
  const match = fromHeader.match(/<([^>]+)>/);
  return (match ? match[1] : fromHeader).trim().toLowerCase();
}

function matchesAllowList(email: string, allowList: AllowListEntry[]): boolean {
  for (const entry of allowList) {
    const p = entry.pattern.toLowerCase();
    if (p.includes('@')) {
      if (email === p) return true;
    } else {
      if (email.endsWith(`@${p}`) || email.endsWith(`.${p}`)) return true;
    }
  }
  return false;
}

async function getAccessToken(
  clientId: string,
  clientSecret: string,
  refreshToken: string,
): Promise<string | null> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { access_token?: string };
  return data.access_token ?? null;
}

async function fetchWithBackoff(url: string, options: RequestInit): Promise<Response> {
  let response!: Response;
  for (let attempt = 0; attempt < 3; attempt++) {
    response = await fetch(url, options);
    if (response.status !== 429) break;
    await new Promise((r) => setTimeout(r, Math.min(5_000 * 2 ** attempt, 30_000)));
  }
  return response;
}

async function updateStatus(
  adminClient: ReturnType<typeof createClient>,
  msgId: string,
  status: string,
  errorDetail: string | null,
): Promise<void> {
  if (status === 'error') {
    const { data: existing } = await adminClient
      .from('gmail_processed_messages')
      .select('retry_count')
      .eq('message_id', msgId)
      .single();
    const newRetryCount = (existing?.retry_count ?? 0) + 1;
    await adminClient
      .from('gmail_processed_messages')
      .update({
        status: newRetryCount >= MAX_RETRY_COUNT ? 'permanently_failed' : 'error',
        error_detail: errorDetail,
        retry_count: newRetryCount,
        last_error_at: new Date().toISOString(),
        processed_at: new Date().toISOString(),
      })
      .eq('message_id', msgId);
  } else {
    await adminClient
      .from('gmail_processed_messages')
      .update({ status, error_detail: null, processed_at: new Date().toISOString() })
      .eq('message_id', msgId);
  }
}

async function setAuthStatus(
  adminClient: ReturnType<typeof createClient>,
  status: string,
): Promise<void> {
  await adminClient.from('gmail_config').update({ auth_status: status }).eq('id', 1);
}
