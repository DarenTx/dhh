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

export interface InspectionTag {
  id: string;
  room_type: string;
  name: string;
  is_active: boolean;
  created_at: string;
}

export interface GmailConfig {
  auth_status: 'connected' | 'reauth_required' | 'disconnected';
  owner_user_id: string | null;
  connected_at: string | null;
  last_token_refresh_at: string | null;
}

export interface GmailAllowListEntry {
  id: string;
  pattern: string;
  label: string;
  is_active: boolean;
  created_at: string;
}

export interface GmailHealth {
  error_count_7d: number;
  last_error_detail: string | null;
  last_processed_at: string | null;
  permanently_failed_count: number;
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

  getInspectionTags(): Observable<InspectionTag[]> {
    return from(
      this.supabase
        .from('inspection_tags')
        .select('id, room_type, name, is_active, created_at')
        .eq('is_active', true)
        .order('room_type')
        .order('name')
        .then(({ data, error }) => {
          if (error) throw error;
          return (data ?? []) as InspectionTag[];
        }),
    );
  }

  addInspectionTag(roomType: string, name: string): Observable<void> {
    return from(
      this.supabase
        .from('inspection_tags')
        .insert({ room_type: roomType, name })
        .then(({ error }) => {
          if (error) throw error;
        }),
    );
  }

  disableInspectionTag(id: string): Observable<void> {
    return from(
      this.supabase
        .from('inspection_tags')
        .update({ is_active: false })
        .eq('id', id)
        .then(({ error }) => {
          if (error) throw error;
        }),
    );
  }

  // ── Gmail ──────────────────────────────────────────────────────────────────

  getGmailConfig(): Observable<GmailConfig> {
    return from(
      this.supabase
        .from('gmail_config')
        .select('auth_status, owner_user_id, connected_at, last_token_refresh_at')
        .eq('id', 1)
        .single()
        .then(({ data, error }) => {
          if (error) throw error;
          return data as GmailConfig;
        }),
    );
  }

  getGmailAllowList(): Observable<GmailAllowListEntry[]> {
    return from(
      this.supabase
        .from('gmail_allow_list')
        .select('id, pattern, label, is_active, created_at')
        .order('created_at')
        .then(({ data, error }) => {
          if (error) throw error;
          return (data ?? []) as GmailAllowListEntry[];
        }),
    );
  }

  addGmailAllowListEntry(pattern: string, label: string): Observable<void> {
    return from(
      this.supabase
        .from('gmail_allow_list')
        .insert({ pattern, label })
        .then(({ error }) => {
          if (error) throw error;
        }),
    );
  }

  toggleGmailAllowListEntry(id: string, isActive: boolean): Observable<void> {
    return from(
      this.supabase
        .from('gmail_allow_list')
        .update({ is_active: isActive })
        .eq('id', id)
        .then(({ error }) => {
          if (error) throw error;
        }),
    );
  }

  deleteGmailAllowListEntry(id: string): Observable<void> {
    return from(
      this.supabase
        .from('gmail_allow_list')
        .delete()
        .eq('id', id)
        .then(({ error }) => {
          if (error) throw error;
        }),
    );
  }

  getGmailHealth(): Observable<GmailHealth> {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    return from(
      Promise.all([
        this.supabase
          .from('gmail_processed_messages')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'error')
          .gte('last_error_at', sevenDaysAgo),
        this.supabase
          .from('gmail_processed_messages')
          .select('error_detail')
          .in('status', ['error', 'permanently_failed'])
          .order('last_error_at', { ascending: false })
          .limit(1),
        this.supabase
          .from('gmail_processed_messages')
          .select('processed_at')
          .eq('status', 'completed')
          .order('processed_at', { ascending: false })
          .limit(1),
        this.supabase
          .from('gmail_processed_messages')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'permanently_failed'),
      ]).then(([errorCount, lastError, lastSuccess, permFailed]) => ({
        error_count_7d: errorCount.count ?? 0,
        last_error_detail:
          (lastError.data as { error_detail: string | null }[] | null)?.[0]?.error_detail ?? null,
        last_processed_at:
          (lastSuccess.data as { processed_at: string }[] | null)?.[0]?.processed_at ?? null,
        permanently_failed_count: permFailed.count ?? 0,
      })),
    );
  }

  getGmailAuthUrl(redirectUri: string): Observable<string> {
    return from(
      this.supabase.functions
        .invoke('gmail-oauth', { body: { action: 'get_auth_url', redirect_uri: redirectUri } })
        .then(({ data, error }) => {
          if (error) throw error;
          return (data as { url: string }).url;
        }),
    );
  }

  exchangeGmailCode(code: string, redirectUri: string): Observable<{ watch_configured: boolean }> {
    return from(
      this.supabase.functions
        .invoke('gmail-oauth', {
          body: { action: 'exchange_code', code, redirect_uri: redirectUri },
        })
        .then(({ data, error }) => {
          if (error) throw error;
          return data as { watch_configured: boolean };
        }),
    );
  }

  disconnectGmail(): Observable<void> {
    return from(
      this.supabase.functions
        .invoke('gmail-oauth', { body: { action: 'disconnect' } })
        .then(({ error }) => {
          if (error) throw error;
        }),
    );
  }
}
