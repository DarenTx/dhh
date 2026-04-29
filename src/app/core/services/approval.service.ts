import { inject, Injectable } from '@angular/core';
import { SupabaseClient } from '@supabase/supabase-js';
import { from, Observable } from 'rxjs';
import { SUPABASE_CLIENT } from '../auth/supabase.provider';

export interface ApprovalRequirement {
  id: string;
  approvable_type: 'expense' | 'guaranteed_payment';
  approvable_id: string;
  approver_id: string;
  approver_email: string | null;
  approver_first_name: string | null;
  approver_last_name: string | null;
  approver_avatar_url: string | null;
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

  getApprovalsForExpense(expenseId: string): Observable<ApprovalRequirement[]> {
    return from(
      this.supabase
        .from('approval_requirements')
        .select('*')
        .eq('approvable_type', 'expense')
        .eq('approvable_id', expenseId)
        .order('created_at', { ascending: true })
        .then(async ({ data, error }) => {
          if (error) throw error;
          const rows = (data ?? []) as ApprovalRequirement[];
          if (rows.length === 0) return rows;
          const ids = [...new Set(rows.map((r) => r.approver_id))];
          const { data: users } = await this.supabase
            .from('user_roles')
            .select('user_id, email, first_name, last_name, avatar_url')
            .in('user_id', ids);
          const emailMap = Object.fromEntries(
            (users ?? []).map(
              (u: {
                user_id: string;
                email: string;
                first_name: string | null;
                last_name: string | null;
                avatar_url: string | null;
              }) => [u.user_id, u],
            ),
          );
          return rows.map((r) => ({
            ...r,
            approver_email: emailMap[r.approver_id]?.email ?? null,
            approver_first_name: emailMap[r.approver_id]?.first_name ?? null,
            approver_last_name: emailMap[r.approver_id]?.last_name ?? null,
            approver_avatar_url: emailMap[r.approver_id]?.avatar_url ?? null,
          }));
        }),
    );
  }

  getApprovalsForGP(gpId: string): Observable<ApprovalRequirement[]> {
    return from(
      this.supabase
        .from('approval_requirements')
        .select('*')
        .eq('approvable_type', 'guaranteed_payment')
        .eq('approvable_id', gpId)
        .order('created_at', { ascending: true })
        .then(async ({ data, error }) => {
          if (error) throw error;
          const rows = (data ?? []) as ApprovalRequirement[];
          if (rows.length === 0) return rows;
          const ids = [...new Set(rows.map((r) => r.approver_id))];
          const { data: users } = await this.supabase
            .from('user_roles')
            .select('user_id, email, first_name, last_name, avatar_url')
            .in('user_id', ids);
          const emailMap = Object.fromEntries(
            (users ?? []).map(
              (u: {
                user_id: string;
                email: string;
                first_name: string | null;
                last_name: string | null;
                avatar_url: string | null;
              }) => [u.user_id, u],
            ),
          );
          return rows.map((r) => ({
            ...r,
            approver_email: emailMap[r.approver_id]?.email ?? null,
            approver_first_name: emailMap[r.approver_id]?.first_name ?? null,
            approver_last_name: emailMap[r.approver_id]?.last_name ?? null,
            approver_avatar_url: emailMap[r.approver_id]?.avatar_url ?? null,
          }));
        }),
    );
  }
}
