import { inject, Injectable } from '@angular/core';
import { SupabaseClient } from '@supabase/supabase-js';
import { from, Observable, switchMap } from 'rxjs';
import { SUPABASE_CLIENT } from '../auth/supabase.provider';
import { DocumentStorageService } from './document-storage.service';

export interface Document {
  id: string;
  title: string;
  description: string | null;
  property_id: string | null;
  storage_path: string;
  uploaded_by: string;
  created_at: string;
  updated_at: string;
  is_active: boolean;
}

export interface DocumentWithProperty extends Document {
  property?: { id: string; address_line1: string } | null;
}

export type CreateDocumentPayload = Pick<
  Document,
  'title' | 'description' | 'property_id' | 'storage_path'
>;

export type UpdateDocumentPayload = Partial<
  Pick<Document, 'title' | 'description' | 'property_id'>
>;

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

@Injectable({ providedIn: 'root' })
export class DocumentService {
  private readonly supabase = inject<SupabaseClient>(SUPABASE_CLIENT);
  private readonly storage = inject(DocumentStorageService);

  getAll(): Observable<DocumentWithProperty[]> {
    return from(
      this.supabase
        .from('documents')
        .select('*, property:properties(id, address_line1)')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .then(({ data, error }) => {
          if (error) throw error;
          return (data ?? []) as DocumentWithProperty[];
        }),
    );
  }

  getByProperty(propertyId: string): Observable<DocumentWithProperty[]> {
    return from(
      this.supabase
        .from('documents')
        .select('*, property:properties(id, address_line1)')
        .eq('is_active', true)
        .eq('property_id', propertyId)
        .order('created_at', { ascending: false })
        .then(({ data, error }) => {
          if (error) throw error;
          return (data ?? []) as DocumentWithProperty[];
        }),
    );
  }

  create(payload: CreateDocumentPayload): Observable<Document> {
    return from(
      this.supabase.auth.getUser().then(({ data: { user } }) => {
        if (!user) throw new Error('Not authenticated');
        return this.supabase
          .from('documents')
          .insert({ ...payload, uploaded_by: user.id })
          .select()
          .single()
          .then(({ data, error }) => {
            if (error) throw error;
            return data as Document;
          });
      }),
    );
  }

  updateMetadata(id: string, patch: UpdateDocumentPayload): Observable<void> {
    return from(
      this.supabase
        .from('documents')
        .update(patch)
        .eq('id', id)
        .then(({ error }) => {
          if (error) throw error;
        }),
    );
  }

  finalizeDocumentPath(id: string, storagePath: string): Observable<void> {
    return from(
      this.supabase
        .from('documents')
        .update({ storage_path: storagePath })
        .eq('id', id)
        .then(({ error }) => {
          if (error) throw error;
        }),
    );
  }

  delete(id: string, createdAt: string, storagePath: string): Observable<void> {
    const ageMs = Date.now() - new Date(createdAt).getTime();
    if (ageMs < TWENTY_FOUR_HOURS_MS) {
      return this._hardDelete(id, storagePath);
    }
    return this._softDelete(id);
  }

  private _hardDelete(id: string, storagePath: string): Observable<void> {
    return this.storage.deleteStorageObject(storagePath).pipe(
      switchMap(() =>
        from(
          this.supabase
            .from('documents')
            .delete()
            .eq('id', id)
            .then(({ error }) => {
              if (error) throw error;
            }),
        ),
      ),
    );
  }

  private _softDelete(id: string): Observable<void> {
    return from(
      this.supabase
        .from('documents')
        .update({ is_active: false, deleted_at: new Date().toISOString() })
        .eq('id', id)
        .then(({ error }) => {
          if (error) throw error;
        }),
    );
  }
}
