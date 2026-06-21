import { inject, Injectable } from '@angular/core';
import { SupabaseClient } from '@supabase/supabase-js';
import { from, Observable } from 'rxjs';
import { SUPABASE_CLIENT } from '../auth/supabase.provider';

@Injectable({ providedIn: 'root' })
export class DocumentStorageService {
  private readonly supabase = inject<SupabaseClient>(SUPABASE_CLIENT);
  private readonly bucket = 'documents';

  uploadDraft(file: File): Observable<string> {
    const ext = file.name.includes('.') ? file.name.split('.').pop()! : 'bin';
    const storagePath = `drafts/${crypto.randomUUID()}.${ext}`;
    return from(
      this.supabase.storage
        .from(this.bucket)
        .upload(storagePath, file, { contentType: file.type })
        .then(({ data, error }) => {
          if (error) throw error;
          return data!.path;
        }),
    );
  }

  finalizeUpload(draftPath: string, documentId: string, originalName: string): Observable<string> {
    const ext = originalName.includes('.')
      ? originalName.split('.').pop()!
      : (draftPath.split('.').pop() ?? 'bin');
    const permanentPath = `documents/${documentId}/${crypto.randomUUID()}.${ext}`;
    return from(
      this.supabase.storage
        .from(this.bucket)
        .move(draftPath, permanentPath)
        .then(({ error }) => {
          if (error) throw error;
          return permanentPath;
        }),
    );
  }

  deleteStorageObject(storagePath: string): Observable<void> {
    return from(
      this.supabase.storage
        .from(this.bucket)
        .remove([storagePath])
        .then(({ error }) => {
          if (error) throw error;
        }),
    );
  }

  getSignedUrl(storagePath: string): Observable<string> {
    return from(
      this.supabase.storage
        .from(this.bucket)
        .createSignedUrl(storagePath, 300)
        .then(({ data, error }) => {
          if (error) throw error;
          return data!.signedUrl;
        }),
    );
  }
}
