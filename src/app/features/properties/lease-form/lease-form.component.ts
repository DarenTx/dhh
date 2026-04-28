import {
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
  OnInit,
  output,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Lease, LeaseService, CreateLeaseData } from '../../../core/services/lease.service';
import { StorageService } from '../../../core/services/storage.service';

@Component({
  selector: 'app-lease-form',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule],
  styles: `
    .form-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1rem;
    }

    @media (max-width: 600px) {
      .form-grid {
        grid-template-columns: 1fr;
      }
    }

    .form-group {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }

    .form-group.full-width {
      grid-column: 1 / -1;
    }

    label {
      font-size: 0.875rem;
      font-weight: 600;
      color: #4a5568;
    }

    input,
    select {
      padding: 0.5rem 0.75rem;
      border: 1px solid #e2e8f0;
      border-radius: 0.375rem;
      font-size: 0.9375rem;
      color: #2d3748;
      font-family: inherit;
      background: #fff;

      &:focus {
        outline: none;
        border-color: #4299e1;
        box-shadow: 0 0 0 2px rgb(66 153 225 / 0.2);
      }
    }

    input[type='file'] {
      padding: 0.45rem;
      border-style: dashed;
    }

    .status-toggle {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 0.9375rem;
      color: #2d3748;
      cursor: pointer;
      user-select: none;

      input[type='checkbox'] {
        width: 1rem;
        height: 1rem;
        flex-shrink: 0;
        cursor: pointer;
        padding: 0;
        border: none;
        background: none;
        box-shadow: none;
      }
    }

    .error {
      font-size: 0.8125rem;
      color: #e53e3e;
    }

    .field-hint {
      font-size: 0.75rem;
      color: #718096;
      margin: 0;
    }

    .doc-link {
      font-size: 0.8125rem;
      color: #2b6cb0;
      text-decoration: none;
      width: fit-content;
    }

    .doc-link:hover {
      text-decoration: underline;
    }

    .actions {
      display: flex;
      justify-content: flex-end;
      gap: 0.75rem;
      margin-top: 1.5rem;
    }

    .btn-cancel {
      padding: 0.5rem 1.25rem;
      background: #fff;
      border: 1px solid #e2e8f0;
      border-radius: 0.375rem;
      font-size: 0.9375rem;
      cursor: pointer;
      color: #4a5568;

      &:hover {
        background: #f7fafc;
      }
    }

    .btn-submit {
      padding: 0.5rem 1.25rem;
      background: #2b6cb0;
      color: #fff;
      border: none;
      border-radius: 0.375rem;
      font-size: 0.9375rem;
      font-weight: 500;
      cursor: pointer;

      &:hover:not(:disabled) {
        background: #2c5282;
      }
      &:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
    }
  `,
  template: `
    <form [formGroup]="form" (ngSubmit)="submit()">
      <div class="form-grid">
        <div class="form-group">
          <label for="start">Start date *</label>
          <input id="start" type="date" formControlName="start_date" />
          @if (form.controls.start_date.invalid && form.controls.start_date.touched) {
            <span class="error">Start date is required</span>
          }
        </div>

        <div class="form-group">
          <label for="end">End date</label>
          <input id="end" type="date" formControlName="end_date" />
        </div>

        <div class="form-group">
          <label for="rent">Monthly rent *</label>
          <input id="rent" type="number" min="0" step="0.01" formControlName="monthly_rent" />
          @if (form.controls.monthly_rent.invalid && form.controls.monthly_rent.touched) {
            <span class="error">Monthly rent is required</span>
          }
        </div>

        <div class="form-group">
          <label for="deposit">Security deposit *</label>
          <input
            id="deposit"
            type="number"
            min="0"
            step="0.01"
            formControlName="security_deposit"
          />
          @if (form.controls.security_deposit.invalid && form.controls.security_deposit.touched) {
            <span class="error">Security deposit is required</span>
          }
        </div>

        <div class="form-group">
          <label>Status</label>
          <label class="status-toggle">
            <input type="checkbox" formControlName="status" />
            Active
          </label>
        </div>

        <div class="form-group full-width">
          <label for="doc-upload">Lease document</label>
          <input
            id="doc-upload"
            type="file"
            accept="application/pdf,.pdf"
            (change)="onDocumentSelected($event)"
          />
          @if (selectedDocumentName()) {
            <p class="field-hint">Selected file: {{ selectedDocumentName() }}</p>
          }
          @if (existingDocumentUrl()) {
            <a class="doc-link" [href]="existingDocumentUrl()" target="_blank" rel="noopener">
              View current lease document
            </a>
          }
        </div>
      </div>

      @if (serverError()) {
        <p class="error" style="margin-top: 0.75rem">{{ serverError() }}</p>
      }

      <div class="actions">
        <button type="button" class="btn-cancel" (click)="cancelled.emit()">Cancel</button>
        <button type="submit" class="btn-submit" [disabled]="saving()">
          {{ saving() ? 'Saving…' : lease() ? 'Save changes' : 'Create lease' }}
        </button>
      </div>
    </form>
  `,
})
export class LeaseFormComponent implements OnInit {
  readonly lease = input<Lease | null>(null);
  readonly propertyId = input.required<string>();
  readonly saved = output<Lease>();
  readonly cancelled = output<void>();

  readonly saving = signal(false);
  readonly serverError = signal<string | null>(null);
  readonly selectedDocumentName = signal<string | null>(null);
  readonly existingDocumentUrl = signal<string | null>(null);
  private selectedDocument: File | null = null;

  private readonly fb = inject(FormBuilder);
  private readonly leaseService = inject(LeaseService);
  private readonly storage = inject(StorageService);

  readonly form = this.fb.group({
    start_date: ['', Validators.required],
    end_date: [''],
    monthly_rent: [null as number | null, Validators.required],
    security_deposit: [null as number | null, Validators.required],
    status: [true],
    document_url: [''],
  });

  ngOnInit(): void {
    const l = this.lease();
    if (l) {
      this.form.patchValue({
        start_date: l.start_date,
        end_date: l.end_date ?? '',
        monthly_rent: l.monthly_rent,
        security_deposit: l.security_deposit,
        status: l.status === 'active',
        document_url: l.document_url ?? '',
      });

      if (l.document_url) {
        if (/^https?:\/\//i.test(l.document_url)) {
          this.existingDocumentUrl.set(l.document_url);
        } else {
          this.storage.getSignedUrl('lease-documents', l.document_url).subscribe({
            next: (url) => this.existingDocumentUrl.set(url),
            error: () => this.existingDocumentUrl.set(null),
          });
        }
      }
    }
  }

  onDocumentSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;

    if (file && !isPdfFile(file)) {
      this.selectedDocument = null;
      this.selectedDocumentName.set(null);
      this.serverError.set('Only PDF files are supported for lease documents.');
      input.value = '';
      return;
    }

    this.serverError.set(null);
    this.selectedDocument = file;
    this.selectedDocumentName.set(file?.name ?? null);
  }

  submit(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.saving()) return;

    const raw = this.form.getRawValue();
    const data: CreateLeaseData = {
      property_id: this.propertyId(),
      start_date: raw.start_date!,
      end_date: raw.end_date || null,
      monthly_rent: raw.monthly_rent!,
      security_deposit: raw.security_deposit!,
      status: (raw.status ? 'active' : 'inactive') as Lease['status'],
      document_url: raw.document_url || null,
    };

    this.saving.set(true);
    this.serverError.set(null);

    const existing = this.lease();

    const persistLease = (documentPath: string | null): void => {
      const payload = { ...data, document_url: documentPath };
      const save$ = existing
        ? this.leaseService.updateLease(existing.id, payload)
        : this.leaseService.createLease(payload);

      save$.subscribe({
        next: (saved) => {
          this.saving.set(false);
          this.saved.emit(saved);
        },
        error: (err: Error) => {
          this.saving.set(false);
          this.serverError.set(err.message ?? 'An error occurred.');
        },
      });
    };

    if (this.selectedDocument) {
      this.storage
        .uploadLeaseDocument(
          this.propertyId(),
          this.selectedDocument,
          existing?.id,
          existing?.document_url ?? null,
        )
        .subscribe({
          next: (path) => persistLease(path),
          error: (err: Error) => {
            this.saving.set(false);
            this.serverError.set(err.message ?? 'Failed to upload lease document.');
          },
        });
      return;
    }

    persistLease(raw.document_url || null);
  }
}

function isPdfFile(file: File): boolean {
  return file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
}
