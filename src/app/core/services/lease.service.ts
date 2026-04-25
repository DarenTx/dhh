import { inject, Injectable } from '@angular/core';
import { SupabaseClient } from '@supabase/supabase-js';
import { from, Observable } from 'rxjs';
import { SUPABASE_CLIENT } from '../auth/supabase.provider';

export interface Lease {
  id: string;
  property_id: string;
  start_date: string;
  end_date: string | null;
  monthly_rent: number;
  security_deposit: number;
  document_url: string | null;
  status: 'active' | 'expired' | 'terminated';
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export type CreateLeaseData = Pick<
  Lease,
  'property_id' | 'start_date' | 'end_date' | 'monthly_rent' | 'security_deposit' | 'status'
> & { document_url?: string | null };

export type UpdateLeaseData = Partial<
  Pick<
    Lease,
    'start_date' | 'end_date' | 'monthly_rent' | 'security_deposit' | 'document_url' | 'status'
  >
>;

@Injectable({ providedIn: 'root' })
export class LeaseService {
  private readonly supabase = inject<SupabaseClient>(SUPABASE_CLIENT);

  getLeasesForProperty(propertyId: string): Observable<Lease[]> {
    return from(
      this.supabase
        .from('leases')
        .select('*')
        .eq('property_id', propertyId)
        .eq('is_active', true)
        .order('start_date', { ascending: false })
        .then(({ data, error }) => {
          if (error) throw error;
          return (data ?? []) as Lease[];
        }),
    );
  }

  getActiveLease(propertyId: string): Observable<Lease | null> {
    return from(
      this.supabase
        .from('leases')
        .select('*')
        .eq('property_id', propertyId)
        .eq('is_active', true)
        .eq('status', 'active')
        .limit(1)
        .maybeSingle()
        .then(({ data, error }) => {
          if (error) throw error;
          return (data ?? null) as Lease | null;
        }),
    );
  }

  createLease(data: CreateLeaseData): Observable<Lease> {
    return from(
      this.supabase
        .from('leases')
        .insert(data)
        .select()
        .single()
        .then(({ data: created, error }) => {
          if (error) throw error;
          return created as Lease;
        }),
    );
  }

  updateLease(id: string, data: UpdateLeaseData): Observable<Lease> {
    return from(
      this.supabase
        .from('leases')
        .update(data)
        .eq('id', id)
        .select()
        .single()
        .then(({ data: updated, error }) => {
          if (error) throw error;
          return updated as Lease;
        }),
    );
  }

  deactivateLease(id: string): Observable<void> {
    return from(
      this.supabase
        .from('leases')
        .update({ is_active: false, status: 'terminated' })
        .eq('id', id)
        .then(({ error }) => {
          if (error) throw error;
        }),
    );
  }

  getLeasesForTenant(tenantId: string): Observable<Lease[]> {
    return from(
      this.supabase
        .from('lease_tenants')
        .select('lease:lease_id(*)')
        .eq('tenant_id', tenantId)
        .then(({ data, error }) => {
          if (error) throw error;
          return (data ?? []).map((row) => (row as unknown as { lease: Lease }).lease);
        }),
    );
  }
}
