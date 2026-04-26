import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  inject,
  OnInit,
  Output,
  signal,
} from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { NgIconComponent } from '@ng-icons/core';
import { ExpenseService, CreateExpensePayload, Expense } from '../../../core/services/expense.service';
import { ExpenseEvidenceService } from '../../../core/services/expense-evidence.service';
import { SettingsService, IrsCategory, ExpenseSubcategory } from '../../../core/services/settings.service';
import { PropertyService, Property } from '../../../core/services/property.service';

@Component({
  selector: 'app-expense-form',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, NgIconComponent],
  styles: `
    .form { display: flex; flex-direction: column; gap: 1rem; }

    .field { display: flex; flex-direction: column; gap: 0.375rem; }
    label { font-size: 0.875rem; font-weight: 500; color: #4a5568; }

    input, select, textarea {
      padding: 0.5rem 0.75rem;
      border: 1px solid #e2e8f0;
      border-radius: 0.375rem;
      font-size: 0.9375rem;
      color: #2d3748;
      background: #fff;
      width: 100%;
      box-sizing: border-box;
      &:focus { outline: 2px solid #3182ce; outline-offset: -1px; }
    }
    textarea { resize: vertical; min-height: 4rem; }

    .row { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }

    .error-msg { font-size: 0.8125rem; color: #e53e3e; }

    .evidence-section { display: flex; flex-direction: column; gap: 0.5rem; }
    .evidence-title { font-size: 0.875rem; font-weight: 500; color: #4a5568; }
    .evidence-req { font-size: 0.8125rem; color: #718096; }
    .evidence-list { display: flex; flex-direction: column; gap: 0.375rem; }
    .evidence-item {
      display: flex; align-items: center; justify-content: space-between;
      background: #f7fafc; border: 1px solid #e2e8f0; border-radius: 0.375rem;
      padding: 0.375rem 0.625rem; font-size: 0.875rem;
    }
    .evidence-remove {
      background: none; border: none; cursor: pointer; color: #e53e3e;
      padding: 0; display: flex; align-items: center;
    }
    .upload-btn {
      display: flex; align-items: center; gap: 0.375rem;
      padding: 0.375rem 0.75rem; border: 1px dashed #cbd5e0;
      border-radius: 0.375rem; background: #f7fafc; cursor: pointer;
      font-size: 0.875rem; color: #4a5568; width: fit-content;
    }

    .actions {
      display: flex; gap: 0.75rem; justify-content: flex-end; padding-top: 0.5rem;
      border-top: 1px solid #e2e8f0; margin-top: 0.5rem;
    }
    .btn-cancel {
      padding: 0.5rem 1rem; border: 1px solid #e2e8f0; border-radius: 0.375rem;
      background: #fff; color: #4a5568; font-size: 0.9375rem; cursor: pointer;
    }
    .btn-submit {
      padding: 0.5rem 1.25rem; background: #2b6cb0; color: #fff; border: none;
      border-radius: 0.375rem; font-size: 0.9375rem; font-weight: 500; cursor: pointer;
      &:disabled { opacity: 0.5; cursor: not-allowed; }
    }
    .server-error { padding: 0.625rem; background: #fff5f5; border: 1px solid #feb2b2;
      border-radius: 0.375rem; color: #c53030; font-size: 0.875rem; }
  `,
  template: `
    @if (serverError()) {
      <p class="server-error">{{ serverError() }}</p>
    }

    <form class="form" [formGroup]="form" (ngSubmit)="submit()">
      <div class="row">
        <div class="field">
          <label for="date">Date *</label>
          <input id="date" type="date" formControlName="date" />
          @if (form.get('date')?.touched && form.get('date')?.hasError('required')) {
            <span class="error-msg">Date is required.</span>
          }
        </div>
        <div class="field">
          <label for="amount">Amount ($) *</label>
          <input id="amount" type="number" step="0.01" min="0.01" formControlName="amount" placeholder="0.00" />
          @if (form.get('amount')?.touched && form.get('amount')?.hasError('required')) {
            <span class="error-msg">Amount is required.</span>
          }
          @if (form.get('amount')?.touched && form.get('amount')?.hasError('min')) {
            <span class="error-msg">Amount must be greater than 0.</span>
          }
        </div>
      </div>

      <div class="field">
        <label for="description">Description *</label>
        <textarea id="description" formControlName="description" rows="2"></textarea>
        @if (form.get('description')?.touched && form.get('description')?.hasError('required')) {
          <span class="error-msg">Description is required.</span>
        }
      </div>

      <div class="row">
        <div class="field">
          <label for="irs_category_id">IRS Category *</label>
          <select id="irs_category_id" formControlName="irs_category_id" (change)="onCategoryChange()">
            <option value="">Select category…</option>
            @for (cat of categories(); track cat.id) {
              <option [value]="cat.id">{{ cat.name }}</option>
            }
          </select>
        </div>
        <div class="field">
          <label for="subcategory_id">Sub-category *</label>
          <select id="subcategory_id" formControlName="subcategory_id">
            <option value="">Select sub-category…</option>
            @for (sub of subcategories(); track sub.id) {
              <option [value]="sub.id">{{ sub.name }}</option>
            }
          </select>
          @if (form.get('subcategory_id')?.touched && form.get('subcategory_id')?.hasError('required')) {
            <span class="error-msg">Sub-category is required.</span>
          }
        </div>
      </div>

      <div class="field">
        <label for="property_id">Property (optional)</label>
        <select id="property_id" formControlName="property_id">
          <option value="">All / LLC-wide</option>
          @for (prop of properties(); track prop.id) {
            <option [value]="prop.id">{{ prop.address_line1 }}</option>
          }
        </select>
      </div>

      <div class="evidence-section">
        <div class="evidence-title">
          Supporting Evidence *
          <span class="evidence-req">&nbsp;(at least 1 file required)</span>
        </div>
        <div class="evidence-list">
          @for (f of pendingFiles(); track $index) {
            <div class="evidence-item">
              <span>{{ f.name }}</span>
              <button type="button" class="evidence-remove" (click)="removeFile($index)" aria-label="Remove">
                <ng-icon name="heroXMark" size="16" />
              </button>
            </div>
          }
        </div>
        <label class="upload-btn">
          <ng-icon name="heroPaperClip" size="16" />
          Attach file
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic,application/pdf"
            style="display:none"
            multiple
            (change)="onFileSelected($event)"
          />
        </label>
        @if (evidenceError()) {
          <span class="error-msg">{{ evidenceError() }}</span>
        }
      </div>

      <div class="actions">
        <button type="button" class="btn-cancel" (click)="cancelled.emit()">Cancel</button>
        <button type="submit" class="btn-submit" [disabled]="saving()">
          {{ saving() ? 'Saving…' : 'Log Expense' }}
        </button>
      </div>
    </form>
  `,
})
export class ExpenseFormComponent implements OnInit {
  @Output() saved = new EventEmitter<Expense>();
  @Output() cancelled = new EventEmitter<void>();

  private readonly expenseService = inject(ExpenseService);
  private readonly evidenceService = inject(ExpenseEvidenceService);
  private readonly settingsService = inject(SettingsService);
  private readonly propertyService = inject(PropertyService);

  readonly categories = signal<IrsCategory[]>([]);
  readonly subcategories = signal<ExpenseSubcategory[]>([]);
  readonly properties = signal<Property[]>([]);
  readonly pendingFiles = signal<File[]>([]);
  readonly saving = signal(false);
  readonly serverError = signal<string | null>(null);
  readonly evidenceError = signal<string | null>(null);

  readonly form = new FormGroup({
    date: new FormControl(new Date().toISOString().slice(0, 10), Validators.required),
    amount: new FormControl<number | null>(null, [Validators.required, Validators.min(0.01)]),
    description: new FormControl('', Validators.required),
    irs_category_id: new FormControl('', Validators.required),
    subcategory_id: new FormControl('', Validators.required),
    property_id: new FormControl(''),
  });

  ngOnInit(): void {
    this.settingsService.getCategories().subscribe((cats) => this.categories.set(cats));
    this.propertyService.getProperties().subscribe((props) => this.properties.set(props));
  }

  onCategoryChange(): void {
    const catId = Number(this.form.get('irs_category_id')?.value);
    this.form.get('subcategory_id')?.setValue('');
    this.subcategories.set([]);
    if (catId) {
      this.settingsService
        .getSubcategories(catId)
        .subscribe((subs) => this.subcategories.set(subs));
    }
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files) return;
    this.pendingFiles.update((prev) => [...prev, ...Array.from(input.files!)]);
    input.value = '';
  }

  removeFile(index: number): void {
    this.pendingFiles.update((prev) => prev.filter((_, i) => i !== index));
  }

  submit(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;

    if (this.pendingFiles().length === 0) {
      this.evidenceError.set('At least one file is required.');
      return;
    }
    this.evidenceError.set(null);

    const value = this.form.getRawValue();
    const payload: CreateExpensePayload = {
      date: value.date!,
      amount: Number(value.amount),
      description: value.description!,
      irs_category_id: Number(value.irs_category_id),
      subcategory_id: value.subcategory_id!,
      ...(value.property_id ? { property_id: value.property_id } : {}),
    };

    this.saving.set(true);
    this.serverError.set(null);

    this.expenseService.createExpense(payload).subscribe({
      next: (expense) => {
        const uploads = this.pendingFiles().map((f) =>
          this.evidenceService.uploadEvidence(expense.id, f),
        );
        let remaining = uploads.length;
        uploads.forEach((obs) => {
          obs.subscribe({
            next: () => {
              remaining--;
              if (remaining === 0) {
                this.saving.set(false);
                this.saved.emit(expense);
              }
            },
            error: (err) => {
              this.saving.set(false);
              this.serverError.set(err?.message ?? 'Failed to upload evidence.');
            },
          });
        });
      },
      error: (err) => {
        this.saving.set(false);
        this.serverError.set(err?.message ?? 'Failed to save expense.');
      },
    });
  }
}
