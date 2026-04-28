import { inject, Injectable } from '@angular/core';
import { SupabaseClient } from '@supabase/supabase-js';
import { from, Observable } from 'rxjs';
import { SUPABASE_CLIENT } from '../auth/supabase.provider';

export interface Expense {
  id: string;
  date: string;
  amount: number;
  description: string;
  irs_category_id: number;
  subcategory_id: string;
  property_id: string | null;
  status: 'pending' | 'approved' | 'rejected';
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ExpenseWithCategory extends Expense {
  irs_expense_categories: { id: number; name: string } | null;
  expense_subcategories: { id: string; name: string } | null;
  properties: { id: string; address_line1: string } | null;
}

export interface CreateExpensePayload {
  date: string;
  amount: number;
  description: string;
  irs_category_id: number;
  subcategory_id: string;
  property_id?: string;
}

export interface UpdateExpensePayload {
  date?: string;
  amount?: number;
  description?: string;
  irs_category_id?: number;
  subcategory_id?: string;
  property_id?: string | null;
}

@Injectable({ providedIn: 'root' })
export class ExpenseService {
  private readonly supabase = inject<SupabaseClient>(SUPABASE_CLIENT);

  getAllExpenses(): Observable<ExpenseWithCategory[]> {
    return from(
      this.supabase
        .from('expenses')
        .select(
          '*, irs_expense_categories(id, name), expense_subcategories(id, name), properties(id, address_line1)',
        )
        .eq('is_active', true)
        .order('date', { ascending: false })
        .then(({ data, error }) => {
          if (error) throw error;
          return (data ?? []) as ExpenseWithCategory[];
        }),
    );
  }

  getExpenses(year: number, month: number): Observable<ExpenseWithCategory[]> {
    const start = new Date(year, month - 1, 1).toISOString().slice(0, 10);
    const end = new Date(year, month, 0).toISOString().slice(0, 10);
    return from(
      this.supabase
        .from('expenses')
        .select(
          '*, irs_expense_categories(id, name), expense_subcategories(id, name), properties(id, address_line1)',
        )
        .eq('is_active', true)
        .gte('date', start)
        .lte('date', end)
        .order('date', { ascending: false })
        .then(({ data, error }) => {
          if (error) throw error;
          return (data ?? []) as ExpenseWithCategory[];
        }),
    );
  }

  getExpense(id: string): Observable<ExpenseWithCategory> {
    return from(
      this.supabase
        .from('expenses')
        .select(
          '*, irs_expense_categories(id, name), expense_subcategories(id, name), properties(id, address_line1)',
        )
        .eq('id', id)
        .single()
        .then(({ data, error }) => {
          if (error) throw error;
          return data as ExpenseWithCategory;
        }),
    );
  }

  createExpense(payload: CreateExpensePayload): Observable<Expense> {
    return from(
      this.supabase
        .from('expenses')
        .insert(payload)
        .select()
        .single()
        .then(({ data, error }) => {
          if (error) throw error;
          return data as Expense;
        }),
    );
  }

  updateExpense(id: string, payload: UpdateExpensePayload): Observable<Expense> {
    return from(
      this.supabase
        .from('expenses')
        .update(payload)
        .eq('id', id)
        .select()
        .single()
        .then(({ data, error }) => {
          if (error) throw error;
          return data as Expense;
        }),
    );
  }

  retractExpense(id: string): Observable<void> {
    return from(
      this.supabase
        .from('expenses')
        .update({ is_active: false })
        .eq('id', id)
        .then(({ error }) => {
          if (error) throw error;
        }),
    );
  }

  getExpensesForProperty(propertyId: string, year: number): Observable<ExpenseWithCategory[]> {
    const start = `${year}-01-01`;
    const end = `${year}-12-31`;
    return from(
      this.supabase
        .from('expenses')
        .select(
          '*, irs_expense_categories(id, name), expense_subcategories(id, name), properties(id, address_line1)',
        )
        .eq('is_active', true)
        .eq('property_id', propertyId)
        .gte('date', start)
        .lte('date', end)
        .order('date', { ascending: false })
        .then(({ data, error }) => {
          if (error) throw error;
          return (data ?? []) as ExpenseWithCategory[];
        }),
    );
  }

  getRecentExpenses(limit = 5): Observable<ExpenseWithCategory[]> {
    return from(
      this.supabase
        .from('expenses')
        .select(
          '*, irs_expense_categories(id, name), expense_subcategories(id, name), properties(id, address_line1)',
        )
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(limit)
        .then(({ data, error }) => {
          if (error) throw error;
          return (data ?? []) as ExpenseWithCategory[];
        }),
    );
  }
}
