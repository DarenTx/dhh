import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  output,
  signal,
} from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { CurrencyPipe } from '@angular/common';
import { NgIconComponent } from '@ng-icons/core';
import {
  ExpenseService,
  CreateExpensePayload,
  Expense,
} from '../../../core/services/expense.service';
import { ExpenseEvidenceService } from '../../../core/services/expense-evidence.service';
import {
  SettingsService,
  IrsCategory,
  ExpenseSubcategory,
} from '../../../core/services/settings.service';
import { PropertyService, Property } from '../../../core/services/property.service';
import {
  AiExtractionService,
  ExpenseExtractionResult,
} from '../../../core/services/ai-extraction.service';

type WizardStep = 1 | 2 | 3;

@Component({
  selector: 'app-expense-form',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, NgIconComponent, CurrencyPipe],
  styles: `
    .wizard-steps {
      display: flex;
      gap: 0;
      margin-bottom: 1.5rem;
    }

    .step-indicator {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 0.875rem;
      color: #a0aec0;

      &.active {
        color: #2b6cb0;
        font-weight: 600;
      }
      &.done {
        color: #38a169;
      }
    }

    .step-num {
      width: 1.5rem;
      height: 1.5rem;
      border-radius: 50%;
      background: #e2e8f0;
      color: #718096;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.75rem;
      font-weight: 700;

      .active & {
        background: #2b6cb0;
        color: #fff;
      }
      .done & {
        background: #38a169;
        color: #fff;
      }
    }

    .step-sep {
      flex: 1;
      height: 1px;
      background: #e2e8f0;
      margin: 0 0.375rem;
      align-self: center;
    }

    .upload-box {
      border: 1px dashed #a0aec0;
      border-radius: 0.5rem;
      padding: 0.875rem;
      margin-bottom: 1rem;
      background: #f7fafc;
    }

    .upload-box-label {
      font-size: 0.875rem;
      font-weight: 500;
      color: #4a5568;
      margin-bottom: 0.5rem;
      display: block;
    }

    .evidence-list {
      display: flex;
      flex-direction: column;
      gap: 0.375rem;
      margin-bottom: 0.75rem;
    }

    .evidence-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: #fff;
      border: 1px solid #e2e8f0;
      border-radius: 0.375rem;
      padding: 0.375rem 0.625rem;
      font-size: 0.875rem;
    }

    .evidence-remove {
      background: none;
      border: none;
      cursor: pointer;
      color: #e53e3e;
      padding: 0;
      display: flex;
      align-items: center;
    }

    .upload-btn {
      display: flex;
      align-items: center;
      gap: 0.375rem;
      padding: 0.375rem 0.75rem;
      border: 1px dashed #cbd5e0;
      border-radius: 0.375rem;
      background: #fff;
      cursor: pointer;
      font-size: 0.875rem;
      color: #4a5568;
      width: fit-content;
      margin-bottom: 0.75rem;
    }

    .upload-actions {
      display: flex;
      gap: 0.625rem;
      align-items: center;
      flex-wrap: wrap;
      margin-top: 0.5rem;
    }

    .btn-small {
      padding: 0.35rem 0.75rem;
      border: 1px solid #cbd5e0;
      background: #fff;
      color: #2d3748;
      border-radius: 0.375rem;
      font-size: 0.8125rem;
      cursor: pointer;

      &:hover {
        background: #edf2f7;
      }
      &:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }
    }

    .hint {
      font-size: 0.8125rem;
      color: #4a5568;
      margin: 0.375rem 0 0;
    }

    .warn-msg {
      font-size: 0.8125rem;
      color: #b7791f;
    }

    .form {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    .field {
      display: flex;
      flex-direction: column;
      gap: 0.375rem;
    }

    label {
      font-size: 0.875rem;
      font-weight: 500;
      color: #4a5568;
    }

    input,
    select,
    textarea {
      padding: 0.5rem 0.75rem;
      border: 1px solid #e2e8f0;
      border-radius: 0.375rem;
      font-size: 0.9375rem;
      color: #2d3748;
      background: #fff;
      width: 100%;
      box-sizing: border-box;

      &:focus {
        outline: 2px solid #3182ce;
        outline-offset: -1px;
      }

      &.invalid {
        border-color: #e53e3e;
      }
    }

    textarea {
      resize: vertical;
      min-height: 4rem;
    }

    .row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1rem;
    }

    @media (max-width: 480px) {
      .row {
        grid-template-columns: 1fr;
      }
    }

    .error-msg {
      font-size: 0.8125rem;
      color: #e53e3e;
    }

    .review-check {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin-top: 0.75rem;
      font-size: 0.875rem;
      color: #2d3748;
    }

    .confirm-summary {
      background: #f7fafc;
      border: 1px solid #e2e8f0;
      border-radius: 0.5rem;
      padding: 1rem;
      margin-bottom: 1rem;
    }

    .confirm-summary h4 {
      margin: 0 0 0.5rem;
      font-size: 0.9375rem;
      font-weight: 600;
      color: #2d3748;
    }

    .confirm-summary p {
      margin: 0.25rem 0;
      font-size: 0.875rem;
      color: #718096;
    }

    .server-error {
      padding: 0.625rem;
      background: #fff5f5;
      border: 1px solid #feb2b2;
      border-radius: 0.375rem;
      color: #c53030;
      font-size: 0.875rem;
    }

    .btn-row {
      display: flex;
      gap: 0.75rem;
      justify-content: flex-end;
      margin-top: 1.25rem;
    }

    .btn-secondary {
      padding: 0.5rem 1rem;
      background: #edf2f7;
      color: #4a5568;
      border: none;
      border-radius: 0.375rem;
      font-size: 0.9375rem;
      cursor: pointer;

      &:hover {
        background: #e2e8f0;
      }
    }

    .btn-primary {
      padding: 0.5rem 1.25rem;
      background: #2b6cb0;
      color: #fff;
      border: none;
      border-radius: 0.375rem;
      font-size: 0.9375rem;
      font-weight: 500;
      cursor: pointer;

      &:hover {
        background: #2c5282;
      }
      &:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }
    }

    .spinner {
      display: inline-block;
      width: 0.875rem;
      height: 0.875rem;
      border: 2px solid rgba(255, 255, 255, 0.4);
      border-top-color: #fff;
      border-radius: 50%;
      animation: spin 0.7s linear infinite;
      vertical-align: text-bottom;
      margin-right: 0.25rem;
    }

    @keyframes spin {
      to {
        transform: rotate(360deg);
      }
    }
  `,
  template: `
    <div class="wizard-steps">
      <div class="step-indicator" [class.active]="step() === 1" [class.done]="step() > 1">
        <span class="step-num">{{ step() > 1 ? '✓' : '1' }}</span>
        <span>Upload</span>
      </div>
      <div class="step-sep"></div>
      <div class="step-indicator" [class.active]="step() === 2" [class.done]="step() > 2">
        <span class="step-num">{{ step() > 2 ? '✓' : '2' }}</span>
        <span>Expense</span>
      </div>
      <div class="step-sep"></div>
      <div class="step-indicator" [class.active]="step() === 3">
        <span class="step-num">3</span>
        <span>Confirm</span>
      </div>
    </div>

    @if (step() === 1) {
      <div class="upload-box">
        <span class="upload-box-label">Supporting Documents * (at least 1 required)</span>

        <div class="evidence-list">
          @for (f of pendingFiles(); track $index) {
            <div class="evidence-item">
              <span>{{ f.name }}</span>
              <button
                type="button"
                class="evidence-remove"
                (click)="removeFile($index)"
                aria-label="Remove"
              >
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

        @if (extractionError()) {
          <p class="error-msg">{{ extractionError() }}</p>
        }
        @for (w of extractionWarnings(); track w) {
          <p class="warn-msg">{{ w }}</p>
        }
      </div>

      @if (uploadStepError()) {
        <p class="error-msg">{{ uploadStepError() }}</p>
      }

      <div class="btn-row">
        <button type="button" class="btn-secondary" (click)="cancelled.emit()">Cancel</button>
        <button
          type="button"
          class="btn-primary"
          [disabled]="pendingFiles().length === 0 || extractingAi()"
          (click)="proceedFromUpload()"
        >
          @if (extractingAi()) {
            <span class="spinner"></span> Analyzing receipt…
          } @else {
            Next: Review Expense Details
          }
        </button>
      </div>
    }

    @if (step() === 2) {
      <form class="form" [formGroup]="form" (ngSubmit)="submitExpenseForm()">
        <div class="row">
          <div class="field">
            <label for="date">Date *</label>
            <input
              id="date"
              type="date"
              formControlName="date"
              [class.invalid]="form.get('date')?.touched && form.get('date')?.invalid"
            />
            @if (form.get('date')?.touched && form.get('date')?.hasError('required')) {
              <span class="error-msg">Date is required.</span>
            }
          </div>
          <div class="field">
            <label for="amount">Amount ($) *</label>
            <input
              id="amount"
              type="number"
              step="0.01"
              min="0.01"
              formControlName="amount"
              placeholder="0.00"
              [class.invalid]="form.get('amount')?.touched && form.get('amount')?.invalid"
            />
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
          <textarea
            id="description"
            formControlName="description"
            rows="2"
            [class.invalid]="form.get('description')?.touched && form.get('description')?.invalid"
          ></textarea>
          @if (form.get('description')?.touched && form.get('description')?.hasError('required')) {
            <span class="error-msg">Description is required.</span>
          }
        </div>

        <div class="row">
          <div class="field">
            <label for="irs_category_id">IRS Category *</label>
            <select
              id="irs_category_id"
              formControlName="irs_category_id"
              [class.invalid]="
                form.get('irs_category_id')?.touched && form.get('irs_category_id')?.invalid
              "
              (change)="onCategoryChange()"
            >
              <option value="">Select category…</option>
              @for (cat of categories(); track cat.id) {
                <option [value]="cat.id">{{ cat.name }}</option>
              }
            </select>
          </div>
          <div class="field">
            <label for="subcategory_id">Sub-category *</label>
            <select
              id="subcategory_id"
              formControlName="subcategory_id"
              [class.invalid]="
                form.get('subcategory_id')?.touched && form.get('subcategory_id')?.invalid
              "
            >
              <option value="">Select sub-category…</option>
              @for (sub of subcategories(); track sub.id) {
                <option [value]="sub.id">{{ sub.name }}</option>
              }
            </select>
            @if (
              form.get('subcategory_id')?.touched &&
              form.get('subcategory_id')?.hasError('required')
            ) {
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

        <label class="review-check">
          <input
            type="checkbox"
            [checked]="reviewConfirmed()"
            (change)="toggleReviewConfirmed($event)"
          />
          I have reviewed the expense details and they are correct.
        </label>

        @if (expenseFormError()) {
          <p class="error-msg">{{ expenseFormError() }}</p>
        }

        <div class="btn-row">
          <button type="button" class="btn-secondary" (click)="step.set(1)">
            ← Back to Upload
          </button>
          <button type="submit" class="btn-primary">Next: Confirm & Save</button>
        </div>
      </form>
    }

    @if (step() === 3) {
      <div>
        <div class="confirm-summary">
          <h4>Expense Details</h4>
          <p>Date: {{ form.getRawValue().date }}</p>
          <p>Amount: {{ form.getRawValue().amount | currency }}</p>
          <p>Description: {{ form.getRawValue().description }}</p>
          <p>Category: {{ selectedCategoryName() }}</p>
          @if (selectedSubcategoryName()) {
            <p>Sub-category: {{ selectedSubcategoryName() }}</p>
          }
          @if (selectedPropertyName()) {
            <p>Property: {{ selectedPropertyName() }}</p>
          } @else {
            <p>Property: All / LLC-wide</p>
          }
        </div>

        <div class="confirm-summary">
          <h4>Documents ({{ pendingFiles().length }})</h4>
          @for (f of pendingFiles(); track $index) {
            <p>{{ f.name }}</p>
          }
        </div>

        @if (serverError()) {
          <p class="server-error">{{ serverError() }}</p>
        }

        <div class="btn-row">
          <button type="button" class="btn-secondary" (click)="step.set(2)">
            ← Back to Expense
          </button>
          <button class="btn-primary" [disabled]="saving()" (click)="save()">
            {{ saving() ? 'Saving…' : 'Log Expense' }}
          </button>
        </div>
      </div>
    }
  `,
})
export class ExpenseFormComponent implements OnInit {
  readonly saved = output<Expense>();
  readonly cancelled = output<void>();

  private readonly expenseService = inject(ExpenseService);
  private readonly evidenceService = inject(ExpenseEvidenceService);
  private readonly settingsService = inject(SettingsService);
  private readonly propertyService = inject(PropertyService);
  private readonly aiExtractionService = inject(AiExtractionService);

  readonly step = signal<WizardStep>(1);
  readonly categories = signal<IrsCategory[]>([]);
  readonly subcategories = signal<ExpenseSubcategory[]>([]);
  readonly properties = signal<Property[]>([]);
  readonly pendingFiles = signal<File[]>([]);
  readonly saving = signal(false);
  readonly serverError = signal<string | null>(null);
  readonly uploadStepError = signal<string | null>(null);
  readonly expenseFormError = signal<string | null>(null);
  readonly extractingAi = signal(false);
  readonly extractionError = signal<string | null>(null);
  readonly extractionWarnings = signal<string[]>([]);
  readonly reviewConfirmed = signal(false);

  readonly selectedCategoryName = computed(
    () =>
      this.categories().find((c) => String(c.id) === this.form.get('irs_category_id')?.value)
        ?.name ?? '',
  );

  readonly selectedSubcategoryName = computed(
    () =>
      this.subcategories().find((s) => s.id === this.form.get('subcategory_id')?.value)?.name ?? '',
  );

  readonly selectedPropertyName = computed(
    () =>
      this.properties().find((p) => p.id === this.form.get('property_id')?.value)?.address_line1 ??
      '',
  );

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

  proceedFromUpload(): void {
    if (this.pendingFiles().length === 0) {
      this.uploadStepError.set('At least one document is required.');
      return;
    }
    this.uploadStepError.set(null);
    this.extractionError.set(null);
    this.extractionWarnings.set([]);

    const file = this.pendingFiles()[0];
    this.extractingAi.set(true);

    this.evidenceService.uploadDraftEvidence(file).subscribe({
      next: (draftPath) => {
        this.aiExtractionService
          .extractExpense({
            storage_bucket: 'expense-evidence',
            storage_path: draftPath,
            property_id: this.form.get('property_id')?.value || undefined,
          })
          .subscribe({
            next: (result) => {
              this.extractionWarnings.set(result.warnings ?? []);
              this.applyExpenseExtraction(result);
              this.extractingAi.set(false);
              this.evidenceService.deleteStorageObject(draftPath).subscribe({
                next: () => undefined,
                error: () => undefined,
              });
              this.step.set(2);
            },
            error: (err) => {
              this.extractionError.set(err?.message ?? 'AI extraction failed.');
              this.extractingAi.set(false);
              this.evidenceService.deleteStorageObject(draftPath).subscribe({
                next: () => undefined,
                error: () => undefined,
              });
              this.step.set(2);
            },
          });
      },
      error: (err) => {
        this.extractionError.set(
          err?.message ?? 'Failed to upload draft evidence for AI extraction.',
        );
        this.extractingAi.set(false);
        this.step.set(2);
      },
    });
  }

  submitExpenseForm(): void {
    if (!this.reviewConfirmed()) {
      this.expenseFormError.set('Please confirm that you have reviewed the expense details.');
      return;
    }
    this.form.markAllAsTouched();
    if (this.form.invalid) {
      this.expenseFormError.set(null);
      return;
    }
    this.expenseFormError.set(null);
    this.step.set(3);
  }

  save(): void {
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
        const files = this.pendingFiles();
        if (files.length === 0) {
          this.saving.set(false);
          this.saved.emit(expense);
          return;
        }
        let remaining = files.length;
        files.forEach((f) => {
          this.evidenceService.uploadEvidence(expense.id, f).subscribe({
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
    this.extractionError.set(null);
    this.extractionWarnings.set([]);
    input.value = '';
  }

  removeFile(index: number): void {
    this.pendingFiles.update((prev) => prev.filter((_, i) => i !== index));
    this.extractionError.set(null);
  }

  toggleReviewConfirmed(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.reviewConfirmed.set(!!input.checked);
  }

  runAiExtraction(): void {
    // AI extraction is now triggered automatically from proceedFromUpload()
  }

  private applyExpenseExtraction(result: ExpenseExtractionResult): void {
    const requiredThreshold = 0.85;
    const categoryThreshold = 0.75;
    const suggestionThreshold = 0.6;
    const confidence = result.confidence_by_field ?? {};
    const fields = result.extracted_fields;

    if (fields.date && (confidence['date'] ?? 0) >= requiredThreshold) {
      this.form.patchValue({ date: fields.date });
    }

    if (fields.amount !== null && (confidence['amount'] ?? 0) >= requiredThreshold) {
      this.form.patchValue({ amount: fields.amount });
    }

    if (fields.description && (confidence['description'] ?? 0) >= suggestionThreshold) {
      this.form.patchValue({ description: fields.description });
    }

    const categoryName = normalizeName(fields.category_name);
    const subcategoryName = normalizeName(fields.subcategory_name);
    if (!categoryName || (confidence['category_name'] ?? 0) < categoryThreshold) {
      return;
    }

    const category = this.categories().find((cat) => normalizeName(cat.name) === categoryName);
    if (!category) {
      return;
    }

    this.form.patchValue({ irs_category_id: String(category.id) });
    this.settingsService.getSubcategories(category.id).subscribe((subs) => {
      this.subcategories.set(subs);
      if (!subcategoryName || (confidence['subcategory_name'] ?? 0) < categoryThreshold) {
        return;
      }
      const subcategory = subs.find((sub) => normalizeName(sub.name) === subcategoryName);
      if (subcategory) {
        this.form.patchValue({ subcategory_id: subcategory.id });
      }
    });
  }
}

function normalizeName(value: string | null): string {
  return (value ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
}
