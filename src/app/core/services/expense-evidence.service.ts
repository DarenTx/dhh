import { inject, Injectable } from '@angular/core';
import { SupabaseClient } from '@supabase/supabase-js';
import { from, Observable } from 'rxjs';
import { SUPABASE_CLIENT } from '../auth/supabase.provider';

export interface ExpenseEvidence {
  id: string;
  expense_id: string;
  storage_path: string;
  file_name: string;
  mime_type: string;
  uploaded_by: string | null;
  created_at: string;
}

@Injectable({ providedIn: 'root' })
export class ExpenseEvidenceService {
  private readonly supabase = inject<SupabaseClient>(SUPABASE_CLIENT);

  private readonly bucket = 'expense-evidence';

  getEvidenceForExpense(expenseId: string): Observable<ExpenseEvidence[]> {
    return from(
      this.supabase
        .from('expense_evidence')
        .select('*')
        .eq('expense_id', expenseId)
        .order('created_at', { ascending: true })
        .then(({ data, error }) => {
          if (error) throw error;
          return (data ?? []) as ExpenseEvidence[];
        }),
    );
  }

  uploadEvidence(expenseId: string, file: File): Observable<ExpenseEvidence> {
    const ext = file.name.split('.').pop();
    const storagePath = `${expenseId}/${crypto.randomUUID()}.${ext}`;
    return from(
      this.supabase.storage
        .from(this.bucket)
        .upload(storagePath, file)
        .then(async ({ data, error }) => {
          if (error) throw error;
          const { data: row, error: dbError } = await this.supabase
            .from('expense_evidence')
            .insert({
              expense_id: expenseId,
              storage_path: data!.path,
              file_name: file.name,
              mime_type: file.type,
            })
            .select()
            .single();
          if (dbError) throw dbError;
          return row as ExpenseEvidence;
        }),
    );
  }

  uploadDraftEvidence(file: File): Observable<string> {
    const ext = file.name.split('.').pop();
    const storagePath = `draft/${crypto.randomUUID()}.${ext}`;
    return from(
      this.supabase.storage
        .from(this.bucket)
        .upload(storagePath, file)
        .then(({ data, error }) => {
          if (error) throw error;
          return data!.path;
        }),
    );
  }

  deleteEvidence(id: string, storagePath: string): Observable<void> {
    return from(
      this.supabase.storage
        .from(this.bucket)
        .remove([storagePath])
        .then(async ({ error }) => {
          if (error) throw error;
          const { error: dbError } = await this.supabase
            .from('expense_evidence')
            .delete()
            .eq('id', id);
          if (dbError) throw dbError;
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

  getSignedUrl(storagePath: string, expirySeconds = 3600): Observable<string> {
    return from(
      this.supabase.storage
        .from(this.bucket)
        .createSignedUrl(storagePath, expirySeconds)
        .then(({ data, error }) => {
          if (error) throw error;
          return data!.signedUrl;
        }),
    );
  }
}
