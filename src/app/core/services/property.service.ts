import { inject, Injectable } from '@angular/core';
import { SupabaseClient } from '@supabase/supabase-js';
import { forkJoin, from, Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { SUPABASE_CLIENT } from '../auth/supabase.provider';

export interface Property {
  id: string;
  address_line1: string;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  year_built: number | null;
  square_footage: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  cover_photo_url: string | null;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface PropertyWithOccupancy extends Property {
  isOccupied: boolean;
}

export type CreatePropertyData = Pick<
  Property,
  | 'address_line1'
  | 'address_line2'
  | 'city'
  | 'state'
  | 'zip'
  | 'year_built'
  | 'square_footage'
  | 'bedrooms'
  | 'bathrooms'
  | 'cover_photo_url'
>;

export type UpdatePropertyData = Partial<CreatePropertyData>;

@Injectable({ providedIn: 'root' })
export class PropertyService {
  private readonly supabase = inject<SupabaseClient>(SUPABASE_CLIENT);

  getProperties(): Observable<PropertyWithOccupancy[]> {
    const properties$ = from(
      this.supabase
        .from('properties')
        .select('*')
        .eq('is_active', true)
        .order('address_line1')
        .then(({ data, error }) => {
          if (error) throw error;
          return (data ?? []) as Property[];
        }),
    );

    const occupiedIds$ = from(
      this.supabase
        .from('leases')
        .select('property_id')
        .eq('is_active', true)
        .eq('status', 'active')
        .then(({ data, error }) => {
          if (error) throw error;
          return new Set((data ?? []).map((l: { property_id: string }) => l.property_id));
        }),
    );

    return forkJoin([properties$, occupiedIds$]).pipe(
      map(([properties, occupied]) =>
        properties.map((p) => ({ ...p, isOccupied: occupied.has(p.id) })),
      ),
    );
  }

  getProperty(id: string): Observable<PropertyWithOccupancy> {
    const property$ = from(
      this.supabase
        .from('properties')
        .select('*')
        .eq('id', id)
        .single()
        .then(({ data, error }) => {
          if (error) throw error;
          return data as Property;
        }),
    );

    const occupied$ = from(
      this.supabase
        .from('leases')
        .select('id')
        .eq('property_id', id)
        .eq('is_active', true)
        .eq('status', 'active')
        .limit(1)
        .then(({ data, error }) => {
          if (error) throw error;
          return (data ?? []).length > 0;
        }),
    );

    return forkJoin([property$, occupied$]).pipe(
      map(([property, isOccupied]) => ({ ...property, isOccupied })),
    );
  }

  createProperty(id: string, data: CreatePropertyData): Observable<Property> {
    return from(
      this.supabase
        .from('properties')
        .insert({ id, ...data })
        .select()
        .single()
        .then(({ data: created, error }) => {
          if (error) throw error;
          return created as Property;
        }),
    );
  }

  updateProperty(id: string, data: UpdatePropertyData): Observable<Property> {
    return from(
      this.supabase
        .from('properties')
        .update(data)
        .eq('id', id)
        .select()
        .single()
        .then(({ data: updated, error }) => {
          if (error) throw error;
          return updated as Property;
        }),
    );
  }

  deactivateProperty(id: string): Observable<void> {
    return from(
      this.supabase
        .from('properties')
        .update({ is_active: false })
        .eq('id', id)
        .then(({ error }) => {
          if (error) throw error;
        }),
    );
  }

  getSignedCoverPhotoUrl(path: string, expirySeconds = 3600): Observable<string> {
    return from(
      this.supabase.storage
        .from('property-photos')
        .createSignedUrl(path, expirySeconds)
        .then(({ data, error }) => {
          if (error) throw error;
          return data!.signedUrl;
        }),
    );
  }
}
