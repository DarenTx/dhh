import { inject, Injectable } from '@angular/core';
import { SupabaseClient } from '@supabase/supabase-js';
import { from, Observable } from 'rxjs';
import { SUPABASE_CLIENT } from '../auth/supabase.provider';

export interface LeaseExtractionRequest {
  extraction_draft_id?: string;
  property_id: string;
  storage_bucket: string;
  storage_path: string;
  locale?: string;
  currency?: string;
}

export interface LeaseExtractionResult {
  extraction_draft_id: string;
  extracted_fields: {
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

export interface ExpenseExtractionRequest {
  extraction_draft_id?: string;
  property_id?: string;
  storage_bucket: string;
  storage_path: string;
}

export interface ExpenseExtractionResult {
  extraction_draft_id: string;
  extracted_fields: {
    date: string | null;
    amount: number | null;
    description: string | null;
    vendor: string | null;
    category_name: string | null;
    subcategory_name: string | null;
  };
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

@Injectable({ providedIn: 'root' })
export class AiExtractionService {
  private readonly supabase = inject<SupabaseClient>(SUPABASE_CLIENT);

  extractLease(payload: LeaseExtractionRequest): Observable<LeaseExtractionResult> {
    return from(
      this.supabase.functions
        .invoke('extract-lease', { body: payload })
        .then(async ({ data, error }) => {
          if (error) throw new Error(await extractFunctionErrorMessage(error));
          return data as LeaseExtractionResult;
        }),
    );
  }

  extractExpense(payload: ExpenseExtractionRequest): Observable<ExpenseExtractionResult> {
    return from(
      this.supabase.functions
        .invoke('extract-expense', { body: payload })
        .then(async ({ data, error }) => {
          if (error) throw new Error(await extractFunctionErrorMessage(error));
          return data as ExpenseExtractionResult;
        }),
    );
  }
}

async function extractFunctionErrorMessage(error: unknown): Promise<string> {
  try {
    const body = await (error as { context?: Response }).context?.json();
    if (typeof body?.error === 'string') return body.error;
  } catch {
    // fall through to generic message
  }
  return (error as Error)?.message ?? 'Unknown error';
}
