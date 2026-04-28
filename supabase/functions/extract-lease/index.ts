import { createClient } from 'jsr:@supabase/supabase-js@2';

interface ExtractLeaseRequest {
  extraction_draft_id?: string;
  property_id: string;
  storage_bucket: string;
  storage_path: string;
  locale?: string;
  currency?: string;
}

interface LeaseExtractedFields {
  start_date: string | null;
  end_date: string | null;
  monthly_rent: number | null;
  security_deposit: number | null;
  status: 'active' | 'expired' | 'terminated' | null;
  property_address: string | null;
  tenants: Array<{
    first_name: string | null;
    last_name: string | null;
    phone: string | null;
    email: string | null;
  }>;
}

interface LeaseExtractionResponse {
  extraction_draft_id: string;
  extracted_fields: LeaseExtractedFields;
  confidence_by_field: Record<string, number>;
  missing_fields: string[];
  warnings: string[];
  provider_metadata: {
    provider: 'gemini';
    model: string;
    request_id?: string;
  };
  extraction_status: 'completed' | 'partial';
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ALLOWED_BUCKET = 'lease-documents';

Deno.serve(async (req: Request) => {
  // Read secrets inside the handler so updates take effect without redeployment
  const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
  const GEMINI_MODEL = Deno.env.get('GEMINI_MODEL') ?? 'gemini-2.5-flash';
  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  if (req.method !== 'POST') {
    return errorResponse(405, 'Method not allowed');
  }

  if (!GEMINI_API_KEY) {
    return errorResponse(500, 'Missing GEMINI_API_KEY configuration');
  }

  const startedAt = Date.now();

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return errorResponse(401, 'Missing Authorization header');
    }

    const callerClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user: callerUser },
      error: callerError,
    } = await callerClient.auth.getUser();

    if (callerError || !callerUser) {
      return errorResponse(401, 'Invalid caller token');
    }

    // Query user_roles directly — getUser() returns raw_app_meta_data from auth.users
    // which does NOT include claims injected by the custom_access_token_hook.
    const adminClientForAuth = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: userRole } = await adminClientForAuth
      .from('user_roles')
      .select('role, is_active')
      .eq('user_id', callerUser.id)
      .maybeSingle();

    if (!userRole?.is_active || !['admin', 'manager'].includes(userRole?.role ?? '')) {
      return errorResponse(403, 'Only active admins or managers can extract lease data');
    }

    let payload: ExtractLeaseRequest;
    try {
      payload = (await req.json()) as ExtractLeaseRequest;
    } catch {
      return errorResponse(400, 'Invalid JSON body');
    }

    const validationError = validatePayload(payload);
    if (validationError) {
      return errorResponse(400, validationError);
    }

    if (payload.storage_bucket !== ALLOWED_BUCKET) {
      return errorResponse(400, `storage_bucket must be ${ALLOWED_BUCKET}`);
    }

    if (!payload.storage_path.startsWith(`${payload.property_id}/`)) {
      return errorResponse(403, 'storage_path must belong to the specified property');
    }

    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const draftId = await ensureDraft(adminClient, {
      draftId: payload.extraction_draft_id,
      flowType: 'lease',
      propertyId: payload.property_id,
      storageBucket: payload.storage_bucket,
      storagePath: payload.storage_path,
      createdBy: callerUser.id,
    });

    if (!draftId) {
      return errorResponse(500, 'Failed to initialize extraction draft');
    }

    const { data: property, error: propertyError } = await adminClient
      .from('properties')
      .select('id')
      .eq('id', payload.property_id)
      .eq('is_active', true)
      .maybeSingle();

    if (propertyError) {
      return await failureResponse(
        adminClient,
        draftId,
        startedAt,
        'Failed to validate property access',
        500,
        GEMINI_MODEL,
        propertyError.message,
      );
    }
    if (!property) {
      return await failureResponse(
        adminClient,
        draftId,
        startedAt,
        'Property not found or not accessible',
        404,
        GEMINI_MODEL,
      );
    }

    const { data: fileBlob, error: downloadError } = await adminClient.storage
      .from(payload.storage_bucket)
      .download(payload.storage_path);

    if (downloadError || !fileBlob) {
      return await failureResponse(
        adminClient,
        draftId,
        startedAt,
        'Lease file not found in storage',
        404,
        GEMINI_MODEL,
        downloadError?.message,
      );
    }

    if (fileBlob.type !== 'application/pdf') {
      return await failureResponse(
        adminClient,
        draftId,
        startedAt,
        'Only PDF files are supported for lease extraction',
        400,
        GEMINI_MODEL,
      );
    }

    const bytes = new Uint8Array(await fileBlob.arrayBuffer());
    const base64 = toBase64(bytes);

    const prompt = [
      'Extract lease data from this PDF and return JSON only.',
      'Return this exact shape:',
      '{"start_date":"YYYY-MM-DD|null","end_date":"YYYY-MM-DD|null","monthly_rent":number|null,"security_deposit":number|null,"status":"active|expired|terminated|null","property_address":string|null,"tenants":[{"first_name":string|null,"last_name":string|null,"phone":string|null,"email":string|null}],"confidence_by_field":{"start_date":0-1,"end_date":0-1,"monthly_rent":0-1,"security_deposit":0-1,"status":0-1,"property_address":0-1,"tenant_name":0-1,"tenant_phone":0-1,"tenant_email":0-1},"warnings":string[]}',
      `Locale hint: ${payload.locale ?? 'en-US'}`,
      `Currency hint: ${payload.currency ?? 'USD'}`,
      'If uncertain, use null and lower confidence.',
    ].join('\n');

    const geminiRequestBody = JSON.stringify({
      generationConfig: { responseMimeType: 'application/json', temperature: 0.1 },
      contents: [
        {
          role: 'user',
          parts: [
            { text: prompt },
            {
              inlineData: {
                mimeType: 'application/pdf',
                data: base64,
              },
            },
          ],
        },
      ],
    });

    const MAX_RETRIES = 3;
    let geminiResponse!: Response;
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      geminiResponse = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: geminiRequestBody,
        },
      );

      if (geminiResponse.status !== 429) break;

      // Parse retryDelay from the response body when available, otherwise back off
      let waitMs = Math.min(5_000 * 2 ** attempt, 60_000);
      try {
        const rateLimitBody = await geminiResponse.clone().json();
        const retryDelaySec: number | undefined = rateLimitBody?.error?.details?.find(
          (d: { '@type': string; retryDelay?: string }) =>
            d['@type'] === 'type.googleapis.com/google.rpc.RetryInfo',
        )?.retryDelay?.replace('s', '');
        if (retryDelaySec) {
          waitMs = Math.min(parseFloat(retryDelaySec) * 1_000 + 500, 65_000);
        }
      } catch { /* ignore parse errors */ }

      console.warn(`Gemini 429 on attempt ${attempt + 1}; retrying in ${waitMs}ms`);
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }

    if (!geminiResponse.ok) {
      const details = await geminiResponse.text();
      console.error('Gemini extract-lease error:', details);
      const userMessage =
        geminiResponse.status === 429
          ? 'AI provider rate limit reached. Please wait a moment and try again.'
          : 'Failed to extract lease data via provider';
      return await failureResponse(
        adminClient,
        draftId,
        startedAt,
        userMessage,
        502,
        GEMINI_MODEL,
        details,
      );
    }

    const geminiJson = await geminiResponse.json();
    const outputText = extractResponseText(geminiJson);
    if (!outputText) {
      return await failureResponse(
        adminClient,
        draftId,
        startedAt,
        'Provider returned empty response',
        502,
        GEMINI_MODEL,
      );
    }

    let parsed: {
      start_date?: string | null;
      end_date?: string | null;
      monthly_rent?: number | null;
      security_deposit?: number | null;
      status?: 'active' | 'expired' | 'terminated' | null;
      property_address?: string | null;
      tenants?: Array<{
        first_name?: string | null;
        last_name?: string | null;
        phone?: string | null;
        email?: string | null;
      }>;
      confidence_by_field?: Record<string, number>;
      warnings?: string[];
    };

    try {
      parsed = JSON.parse(outputText);
    } catch {
      return await failureResponse(
        adminClient,
        draftId,
        startedAt,
        'Provider returned invalid JSON',
        502,
        GEMINI_MODEL,
      );
    }

    const extractedFields: LeaseExtractedFields = {
      start_date: normalizeDate(parsed.start_date),
      end_date: normalizeDate(parsed.end_date),
      monthly_rent: normalizeNumber(parsed.monthly_rent),
      security_deposit: normalizeNumber(parsed.security_deposit),
      status: normalizeStatus(parsed.status),
      property_address: normalizeString(parsed.property_address),
      tenants: normalizeTenants(parsed.tenants),
    };

    const confidenceByField = normalizeConfidence(parsed.confidence_by_field ?? {});
    const warnings = Array.isArray(parsed.warnings)
      ? parsed.warnings.filter((w) => typeof w === 'string')
      : [];
    const missingFields = Object.entries(extractedFields)
      .filter(([, value]) => value === null)
      .map(([field]) => field);

    const response: LeaseExtractionResponse = {
      extraction_draft_id: draftId,
      extracted_fields: extractedFields,
      confidence_by_field: confidenceByField,
      missing_fields: missingFields,
      warnings,
      provider_metadata: {
        provider: 'gemini',
        model: GEMINI_MODEL,
      },
      extraction_status: missingFields.length > 0 ? 'partial' : 'completed',
    };

    await adminClient
      .from('ai_extraction_drafts')
      .update({
        status: 'completed',
        extracted_data: extractedFields,
        confidence_data: confidenceByField,
        warnings,
        error_message: null,
      })
      .eq('id', draftId);

    await adminClient.from('ai_extraction_attempts').insert({
      draft_id: draftId,
      function_name: 'extract-lease',
      provider: 'gemini',
      model: GEMINI_MODEL,
      status: 'success',
      latency_ms: Date.now() - startedAt,
      response_payload: response,
    });

    try {
      await adminClient.rpc('run_ai_extraction_retention_cleanup');
    } catch {
      // Cleanup errors are non-fatal
    }

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('extract-lease unexpected error:', err);
    return errorResponse(500, 'Internal server error');
  }
});

async function ensureDraft(
  adminClient: ReturnType<typeof createClient>,
  input: {
    draftId?: string;
    flowType: 'lease';
    propertyId: string;
    storageBucket: string;
    storagePath: string;
    createdBy: string;
  },
): Promise<string | null> {
  if (input.draftId) {
    const { data, error } = await adminClient
      .from('ai_extraction_drafts')
      .update({
        storage_bucket: input.storageBucket,
        storage_path: input.storagePath,
        status: 'pending',
        error_message: null,
      })
      .eq('id', input.draftId)
      .eq('flow_type', input.flowType)
      .select('id')
      .maybeSingle();

    if (!error && data?.id) {
      return data.id as string;
    }
  }

  const { data, error } = await adminClient
    .from('ai_extraction_drafts')
    .insert({
      flow_type: input.flowType,
      property_id: input.propertyId,
      storage_bucket: input.storageBucket,
      storage_path: input.storagePath,
      status: 'pending',
      created_by: input.createdBy,
    })
    .select('id')
    .single();

  if (error) {
    console.error('Failed to create extraction draft:', error);
    return null;
  }

  return data.id as string;
}

async function failureResponse(
  adminClient: ReturnType<typeof createClient>,
  draftId: string,
  startedAt: number,
  message: string,
  status: number,
  geminiModel: string,
  errorMessage?: string,
): Promise<Response> {
  try {
    await adminClient
      .from('ai_extraction_drafts')
      .update({ status: 'failed', error_message: errorMessage ?? message })
      .eq('id', draftId);
  } catch {
    // Ignore cleanup errors
  }

  try {
    await adminClient.from('ai_extraction_attempts').insert({
      draft_id: draftId,
      function_name: 'extract-lease',
      provider: 'gemini',
      model: geminiModel,
      status: 'error',
      latency_ms: Date.now() - startedAt,
      error_message: errorMessage ?? message,
    });
  } catch {
    // Ignore cleanup errors
  }

  return errorResponse(status, message);
}

function validatePayload(payload: Partial<ExtractLeaseRequest>): string | null {
  if (!payload.property_id || typeof payload.property_id !== 'string') {
    return 'property_id is required';
  }
  if (!payload.storage_bucket || typeof payload.storage_bucket !== 'string') {
    return 'storage_bucket is required';
  }
  if (!payload.storage_path || typeof payload.storage_path !== 'string') {
    return 'storage_path is required';
  }
  return null;
}

function normalizeNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.round(value * 100) / 100;
  }
  if (typeof value === 'string') {
    const parsed = Number(value.replace(/[^0-9.-]/g, ''));
    if (Number.isFinite(parsed)) {
      return Math.round(parsed * 100) / 100;
    }
  }
  return null;
}

function normalizeDate(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const match = trimmed.match(/^\d{4}-\d{2}-\d{2}$/);
  return match ? trimmed : null;
}

function normalizeStatus(value: unknown): 'active' | 'expired' | 'terminated' | null {
  if (value === 'active' || value === 'expired' || value === 'terminated') {
    return value;
  }
  return null;
}

function normalizeConfidence(input: Record<string, number>): Record<string, number> {
  const fields = [
    'start_date',
    'end_date',
    'monthly_rent',
    'security_deposit',
    'status',
    'property_address',
    'tenant_name',
    'tenant_phone',
    'tenant_email',
  ];
  const output: Record<string, number> = {};
  for (const field of fields) {
    const raw = input[field];
    output[field] =
      typeof raw === 'number' && Number.isFinite(raw) ? Math.max(0, Math.min(1, raw)) : 0;
  }
  return output;
}

function normalizeString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function normalizeTenants(value: unknown): Array<{
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  email: string | null;
}> {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      const tenant = item as {
        first_name?: unknown;
        last_name?: unknown;
        phone?: unknown;
        email?: unknown;
      };
      return {
        first_name: normalizeString(tenant.first_name),
        last_name: normalizeString(tenant.last_name),
        phone: normalizeString(tenant.phone),
        email: normalizeString(tenant.email),
      };
    })
    .filter((tenant) => tenant.first_name || tenant.last_name || tenant.phone || tenant.email);
}

function extractResponseText(geminiResponse: unknown): string | null {
  const candidate = geminiResponse as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  return candidate.candidates?.[0]?.content?.parts?.[0]?.text ?? null;
}

function toBase64(bytes: Uint8Array): string {
  // Process in chunks to avoid slow per-byte string concatenation
  const chunkSize = 8192;
  let binary = '';
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...(bytes.subarray(i, i + chunkSize) as unknown as number[]));
  }
  return btoa(binary);
}

function errorResponse(status: number, message: string): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}
