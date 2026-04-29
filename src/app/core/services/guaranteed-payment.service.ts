import { inject, Injectable } from '@angular/core';
import { SupabaseClient } from '@supabase/supabase-js';
import { from, Observable } from 'rxjs';
import { SUPABASE_CLIENT } from '../auth/supabase.provider';

export interface GuaranteedPayment {
  id: string;
  work_date: string;
  hours_billed: number;
  work_description: string;
  status: 'pending' | 'approved' | 'rejected';
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateGuaranteedPaymentPayload {
  work_date: string;
  hours_billed: number;
  work_description: string;
}

export interface UpdateGuaranteedPaymentPayload {
  work_date?: string;
  hours_billed?: number;
  work_description?: string;
}

@Injectable({ providedIn: 'root' })
export class GuaranteedPaymentService {
  private readonly supabase = inject<SupabaseClient>(SUPABASE_CLIENT);

  getMyPayments(year: number, month: number): Observable<GuaranteedPayment[]> {
    const start = new Date(year, month - 1, 1).toISOString().slice(0, 10);
    const end = new Date(year, month, 0).toISOString().slice(0, 10);
    return from(
      this.supabase.auth.getUser().then(async ({ data: { user } }) => {
        if (!user) return [];
        const { data, error } = await this.supabase
          .from('guaranteed_payments')
          .select('*')
          .eq('is_active', true)
          .eq('created_by', user.id)
          .gte('work_date', start)
          .lte('work_date', end)
          .order('work_date', { ascending: false });
        if (error) throw error;
        return (data ?? []) as GuaranteedPayment[];
      }),
    );
  }

  getAllPayments(year: number, month: number): Observable<GuaranteedPayment[]> {
    const start = new Date(year, month - 1, 1).toISOString().slice(0, 10);
    const end = new Date(year, month, 0).toISOString().slice(0, 10);
    return from(
      this.supabase
        .from('guaranteed_payments')
        .select('*, user_roles!guaranteed_payments_created_by_fkey(email)')
        .eq('is_active', true)
        .gte('work_date', start)
        .lte('work_date', end)
        .order('work_date', { ascending: false })
        .then(({ data, error }) => {
          if (error) throw error;
          return (data ?? []) as GuaranteedPayment[];
        }),
    );
  }

  getPayment(id: string): Observable<GuaranteedPayment> {
    return from(
      this.supabase
        .from('guaranteed_payments')
        .select('*')
        .eq('id', id)
        .single()
        .then(({ data, error }) => {
          if (error) throw error;
          return data as GuaranteedPayment;
        }),
    );
  }

  createPayment(payload: CreateGuaranteedPaymentPayload): Observable<GuaranteedPayment> {
    return from(
      this.supabase
        .from('guaranteed_payments')
        .insert(payload)
        .select()
        .single()
        .then(({ data, error }) => {
          if (error) throw error;
          return data as GuaranteedPayment;
        }),
    );
  }

  updatePayment(
    id: string,
    payload: UpdateGuaranteedPaymentPayload,
  ): Observable<GuaranteedPayment> {
    return from(
      this.supabase
        .from('guaranteed_payments')
        .update(payload)
        .eq('id', id)
        .select()
        .single()
        .then(({ data, error }) => {
          if (error) throw error;
          return data as GuaranteedPayment;
        }),
    );
  }

  retractPayment(id: string): Observable<void> {
    return from(
      this.supabase
        .from('guaranteed_payments')
        .update({ is_active: false })
        .eq('id', id)
        .then(({ error }) => {
          if (error) throw error;
        }),
    );
  }

  getRecentPayments(limit = 5): Observable<GuaranteedPayment[]> {
    return from(
      this.supabase
        .from('guaranteed_payments')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(limit)
        .then(({ data, error }) => {
          if (error) throw error;
          return (data ?? []) as GuaranteedPayment[];
        }),
    );
  }

  getMonthlyHours(year: number, month: number): Observable<number> {
    const start = new Date(year, month - 1, 1).toISOString().slice(0, 10);
    const end = new Date(year, month, 0).toISOString().slice(0, 10);
    return from(
      this.supabase.auth.getUser().then(async ({ data: { user } }) => {
        if (!user) return 0;
        const { data, error } = await this.supabase
          .from('guaranteed_payments')
          .select('hours_billed')
          .eq('is_active', true)
          .eq('created_by', user.id)
          .neq('status', 'rejected')
          .gte('work_date', start)
          .lte('work_date', end);
        if (error) throw error;
        return (data ?? []).reduce((sum, row) => sum + Number(row.hours_billed), 0);
      }),
    );
  }
}
