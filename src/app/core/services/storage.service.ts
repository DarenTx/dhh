import { inject, Injectable } from '@angular/core';
import { SupabaseClient } from '@supabase/supabase-js';
import { from, Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { SUPABASE_CLIENT } from '../auth/supabase.provider';

@Injectable({ providedIn: 'root' })
export class StorageService {
  private readonly supabase = inject<SupabaseClient>(SUPABASE_CLIENT);

  uploadLeaseDocument(
    propertyId: string,
    file: File,
    leaseId?: string,
    existingPath?: string | null,
  ): Observable<string> {
    if (existingPath && !/^https?:\/\//i.test(existingPath)) {
      return from(
        this.supabase.storage
          .from('lease-documents')
          .upload(existingPath, file, { upsert: true })
          .then(({ data, error }) => {
            if (error) throw error;
            return data!.path;
          }),
      );
    }

    const extension = file.name.includes('.') ? file.name.split('.').pop() : 'pdf';
    const path = leaseId
      ? `${propertyId}/${leaseId}/lease.${extension}`
      : `${propertyId}/draft-${crypto.randomUUID()}.${extension}`;

    return from(
      this.supabase.storage
        .from('lease-documents')
        .upload(path, file, { upsert: !!leaseId })
        .then(({ data, error }) => {
          if (error) throw error;
          return data!.path;
        }),
    );
  }

  uploadPropertyCoverPhoto(propertyId: string, file: File): Observable<string> {
    const ext = file.name.split('.').pop();
    const path = `${propertyId}/cover.${ext}`;
    return from(
      this.supabase.storage
        .from('property-photos')
        .upload(path, file, { upsert: true })
        .then(({ data, error }) => {
          if (error) throw error;
          return data!.path;
        }),
    );
  }

  deletePropertyCoverPhoto(path: string): Observable<void> {
    return from(
      this.supabase.storage
        .from('property-photos')
        .remove([path])
        .then(({ error }) => {
          if (error) throw error;
        }),
    );
  }

  getSignedUrl(bucket: string, path: string, expirySeconds = 3600): Observable<string> {
    return from(
      this.supabase.storage
        .from(bucket)
        .createSignedUrl(path, expirySeconds)
        .then(({ data, error }) => {
          if (error) throw error;
          return data!.signedUrl;
        }),
    );
  }
}
