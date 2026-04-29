import { inject, Injectable } from '@angular/core';
import { SupabaseClient } from '@supabase/supabase-js';
import { from, Observable } from 'rxjs';
import { SUPABASE_CLIENT } from '../auth/supabase.provider';

export interface AuditRow {
  id: string;
  table_name: string;
  record_id: string;
  operation: 'INSERT' | 'UPDATE' | 'DELETE';
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  performed_by: string | null;
  performed_at: string;
  performer_display: string | null;
}

export interface AuditLoadParams {
  from?: string;
  to?: string;
  page: number;
}

export interface AuditResult {
  rows: AuditRow[];
  totalCount: number;
}

const PAGE_SIZE = 150;

@Injectable({ providedIn: 'root' })
export class AuditService {
  private readonly supabase = inject<SupabaseClient>(SUPABASE_CLIENT);

  loadAudit(params: AuditLoadParams): Observable<AuditResult> {
    const { from: fromDate, to, page } = params;
    const start = (page - 1) * PAGE_SIZE;
    const end = start + PAGE_SIZE - 1;

    let query = this.supabase
      .from('audit_log')
      .select(
        'id, table_name, record_id, operation, old_data, new_data, performed_by, performed_by_text, performed_at',
        { count: 'exact' },
      )
      .order('performed_at', { ascending: false })
      .neq('table_name', 'ai_extraction_drafts')
      .neq('table_name', 'approval_requirements')
      .range(start, end);

    if (fromDate) query = query.gte('performed_at', fromDate);
    if (to) query = query.lte('performed_at', to + 'T23:59:59Z');

    return from(
      query.then(({ data, error, count }) => {
        if (error) throw error;
        const rows: AuditRow[] = (data ?? []).map((row: any) => ({
          id: row.id,
          table_name: row.table_name,
          record_id: row.record_id,
          operation: row.operation,
          old_data: row.old_data,
          new_data: row.new_data,
          performed_by: row.performed_by,
          performed_at: row.performed_at,
          performer_display: row.performed_by_text ?? null,
        }));
        return { rows, totalCount: count ?? 0 };
      }),
    );
  }
}
