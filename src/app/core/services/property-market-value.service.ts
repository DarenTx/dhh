import { inject, Injectable } from '@angular/core';
import { SupabaseClient } from '@supabase/supabase-js';
import { from, Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { SUPABASE_CLIENT } from '../auth/supabase.provider';

export interface PropertyMarketValue {
  id: string;
  property_id: string;
  value_date: string;
  market_value: number;
  source: 'zillow' | 'appraisal' | 'manual' | 'other';
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateMarketValueData {
  property_id: string;
  value_date: string;
  market_value: number;
  source: PropertyMarketValue['source'];
  notes?: string | null;
}

export type UpdateMarketValueData = Partial<
  Pick<CreateMarketValueData, 'value_date' | 'market_value' | 'source' | 'notes'>
>;

@Injectable({ providedIn: 'root' })
export class PropertyMarketValueService {
  private readonly supabase = inject<SupabaseClient>(SUPABASE_CLIENT);

  getForProperty(propertyId: string): Observable<PropertyMarketValue[]> {
    return from(
      this.supabase
        .from('property_market_values')
        .select('*')
        .eq('property_id', propertyId)
        .order('value_date', { ascending: false })
        .then(({ data, error }) => {
          if (error) throw error;
          return (data ?? []) as PropertyMarketValue[];
        }),
    );
  }

  getLatestForProperty(propertyId: string): Observable<PropertyMarketValue | null> {
    return from(
      this.supabase
        .from('property_market_values')
        .select('*')
        .eq('property_id', propertyId)
        .order('value_date', { ascending: false })
        .limit(1)
        .then(({ data, error }) => {
          if (error) throw error;
          return (data ?? []).length > 0 ? (data![0] as PropertyMarketValue) : null;
        }),
    );
  }

  /** Returns a Map of property_id → latest PropertyMarketValue for efficient lookups. */
  getLatestForAllProperties(): Observable<Map<string, PropertyMarketValue>> {
    return from(
      this.supabase
        .from('property_market_values')
        .select('*')
        .order('value_date', { ascending: false })
        .then(({ data, error }) => {
          if (error) throw error;
          const map = new Map<string, PropertyMarketValue>();
          for (const row of (data ?? []) as PropertyMarketValue[]) {
            if (!map.has(row.property_id)) {
              map.set(row.property_id, row);
            }
          }
          return map;
        }),
    );
  }

  create(data: CreateMarketValueData): Observable<PropertyMarketValue> {
    return from(
      this.supabase
        .from('property_market_values')
        .insert(data)
        .select()
        .single()
        .then(({ data: created, error }) => {
          if (error) throw error;
          return created as PropertyMarketValue;
        }),
    );
  }

  update(id: string, data: UpdateMarketValueData): Observable<PropertyMarketValue> {
    return from(
      this.supabase
        .from('property_market_values')
        .update(data)
        .eq('id', id)
        .select()
        .single()
        .then(({ data: updated, error }) => {
          if (error) throw error;
          return updated as PropertyMarketValue;
        }),
    );
  }

  delete(id: string): Observable<void> {
    return from(
      this.supabase
        .from('property_market_values')
        .delete()
        .eq('id', id)
        .then(({ error }) => {
          if (error) throw error;
        }),
    );
  }
}
