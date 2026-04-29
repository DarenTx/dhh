import { inject, Injectable } from '@angular/core';
import { SupabaseClient } from '@supabase/supabase-js';
import { from, Observable } from 'rxjs';
import { SUPABASE_CLIENT } from '../auth/supabase.provider';

export type UserRole = 'admin' | 'manager' | 'view_only';

export interface UserRecord {
  user_id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  role: UserRole;
  is_active: boolean;
  created_at: string;
}

@Injectable({ providedIn: 'root' })
export class AdminService {
  private readonly supabase = inject<SupabaseClient>(SUPABASE_CLIENT);

  getUsers(): Observable<UserRecord[]> {
    return from(
      this.supabase
        .from('user_roles')
        .select('user_id, email, first_name, last_name, avatar_url, role, is_active, created_at')
        .order('created_at')
        .then(({ data, error }) => {
          if (error) throw error;
          return (data ?? []) as UserRecord[];
        }),
    );
  }

  inviteUser(
    email: string,
    role: UserRole,
    firstName?: string,
    lastName?: string,
  ): Observable<void> {
    return from(
      this.supabase.functions
        .invoke('invite-user', {
          body: { email, role, first_name: firstName, last_name: lastName },
        })
        .then(({ error }) => {
          if (error) throw error;
        }),
    );
  }

  deactivateUser(userId: string): Observable<void> {
    return from(
      this.supabase
        .from('user_roles')
        .update({ is_active: false })
        .eq('user_id', userId)
        .then(({ error }) => {
          if (error) throw error;
        }),
    );
  }

  reactivateUser(userId: string): Observable<void> {
    return from(
      this.supabase
        .from('user_roles')
        .update({ is_active: true })
        .eq('user_id', userId)
        .then(({ error }) => {
          if (error) throw error;
        }),
    );
  }
}
