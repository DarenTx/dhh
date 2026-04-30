import { createClient } from 'jsr:@supabase/supabase-js@2';

interface PropertyOption {
  id: string | null;
  address: string;
}

interface ExtractDocumentRequest {
  extraction_draft_id?: string;
  storage_bucket: string;
  storage_path: string;
  properties: PropertyOption[];
}

interface DocumentExtractionResponse {
  extraction_draft_id: string;
  extracted_fields: {
    title: string | null;
    description: string | null;
    property_id: string | null;
  };
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

const ALLOWED_BUCKET = 'documents';

Deno.serve(async (req: Request) => {
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

    const adminClientForAuth = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: userRole } = await adminClientForAuth
      .from('user_roles')
      .select('role, is_active')
      .eq('user_id', callerUser.id)
      .maybeSingle();

    if (!userRole?.is_active || !['admin', 'manager'].includes(userRole?.role ?? '')) {
      return errorResponse(403, 'Only active admins or managers can extract document data');
    }

    let payload: ExtractDocumentRequest;
    try {
      payload = (await req.json()) as ExtractDocumentRequest;
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

    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const draftId = await ensureDraft(adminClient, {
      draftId: payload.extraction_draft_id,
      storageBucket: payload.storage_bucket,
      storagePath: payload.storage_path,
      createdBy: callerUser.id,
    });

    if (!draftId) {
      return errorResponse(500, 'Failed to initialize extraction draft');
    }

    const { data: fileBlob, error: downloadError } = await adminClient.storage
      .from(payload.storage_bucket)
      .download(payload.storage_path);

    if (downloadError || !fileBlob) {
      return await failureResponse(
        adminClient,
        draftId,
        startedAt,
        'Document file not found in storage',
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
        'Only PDF files are supported for document extraction',
        400,
        GEMINI_MODEL,
      );
    }

    const bytes = new Uint8Array(await fileBlob.arrayBuffer());
    const base64 = toBase64(bytes);

    // Build a property lookup string for the prompt
    const propertyListText = payload.properties
      .map((p) => `  - id: ${p.id ?? 'null'}, address: "${p.address}"`)
      .join('\n');

    const prompt = [
      'You are a document classifier for a real estate property management company.',
      'Analyze this PDF document and return JSON only — no markdown, no code fences.',
      '',
      'Return this exact JSON shape:',
      '{',
      '  "title": string,',
      '  "description": string,',
      '  "property_id": string | null,',
      '  "confidence_by_field": { "title": 0-1, "description": 0-1, "property_id": 0-1 },',
      '  "warnings": string[]',
      '}',
      '',
      'Rules:',
      '- "title": A concise, descriptive title for this document (max 80 characters).',
      '- "description": A 1-2 sentence summary of what this document is about.',
      '- "property_id": Choose the id from the property list below that best matches any address, property name, or reference in the document.',
      '  If no property matches with reasonable confidence, use null (which means LLC/company-level document).',
      '- Prefer null (LLC) over a low-confidence property match.',
      '- "confidence_by_field": 0.0 = no confidence, 1.0 = fully certain.',
      '- "warnings": list any concerns or ambiguities about the extraction.',
      '',
      'Available properties (use exact id values — use null for LLC/company-level):',
      propertyListText,
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

      let waitMs = Math.min(5_000 * 2 ** attempt, 60_000);
      try {
        const rateLimitBody = await geminiResponse.clone().json();
        const retryDelaySec: number | undefined = rateLimitBody?.error?.details
          ?.find(
            (d: { '@type': string; retryDelay?: string }) =>
              d['@type'] === 'type.googleapis.com/google.rpc.RetryInfo',
          )
          ?.retryDelay?.replace('s', '');
        if (retryDelaySec) {
          waitMs = Math.min(parseFloat(retryDelaySec) * 1_000 + 500, 65_000);
        }
      } catch {
        /* ignore parse errors */
      }

      console.warn(`Gemini 429 on attempt ${attempt + 1}; retrying in ${waitMs}ms`);
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }

    if (!geminiResponse.ok) {
      const details = await geminiResponse.text();
      console.error('Gemini extract-document error:', details);
      const userMessage =
        geminiResponse.status === 429
          ? 'AI provider rate limit reached. Please wait a moment and try again.'
          : 'Failed to extract document data via provider';
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
      title?: string | null;
      description?: string | null;
      property_id?: string | null;
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

    // Validate that the returned property_id is actually in the provided list
    const validPropertyIds = new Set(payload.properties.map((p) => p.id));
    const rawPropertyId = parsed.property_id ?? null;
    const resolvedPropertyId = validPropertyIds.has(rawPropertyId) ? rawPropertyId : null;

    const extractedFields = {
      title: normalizeString(parsed.title),
      description: normalizeString(parsed.description),
      property_id: resolvedPropertyId,
    };

    const confidenceByField = normalizeConfidence(parsed.confidence_by_field ?? {});
    const warnings = Array.isArray(parsed.warnings)
      ? parsed.warnings.filter((w) => typeof w === 'string')
      : [];
    const missingFields = Object.entries(extractedFields)
      .filter(([key, value]) => key !== 'property_id' && value === null)
      .map(([field]) => field);

    const response: DocumentExtractionResponse = {
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
      function_name: 'extract-document',
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
    console.error('extract-document unexpected error:', err);
    return errorResponse(500, 'Internal server error');
  }
});

async function ensureDraft(
  adminClient: ReturnType<typeof createClient>,
  input: {
    draftId?: string;
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
      .eq('flow_type', 'document')
      .select('id')
      .maybeSingle();

    if (!error && data?.id) {
      return data.id as string;
    }
  }

  const { data, error } = await adminClient
    .from('ai_extraction_drafts')
    .insert({
      flow_type: 'document',
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
      function_name: 'extract-document',
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

function validatePayload(payload: Partial<ExtractDocumentRequest>): string | null {
  if (!payload.storage_bucket || typeof payload.storage_bucket !== 'string') {
    return 'storage_bucket is required';
  }
  if (!payload.storage_path || typeof payload.storage_path !== 'string') {
    return 'storage_path is required';
  }
  if (!Array.isArray(payload.properties) || payload.properties.length === 0) {
    return 'properties must be a non-empty array';
  }
  return null;
}

function normalizeString(value: unknown): string | null {
  if (typeof value === 'string' && value.trim().length > 0) {
    return value.trim();
  }
  return null;
}

function normalizeConfidence(raw: Record<string, unknown>): Record<string, number> {
  const result: Record<string, number> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value === 'number' && Number.isFinite(value)) {
      result[key] = Math.max(0, Math.min(1, value));
    } else {
      result[key] = 0;
    }
  }
  return result;
}

function extractResponseText(geminiJson: unknown): string | null {
  try {
    const json = geminiJson as {
      candidates?: Array<{
        content?: { parts?: Array<{ text?: string }> };
      }>;
    };
    return json?.candidates?.[0]?.content?.parts?.[0]?.text ?? null;
  } catch {
    return null;
  }
}

function errorResponse(status: number, message: string): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}
