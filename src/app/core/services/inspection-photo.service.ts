import { inject, Injectable } from '@angular/core';
import { SupabaseClient } from '@supabase/supabase-js';
import { from, Observable, switchMap } from 'rxjs';
import { SUPABASE_CLIENT } from '../auth/supabase.provider';
import { InspectionPhoto } from '../../features/inspections/inspection.types';

@Injectable({ providedIn: 'root' })
export class InspectionPhotoService {
  private readonly supabase = inject<SupabaseClient>(SUPABASE_CLIENT);

  getPhotosForRoom(roomId: string): Observable<InspectionPhoto[]> {
    return from(
      this.supabase
        .from('inspection_photos')
        .select('*')
        .eq('room_id', roomId)
        .order('created_at', { ascending: true })
        .then(({ data, error }) => {
          if (error) throw error;
          return (data ?? []) as InspectionPhoto[];
        }),
    );
  }

  addPhoto(data: {
    inspection_id: string;
    room_id: string;
    storage_path: string;
    file_name: string;
    uploaded_by: string;
  }): Observable<InspectionPhoto> {
    return from(
      this.supabase
        .from('inspection_photos')
        .insert({ ...data, mime_type: 'image/jpeg' })
        .select()
        .single()
        .then(({ data: row, error }) => {
          if (error) throw error;
          return { ...row, tags: [] } as InspectionPhoto;
        }),
    );
  }

  updatePhoto(
    id: string,
    patch: Partial<Pick<InspectionPhoto, 'description' | 'is_flagged'>>,
  ): Observable<void> {
    return from(
      this.supabase
        .from('inspection_photos')
        .update(patch)
        .eq('id', id)
        .then(({ error }) => {
          if (error) throw error;
        }),
    );
  }

  /** Deletes from storage bucket first (via provided fn), then removes DB row. */
  deletePhoto(
    id: string,
    storagePath: string,
    deleteStorageFn: (path: string) => Observable<void>,
  ): Observable<void> {
    return deleteStorageFn(storagePath).pipe(
      switchMap(() =>
        from(
          this.supabase
            .from('inspection_photos')
            .delete()
            .eq('id', id)
            .then(({ error }) => {
              if (error) throw error;
            }),
        ),
      ),
    );
  }

  /** Generate a signed URL for a single inspection photo (1h expiry). */
  getSignedUrl(storagePath: string): Observable<string> {
    return from(
      this.supabase.storage
        .from('inspection-photos')
        .createSignedUrl(storagePath, 3600)
        .then(({ data, error }) => {
          if (error) throw error;
          return data!.signedUrl;
        }),
    );
  }

  /** Batch generate signed URLs for multiple inspection photos. */
  getSignedUrls(storagePaths: string[]): Observable<string[]> {
    if (storagePaths.length === 0) return from(Promise.resolve([]));
    return from(
      this.supabase.storage
        .from('inspection-photos')
        .createSignedUrls(storagePaths, 3600)
        .then(({ data, error }) => {
          if (error) throw error;
          return (data ?? []).map((item: any) => item.signedUrl as string);
        }),
    );
  }
}
