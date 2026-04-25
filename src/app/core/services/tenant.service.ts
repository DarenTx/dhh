import { inject, Injectable } from '@angular/core';
import { SupabaseClient } from '@supabase/supabase-js';
import { from, Observable } from 'rxjs';
import { SUPABASE_CLIENT } from '../auth/supabase.provider';

export interface Tenant {
  id: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  email: string | null;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export type CreateTenantData = Pick<Tenant, 'first_name' | 'last_name' | 'phone' | 'email'>;

export type UpdateTenantData = Partial<CreateTenantData>;

@Injectable({ providedIn: 'root' })
export class TenantService {
  private readonly supabase = inject<SupabaseClient>(SUPABASE_CLIENT);

  getTenants(): Observable<Tenant[]> {
    return from(
      this.supabase
        .from('tenants')
        .select('*')
        .eq('is_active', true)
        .order('last_name')
        .order('first_name')
        .then(({ data, error }) => {
          if (error) throw error;
          return (data ?? []) as Tenant[];
        }),
    );
  }

  getTenant(id: string): Observable<Tenant> {
    return from(
      this.supabase
        .from('tenants')
        .select('*')
        .eq('id', id)
        .single()
        .then(({ data, error }) => {
          if (error) throw error;
          return data as Tenant;
        }),
    );
  }

  createTenant(data: CreateTenantData): Observable<Tenant> {
    return from(
      this.supabase
        .from('tenants')
        .insert(data)
        .select()
        .single()
        .then(({ data: created, error }) => {
          if (error) throw error;
          return created as Tenant;
        }),
    );
  }

  updateTenant(id: string, data: UpdateTenantData): Observable<Tenant> {
    return from(
      this.supabase
        .from('tenants')
        .update(data)
        .eq('id', id)
        .select()
        .single()
        .then(({ data: updated, error }) => {
          if (error) throw error;
          return updated as Tenant;
        }),
    );
  }

  deactivateTenant(id: string): Observable<void> {
    return from(
      this.supabase
        .from('tenants')
        .update({ is_active: false })
        .eq('id', id)
        .then(({ error }) => {
          if (error) throw error;
        }),
    );
  }

  getTenantsForLease(leaseId: string): Observable<Tenant[]> {
    return from(
      this.supabase
        .from('lease_tenants')
        .select('tenant:tenant_id(*)')
        .eq('lease_id', leaseId)
        .then(({ data, error }) => {
          if (error) throw error;
          return (data ?? []).map((row) => (row as unknown as { tenant: Tenant }).tenant);
        }),
    );
  }

  linkTenantToLease(leaseId: string, tenantId: string): Observable<void> {
    return from(
      this.supabase
        .from('lease_tenants')
        .insert({ lease_id: leaseId, tenant_id: tenantId })
        .then(({ error }) => {
          if (error) throw error;
        }),
    );
  }

  unlinkTenantFromLease(leaseId: string, tenantId: string): Observable<void> {
    return from(
      this.supabase
        .from('lease_tenants')
        .delete()
        .eq('lease_id', leaseId)
        .eq('tenant_id', tenantId)
        .then(({ error }) => {
          if (error) throw error;
        }),
    );
  }
}
