import { inject, Injectable } from '@angular/core';
import { SupabaseClient } from '@supabase/supabase-js';
import { from, Observable, switchMap } from 'rxjs';
import { SUPABASE_CLIENT } from '../auth/supabase.provider';
import {
  Inspection,
  InspectionRoom,
  InspectionType,
  InspectionWithRollup,
  generateRooms,
} from '../../features/inspections/inspection.types';

@Injectable({ providedIn: 'root' })
export class InspectionService {
  private readonly supabase = inject<SupabaseClient>(SUPABASE_CLIENT);

  getInspectionsForProperty(propertyId: string): Observable<InspectionWithRollup[]> {
    return from(
      this.supabase
        .from('inspections')
        .select('*')
        .eq('property_id', propertyId)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .then(({ data, error }) => {
          if (error) throw error;
          return (data ?? []).map((row: any) => ({
            ...row,
            photoCount: 0,
            unresolvedActionableCount: 0,
            coverPhotoUrl: null,
          })) as InspectionWithRollup[];
        }),
    ).pipe(
      switchMap((inspections) => {
        if (inspections.length === 0) return from(Promise.resolve(inspections));
        const ids = inspections.map((i) => i.id);
        return from(
          this.supabase
            .from('inspection_photos')
            .select('inspection_id, is_actionable, is_resolved')
            .in('inspection_id', ids)
            .then(({ data: allPhotos, error: allErr }) => {
              if (allErr) throw allErr;

              const photoMap = new Map<string, number>();
              const unresolvedMap = new Map<string, number>();
              for (const row of allPhotos ?? []) {
                const iid = (row as any).inspection_id as string;
                photoMap.set(iid, (photoMap.get(iid) ?? 0) + 1);
                if ((row as any).is_actionable && !(row as any).is_resolved) {
                  unresolvedMap.set(iid, (unresolvedMap.get(iid) ?? 0) + 1);
                }
              }

              return inspections.map((insp) => ({
                ...insp,
                photoCount: photoMap.get(insp.id) ?? 0,
                unresolvedActionableCount: unresolvedMap.get(insp.id) ?? 0,
              }));
            }),
        );
      }),
    );
  }

  getInspection(id: string): Observable<Inspection> {
    return from(
      this.supabase
        .from('inspections')
        .select('*')
        .eq('id', id)
        .single()
        .then(({ data, error }) => {
          if (error) throw error;
          return data as Inspection;
        }),
    );
  }

  getInspectionWithRooms(
    id: string,
  ): Observable<{ inspection: Inspection; rooms: InspectionRoom[] }> {
    return from(
      this.supabase
        .from('inspections')
        .select('*, inspection_rooms(*)')
        .eq('id', id)
        .single()
        .then(({ data, error }) => {
          if (error) throw error;
          const { inspection_rooms, ...rest } = data as any;
          const rooms = ((inspection_rooms as InspectionRoom[]) ?? []).sort(
            (a, b) => a.sort_order - b.sort_order,
          );
          return { inspection: rest as Inspection, rooms };
        }),
    );
  }

  createInspection(
    propertyId: string,
    leaseId: string | null,
    title: string,
    type: InspectionType,
    bedrooms: number | null,
    bathrooms: number | null,
  ): Observable<Inspection> {
    return from(
      this.supabase
        .from('inspections')
        .insert({ property_id: propertyId, lease_id: leaseId, title, inspection_type: type })
        .select()
        .single()
        .then(({ data, error }) => {
          if (error) throw error;
          return data as Inspection;
        }),
    ).pipe(
      switchMap((inspection) =>
        this.createRoomsForInspection(inspection.id, bedrooms, bathrooms).pipe(
          switchMap(() => from(Promise.resolve(inspection))),
        ),
      ),
    );
  }

  createRoomsForInspection(
    inspectionId: string,
    bedrooms: number | null,
    bathrooms: number | null,
  ): Observable<void> {
    const rooms = generateRooms(bedrooms, bathrooms).map((r) => ({
      inspection_id: inspectionId,
      ...r,
    }));
    return from(
      this.supabase
        .from('inspection_rooms')
        .upsert(rooms, { onConflict: 'inspection_id,room_type', ignoreDuplicates: true })
        .then(({ error }) => {
          if (error) throw error;
        }),
    );
  }

  updateInspection(
    id: string,
    patch: Partial<Pick<Inspection, 'title' | 'inspection_type' | 'cover_photo_id'>>,
  ): Observable<Inspection> {
    return from(
      this.supabase
        .from('inspections')
        .update(patch)
        .eq('id', id)
        .select()
        .single()
        .then(({ data, error }) => {
          if (error) throw error;
          return data as Inspection;
        }),
    );
  }

  endInspection(id: string): Observable<void> {
    return from(Promise.resolve());
  }

  setCoverPhoto(inspectionId: string, photoId: string): Observable<void> {
    return from(
      this.supabase
        .from('inspections')
        .update({ cover_photo_id: photoId })
        .eq('id', inspectionId)
        .then(({ error }) => {
          if (error) throw error;
        }),
    );
  }

  softDeleteInspection(id: string, deletedBy: string): Observable<void> {
    return from(
      this.supabase
        .from('inspections')
        .update({ is_active: false, deleted_at: new Date().toISOString(), deleted_by: deletedBy })
        .eq('id', id)
        .then(({ error }) => {
          if (error) throw error;
        }),
    );
  }

  /** Fetches all photo storage paths, deletes from bucket, then hard-deletes the DB row (cascade handles children). */
  hardDeleteInspection(
    id: string,
    deleteStorageFn: (paths: string[]) => Observable<void>,
  ): Observable<void> {
    return from(
      this.supabase
        .from('inspection_photos')
        .select('storage_path')
        .eq('inspection_id', id)
        .then(({ data, error }) => {
          if (error) throw error;
          return (data ?? []).map((r: any) => r.storage_path as string);
        }),
    ).pipe(
      switchMap((paths) => {
        const storageDel = paths.length > 0 ? deleteStorageFn(paths) : from(Promise.resolve());
        return storageDel.pipe(
          switchMap(() =>
            from(
              this.supabase
                .from('inspections')
                .delete()
                .eq('id', id)
                .then(({ error }) => {
                  if (error) throw error;
                }),
            ),
          ),
        );
      }),
    );
  }
}
