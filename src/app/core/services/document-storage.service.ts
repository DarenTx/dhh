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
    const contentType = file.type || mimeFromExt(ext);
    const storagePath = `drafts/${crypto.randomUUID()}.${ext}`;
    return from(
      this.supabase.storage
        .from(this.bucket)
        .upload(storagePath, file, { contentType })
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

function mimeFromExt(ext: string): string {
  const map: Record<string, string> = {
    pdf: 'application/pdf',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    webp: 'image/webp',
    heic: 'image/heic',
  };
  return map[ext.toLowerCase()] ?? 'application/octet-stream';
}
