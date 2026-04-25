import { inject, Injectable } from '@angular/core';
import { SupabaseClient } from '@supabase/supabase-js';
import { from, Observable } from 'rxjs';
import { SUPABASE_CLIENT } from '../auth/supabase.provider';

export type NoteEntityType = 'property' | 'tenant' | 'lease';

export interface Note {
  id: string;
  property_id: string | null;
  tenant_id: string | null;
  lease_id: string | null;
  content: string;
  is_active: boolean;
  created_by: string | null;
  created_by_email: string | null;
  created_at: string;
  updated_at: string;
}

@Injectable({ providedIn: 'root' })
export class NotesService {
  private readonly supabase = inject<SupabaseClient>(SUPABASE_CLIENT);

  getNotes(entityType: NoteEntityType, entityId: string): Observable<Note[]> {
    const column = `${entityType}_id` as 'property_id' | 'tenant_id' | 'lease_id';
    return from(
      this.supabase
        .from('notes')
        .select('*')
        .eq(column, entityId)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .then(({ data, error }) => {
          if (error) throw error;
          return (data ?? []) as Note[];
        }),
    );
  }

  createNote(
    entityType: NoteEntityType,
    entityId: string,
    content: string,
    authorEmail: string,
  ): Observable<Note> {
    const column = `${entityType}_id` as 'property_id' | 'tenant_id' | 'lease_id';
    return from(
      this.supabase
        .from('notes')
        .insert({
          [column]: entityId,
          content,
          created_by_email: authorEmail,
        })
        .select()
        .single()
        .then(({ data, error }) => {
          if (error) throw error;
          return data as Note;
        }),
    );
  }

  /** Notes are never hard-deleted — only deactivated. */
  deactivateNote(id: string): Observable<void> {
    return from(
      this.supabase
        .from('notes')
        .update({ is_active: false })
        .eq('id', id)
        .then(({ error }) => {
          if (error) throw error;
        }),
    );
  }
}
