import { inject, Injectable } from '@angular/core';
import { SupabaseClient } from '@supabase/supabase-js';
import { from, Observable, switchMap } from 'rxjs';
import { SUPABASE_CLIENT } from '../auth/supabase.provider';
import {
  InspectionPhoto,
  InspectionTag,
  canonicalType,
} from '../../features/inspections/inspection.types';

@Injectable({ providedIn: 'root' })
export class InspectionPhotoService {
  private readonly supabase = inject<SupabaseClient>(SUPABASE_CLIENT);

  getPhotosForRoom(roomId: string): Observable<InspectionPhoto[]> {
    return from(
      this.supabase
        .from('inspection_photos')
        .select(
          `*,
          inspection_photo_tags(
            tag_id,
            inspection_tags(id, room_type, name, is_active, created_at)
          )`,
        )
        .eq('room_id', roomId)
        .order('created_at', { ascending: true })
        .then(({ data, error }) => {
          if (error) throw error;
          return (data ?? []).map((row: any) => {
            const tags: InspectionTag[] = (row.inspection_photo_tags ?? [])
              .map((pt: any) => pt.inspection_tags)
              .filter(Boolean);
            const { inspection_photo_tags: _, ...rest } = row;
            return { ...rest, tags } as InspectionPhoto;
          });
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
    patch: Partial<Pick<InspectionPhoto, 'description' | 'is_actionable' | 'is_resolved'>>,
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

  /** Atomically replaces all tags on a photo via the set_photo_tags RPC. */
  setTags(photoId: string, tagIds: string[]): Observable<void> {
    return from(
      this.supabase
        .rpc('set_photo_tags', { p_photo_id: photoId, p_tag_ids: tagIds })
        .then(({ error }) => {
          if (error) throw error;
        }),
    );
  }

  /** Returns active tags for the canonical room type (strips numeric suffix). */
  getTagsForRoomType(roomType: string): Observable<InspectionTag[]> {
    const canonical = canonicalType(roomType);
    return from(
      this.supabase
        .from('inspection_tags')
        .select('id, room_type, name, is_active, created_at')
        .eq('room_type', canonical)
        .eq('is_active', true)
        .order('name')
        .then(({ data, error }) => {
          if (error) throw error;
          return (data ?? []) as InspectionTag[];
        }),
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
