import { createClient } from 'jsr:@supabase/supabase-js@2';

interface ExtractExpenseRequest {
  extraction_draft_id?: string;
  property_id?: string;
  storage_bucket: string;
  storage_path: string;
}

interface ExpenseExtractedFields {
  date: string | null;
  amount: number | null;
  description: string | null;
  vendor: string | null;
  category_name: string | null;
  subcategory_name: string | null;
}

interface ExpenseExtractionResponse {
  extraction_draft_id: string;
  extracted_fields: ExpenseExtractedFields;
  confidence_by_field: Record<string, number>;
  missing_fields: string[];
  category_match_result: 'matched' | 'unresolved';
  unmatched_labels: string[];
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

const ALLOWED_BUCKET = 'expense-evidence';
const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
]);
const GEMINI_MODEL = Deno.env.get('GEMINI_MODEL') ?? 'gemini-2.5-flash';
const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

Deno.serve(async (req: Request) => {
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
      return errorResponse(403, 'Only active admins or managers can extract receipt data');
    }

    let payload: ExtractExpenseRequest;
    try {
      payload = (await req.json()) as ExtractExpenseRequest;
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

    // Fetch allowed categories and subcategories to constrain the AI response
    const { data: categoriesData } = await adminClient
      .from('irs_expense_categories')
      .select('name, expense_subcategories(name)')
      .order('name');

    type CategoryRow = { name: string; expense_subcategories: { name: string }[] };
    const categoryList = ((categoriesData as CategoryRow[]) ?? []).map((cat) => ({
      category: cat.name,
      subcategories: (cat.expense_subcategories ?? []).map((s) => s.name).sort(),
    }));

    const draftId = await ensureDraft(adminClient, {
      draftId: payload.extraction_draft_id,
      flowType: 'expense',
      propertyId: payload.property_id ?? null,
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
        'Receipt file not found in storage',
        404,
        downloadError?.message,
      );
    }

    if (!ALLOWED_MIME_TYPES.has(fileBlob.type)) {
      return await failureResponse(
        adminClient,
        draftId,
        startedAt,
        `Unsupported receipt MIME type: ${fileBlob.type || 'unknown'}`,
        400,
      );
    }

    const bytes = new Uint8Array(await fileBlob.arrayBuffer());
    const base64 = toBase64(bytes);

    const categoryListJson = JSON.stringify(categoryList, null, 2);

    const prompt = [
      'Extract expense data from this receipt and return JSON only.',
      'Return this exact shape:',
      '{"date":"YYYY-MM-DD|null","amount":number|null,"description":string|null,"vendor":string|null,"category_name":string|null,"subcategory_name":string|null,"confidence_by_field":{"date":0-1,"amount":0-1,"description":0-1,"vendor":0-1,"category_name":0-1,"subcategory_name":0-1},"warnings":string[]}',
      '',
      'IMPORTANT — category and subcategory rules:',
      'You MUST use ONLY the exact category and subcategory names from the list below.',
      'Copy the name character-for-character. Do NOT invent, paraphrase, or abbreviate names.',
      'If no category fits, return null for both category_name and subcategory_name.',
      'If a category fits but no subcategory fits, return the category and null for subcategory_name.',
      '',
      'Allowed categories and subcategories:',
      categoryListJson,
    ].join('\n');

    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          generationConfig: { responseMimeType: 'application/json', temperature: 0.1 },
          contents: [
            {
              role: 'user',
              parts: [
                { text: prompt },
                {
                  inlineData: {
                    mimeType: fileBlob.type || 'application/octet-stream',
                    data: base64,
                  },
                },
              ],
            },
          ],
        }),
      },
    );

    if (!geminiResponse.ok) {
      const details = await geminiResponse.text();
      console.error('Gemini extract-expense error:', details);
      return await failureResponse(
        adminClient,
        draftId,
        startedAt,
        'Failed to extract expense data via provider',
        502,
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
      );
    }

    let parsed: {
      date?: string | null;
      amount?: number | null;
      description?: string | null;
      vendor?: string | null;
      category_name?: string | null;
      subcategory_name?: string | null;
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
      );
    }

    const extractedFields: ExpenseExtractedFields = {
      date: normalizeDate(parsed.date),
      amount: normalizeNumber(parsed.amount),
      description: normalizeString(parsed.description),
      vendor: normalizeString(parsed.vendor),
      category_name: normalizeString(parsed.category_name),
      subcategory_name: normalizeString(parsed.subcategory_name),
    };

    const confidenceByField = normalizeConfidence(parsed.confidence_by_field ?? {});
    const warnings = Array.isArray(parsed.warnings)
      ? parsed.warnings.filter((w) => typeof w === 'string')
      : [];
    const missingFields = Object.entries(extractedFields)
      .filter(([, value]) => value === null)
      .map(([field]) => field);

    const unmatchedLabels: string[] = [];
    if (!extractedFields.category_name) unmatchedLabels.push('category_name');
    if (!extractedFields.subcategory_name) unmatchedLabels.push('subcategory_name');

    const response: ExpenseExtractionResponse = {
      extraction_draft_id: draftId,
      extracted_fields: extractedFields,
      confidence_by_field: confidenceByField,
      missing_fields: missingFields,
      category_match_result: unmatchedLabels.length > 0 ? 'unresolved' : 'matched',
      unmatched_labels: unmatchedLabels,
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
      function_name: 'extract-expense',
      provider: 'gemini',
      model: GEMINI_MODEL,
      status: 'success',
      latency_ms: Date.now() - startedAt,
      response_payload: response,
    });

    await adminClient.rpc('run_ai_extraction_retention_cleanup');

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('extract-expense unexpected error:', err);
    return errorResponse(500, 'Internal server error');
  }
});

async function ensureDraft(
  adminClient: ReturnType<typeof createClient>,
  input: {
    draftId?: string;
    flowType: 'expense';
    propertyId: string | null;
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
  errorMessage?: string,
): Promise<Response> {
  await adminClient
    .from('ai_extraction_drafts')
    .update({ status: 'failed', error_message: errorMessage ?? message })
    .eq('id', draftId);

  await adminClient.from('ai_extraction_attempts').insert({
    draft_id: draftId,
    function_name: 'extract-expense',
    provider: 'gemini',
    model: GEMINI_MODEL,
    status: 'error',
    latency_ms: Date.now() - startedAt,
    error_message: errorMessage ?? message,
  });

  return errorResponse(status, message);
}

function validatePayload(payload: Partial<ExtractExpenseRequest>): string | null {
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
  return /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? trimmed : null;
}

function normalizeString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function normalizeConfidence(input: Record<string, number>): Record<string, number> {
  const fields = ['date', 'amount', 'description', 'vendor', 'category_name', 'subcategory_name'];
  const output: Record<string, number> = {};
  for (const field of fields) {
    const raw = input[field];
    output[field] =
      typeof raw === 'number' && Number.isFinite(raw) ? Math.max(0, Math.min(1, raw)) : 0;
  }
  return output;
}

function extractResponseText(geminiResponse: unknown): string | null {
  const candidate = geminiResponse as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  return candidate.candidates?.[0]?.content?.parts?.[0]?.text ?? null;
}

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const b of bytes) {
    binary += String.fromCharCode(b);
  }
  return btoa(binary);
}

function errorResponse(status: number, message: string): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}
