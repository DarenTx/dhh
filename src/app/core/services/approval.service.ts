import { inject, Injectable } from '@angular/core';
import { SupabaseClient } from '@supabase/supabase-js';
import { from, Observable } from 'rxjs';
import { SUPABASE_CLIENT } from '../auth/supabase.provider';

export interface ApprovalRequirement {
  id: string;
  approvable_type: 'expense' | 'guaranteed_payment';
  approvable_id: string;
  approver_id: string;
  status: 'pending' | 'approved' | 'rejected';
  reason: string | null;
  responded_at: string | null;
  created_at: string;
}

@Injectable({ providedIn: 'root' })
export class ApprovalService {
  private readonly supabase = inject<SupabaseClient>(SUPABASE_CLIENT);

  getPendingCountForMe(): Observable<number> {
    return from(
      this.supabase.auth.getUser().then(async ({ data: { user } }) => {
        if (!user) return 0;
        const { count, error } = await this.supabase
          .from('approval_requirements')
          .select('id', { count: 'exact', head: true })
          .eq('approver_id', user.id)
          .eq('status', 'pending');
        if (error) throw error;
        return count ?? 0;
      }),
    );
  }

  getPendingForMe(): Observable<ApprovalRequirement[]> {
    return from(
      this.supabase.auth.getUser().then(async ({ data: { user } }) => {
        if (!user) return [];
        const { data, error } = await this.supabase
          .from('approval_requirements')
          .select('*')
          .eq('approver_id', user.id)
          .eq('status', 'pending')
          .order('created_at', { ascending: false });
        if (error) throw error;
        return (data ?? []) as ApprovalRequirement[];
      }),
    );
  }

  approve(id: string): Observable<void> {
    return from(
      this.supabase
        .from('approval_requirements')
        .update({ status: 'approved', responded_at: new Date().toISOString() })
        .eq('id', id)
        .then(({ error }) => {
          if (error) throw error;
        }),
    );
  }

  reject(id: string, reason: string): Observable<void> {
    return from(
      this.supabase
        .from('approval_requirements')
        .update({ status: 'rejected', reason, responded_at: new Date().toISOString() })
        .eq('id', id)
        .then(({ error }) => {
          if (error) throw error;
        }),
    );
  }
}
