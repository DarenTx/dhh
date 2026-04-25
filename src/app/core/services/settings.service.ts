import { inject, Injectable } from '@angular/core';
import { SupabaseClient } from '@supabase/supabase-js';
import { from, Observable } from 'rxjs';
import { SUPABASE_CLIENT } from '../auth/supabase.provider';

export interface AppSettings {
  expense_monthly_aggregate_threshold: number;
  guaranteed_payment_hour_cap: number;
}

export interface IrsCategory {
  id: number;
  name: string;
}

export interface ExpenseSubcategory {
  id: string;
  irs_category_id: number;
  name: string;
  is_active: boolean;
  created_at: string;
}

@Injectable({ providedIn: 'root' })
export class SettingsService {
  private readonly supabase = inject<SupabaseClient>(SUPABASE_CLIENT);

  getSettings(): Observable<AppSettings> {
    return from(
      this.supabase
        .from('app_settings')
        .select('expense_monthly_aggregate_threshold, guaranteed_payment_hour_cap')
        .eq('id', 1)
        .single()
        .then(({ data, error }) => {
          if (error) throw error;
          return data as AppSettings;
        }),
    );
  }

  updateSettings(settings: { expenseThreshold: number; hourCap: number }): Observable<void> {
    return from(
      this.supabase
        .from('app_settings')
        .update({
          expense_monthly_aggregate_threshold: settings.expenseThreshold,
          guaranteed_payment_hour_cap: settings.hourCap,
        })
        .eq('id', 1)
        .then(({ error }) => {
          if (error) throw error;
        }),
    );
  }

  getCategories(): Observable<IrsCategory[]> {
    return from(
      this.supabase
        .from('irs_expense_categories')
        .select('id, name')
        .order('id')
        .then(({ data, error }) => {
          if (error) throw error;
          return (data ?? []) as IrsCategory[];
        }),
    );
  }

  getSubcategories(categoryId: number): Observable<ExpenseSubcategory[]> {
    return from(
      this.supabase
        .from('expense_subcategories')
        .select('id, irs_category_id, name, is_active, created_at')
        .eq('irs_category_id', categoryId)
        .eq('is_active', true)
        .order('name')
        .then(({ data, error }) => {
          if (error) throw error;
          return (data ?? []) as ExpenseSubcategory[];
        }),
    );
  }

  addSubcategory(categoryId: number, name: string): Observable<void> {
    return from(
      this.supabase
        .from('expense_subcategories')
        .insert({ irs_category_id: categoryId, name })
        .then(({ error }) => {
          if (error) throw error;
        }),
    );
  }

  disableSubcategory(id: string): Observable<void> {
    return from(
      this.supabase
        .from('expense_subcategories')
        .update({ is_active: false })
        .eq('id', id)
        .then(({ error }) => {
          if (error) throw error;
        }),
    );
  }
}
