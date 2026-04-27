import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  OnInit,
  output,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { CurrencyPipe } from '@angular/common';
import { Lease, LeaseService, CreateLeaseData } from '../../../core/services/lease.service';
import { Tenant, TenantService, CreateTenantData } from '../../../core/services/tenant.service';
import { StorageService } from '../../../core/services/storage.service';
import {
  AiExtractionService,
  LeaseExtractionResult,
} from '../../../core/services/ai-extraction.service';
import { PropertyService } from '../../../core/services/property.service';
import { firstValueFrom } from 'rxjs';

type WizardStep = 1 | 2 | 3 | 4;

@Component({
  selector: 'app-new-tenancy-wizard',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, CurrencyPipe],
  styles: `
    .wizard-property {
      font-size: 0.875rem;
      color: #718096;
      margin: -0.25rem 0 1.25rem;
    }

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

    .mismatch-box {
      background: #fffbeb;
      border: 1px solid #f6ad55;
      border-radius: 0.5rem;
      padding: 0.875rem;
      margin-top: 0.875rem;
    }

    .mismatch-title {
      font-size: 0.9375rem;
      font-weight: 600;
      color: #b45309;
      margin: 0 0 0.375rem;
    }

    .mismatch-detail {
      font-size: 0.875rem;
      color: #92400e;
      margin: 0 0 0.75rem;
    }

    .tenant-list {
      display: flex;
      flex-direction: column;
      gap: 1rem;
      margin-bottom: 1rem;
    }

    .tenant-row {
      border: 1px solid #e2e8f0;
      border-radius: 0.5rem;
      background: #f8fafc;
      padding: 0.875rem;
    }

    .tenant-row-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 0.75rem;
      gap: 0.5rem;
    }

    .tenant-row-title {
      margin: 0;
      font-size: 0.875rem;
      font-weight: 600;
      color: #2d3748;
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

    .review-check {
      display: flex;
      width: 100%;
      box-sizing: border-box;
      align-items: flex-start;
      gap: 0.5rem;
      margin-top: 0.75rem;
      font-size: 0.875rem;
      color: #2d3748;
      cursor: pointer;

      input[type='checkbox'] {
        flex-shrink: 0;
        width: auto;
        padding: 0;
        margin-top: 0.175rem;
        cursor: pointer;
      }

      span {
        min-width: 0;
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

    .form-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1rem;
    }

    @media (max-width: 480px) {
      .form-row {
        grid-template-columns: 1fr;
      }
    }

    .field {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
      margin-bottom: 0.875rem;
    }

    label {
      font-size: 0.875rem;
      font-weight: 500;
      color: #4a5568;
    }

    input,
    select {
      padding: 0.5rem 0.75rem;
      border: 1px solid #cbd5e0;
      border-radius: 0.375rem;
      font-size: 0.9375rem;
      color: #2d3748;
      background: #fff;
      width: 100%;
      box-sizing: border-box;

      &:focus {
        outline: none;
        border-color: #4299e1;
        box-shadow: 0 0 0 2px rgb(66 153 225 / 0.25);
      }
      &.invalid {
        border-color: #e53e3e;
      }
    }

    .error-msg {
      font-size: 0.8125rem;
      color: #e53e3e;
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
  `,
  template: `
    @if (expectedPropertyAddress()) {
      <p class="wizard-property">{{ expectedPropertyAddress() }}</p>
    }

    <div class="wizard-steps">
      <div class="step-indicator" [class.active]="step() === 1" [class.done]="step() > 1">
        <span class="step-num">{{ step() > 1 ? '✓' : '1' }}</span>
        <span>Upload</span>
      </div>
      <div class="step-sep"></div>
      <div class="step-indicator" [class.active]="step() === 2" [class.done]="step() > 2">
        <span class="step-num">{{ step() > 2 ? '✓' : '2' }}</span>
        <span>Lease</span>
      </div>
      <div class="step-sep"></div>
      <div class="step-indicator" [class.active]="step() === 3" [class.done]="step() > 3">
        <span class="step-num">{{ step() > 3 ? '✓' : '3' }}</span>
        <span>Tenants</span>
      </div>
      <div class="step-sep"></div>
      <div class="step-indicator" [class.active]="step() === 4">
        <span class="step-num">4</span>
        <span>Confirm</span>
      </div>
    </div>

    @if (step() === 1) {
      <div class="upload-box">
        <label for="lease_upload">Lease PDF *</label>
        <input
          id="lease_upload"
          type="file"
          accept="application/pdf,.pdf"
          (change)="onLeaseDocumentSelected($event)"
        />
        @if (leaseExtractionError()) {
          <p class="error-msg">{{ leaseExtractionError() }}</p>
        }
        @for (w of nonMismatchWarnings(); track w) {
          <p class="warn-msg">{{ w }}</p>
        }
        @if (addressMismatch()) {
          <div class="mismatch-box">
            <p class="mismatch-title">⚠ Wrong property — address mismatch</p>
            <p class="mismatch-detail">
              This lease is for <strong>{{ extractedPropertyAddress() }}</strong
              >, but you are editing <strong>{{ expectedPropertyAddress() }}</strong
              >. Please verify you uploaded the correct lease document.
            </p>
            <label class="review-check">
              <input
                type="checkbox"
                [checked]="mismatchAcknowledged()"
                (change)="toggleMismatchAcknowledged($event)"
              />
              <span
                >I confirm this lease belongs to this property and want to continue anyway.</span
              >
            </label>
          </div>
        }
      </div>

      @if (leaseError()) {
        <p class="error-msg">{{ leaseError() }}</p>
      }

      <div class="btn-row">
        <button type="button" class="btn-secondary" (click)="cancelled.emit()">Cancel</button>
        <button
          type="button"
          class="btn-primary"
          [disabled]="
            !selectedLeaseDocument() ||
            extractingLease() ||
            (addressMismatch() && !mismatchAcknowledged())
          "
          (click)="proceedFromUpload()"
        >
          @if (extractingLease()) {
            <span class="spinner"></span> Analyzing lease…
          } @else {
            Next: Review Lease Details
          }
        </button>
      </div>
    }

    @if (step() === 2) {
      <form [formGroup]="leaseForm" (ngSubmit)="submitLeaseForm()">
        <div class="form-row">
          <div class="field">
            <label for="start_date">Start date *</label>
            <input
              id="start_date"
              type="date"
              formControlName="start_date"
              [class.invalid]="
                leaseForm.get('start_date')!.invalid && leaseForm.get('start_date')!.touched
              "
            />
            @if (leaseForm.get('start_date')!.invalid && leaseForm.get('start_date')!.touched) {
              <span class="error-msg">Required</span>
            }
          </div>
          <div class="field">
            <label for="end_date">End date</label>
            <input id="end_date" type="date" formControlName="end_date" />
          </div>
        </div>

        <div class="form-row">
          <div class="field">
            <label for="monthly_rent">Monthly rent ($) *</label>
            <input
              id="monthly_rent"
              type="number"
              min="0"
              step="0.01"
              formControlName="monthly_rent"
              [class.invalid]="
                leaseForm.get('monthly_rent')!.invalid && leaseForm.get('monthly_rent')!.touched
              "
            />
            @if (leaseForm.get('monthly_rent')!.invalid && leaseForm.get('monthly_rent')!.touched) {
              <span class="error-msg">Required</span>
            }
          </div>
          <div class="field">
            <label for="security_deposit">Security deposit ($) *</label>
            <input
              id="security_deposit"
              type="number"
              min="0"
              step="0.01"
              formControlName="security_deposit"
              [class.invalid]="
                leaseForm.get('security_deposit')!.invalid &&
                leaseForm.get('security_deposit')!.touched
              "
            />
            @if (
              leaseForm.get('security_deposit')!.invalid &&
              leaseForm.get('security_deposit')!.touched
            ) {
              <span class="error-msg">Required</span>
            }
          </div>
        </div>

        <div class="field">
          <label for="status">Status</label>
          <select id="status" formControlName="status">
            <option value="active">Active</option>
            <option value="expired">Expired</option>
            <option value="terminated">Terminated</option>
          </select>
        </div>

        <label class="review-check">
          <input
            type="checkbox"
            [checked]="leaseReviewConfirmed()"
            (change)="toggleLeaseReview($event)"
          />
          I have reviewed the lease details and they are correct.
        </label>

        @if (leaseError()) {
          <p class="error-msg">{{ leaseError() }}</p>
        }

        <div class="btn-row">
          <button type="button" class="btn-secondary" (click)="step.set(1)">
            ← Back to Upload
          </button>
          <button type="submit" class="btn-primary">Next: Add Tenants</button>
        </div>
      </form>
    }

    @if (step() === 3) {
      <form [formGroup]="tenantForm" (ngSubmit)="submitTenantForm()">
        <div class="tenant-list" formArrayName="tenants">
          @for (tenantGroup of tenantRows(); track $index) {
            <div class="tenant-row" [formGroupName]="$index">
              <div class="tenant-row-head">
                <h4 class="tenant-row-title">Tenant {{ $index + 1 }}</h4>
                <button
                  type="button"
                  class="btn-small"
                  (click)="removeTenantRow($index)"
                  [disabled]="tenantRows().length <= 1"
                >
                  Remove
                </button>
              </div>

              <div class="form-row">
                <div class="field">
                  <label [for]="'first_name_' + $index">First name *</label>
                  <input
                    [id]="'first_name_' + $index"
                    type="text"
                    formControlName="first_name"
                    autocomplete="given-name"
                    [class.invalid]="
                      tenantGroup.get('first_name')!.invalid &&
                      tenantGroup.get('first_name')!.touched
                    "
                  />
                  @if (
                    tenantGroup.get('first_name')!.invalid && tenantGroup.get('first_name')!.touched
                  ) {
                    <span class="error-msg">Required</span>
                  }
                </div>
                <div class="field">
                  <label [for]="'last_name_' + $index">Last name *</label>
                  <input
                    [id]="'last_name_' + $index"
                    type="text"
                    formControlName="last_name"
                    autocomplete="family-name"
                    [class.invalid]="
                      tenantGroup.get('last_name')!.invalid && tenantGroup.get('last_name')!.touched
                    "
                  />
                  @if (
                    tenantGroup.get('last_name')!.invalid && tenantGroup.get('last_name')!.touched
                  ) {
                    <span class="error-msg">Required</span>
                  }
                </div>
              </div>

              <div class="field">
                <label [for]="'email_' + $index">Email</label>
                <input
                  [id]="'email_' + $index"
                  type="email"
                  formControlName="email"
                  autocomplete="email"
                  [class.invalid]="
                    tenantGroup.get('email')!.invalid && tenantGroup.get('email')!.touched
                  "
                />
                @if (
                  tenantGroup.get('email')!.errors?.['email'] && tenantGroup.get('email')!.touched
                ) {
                  <span class="error-msg">Enter a valid email</span>
                }
              </div>

              <div class="field">
                <label [for]="'phone_' + $index">Phone</label>
                <input
                  [id]="'phone_' + $index"
                  type="tel"
                  formControlName="phone"
                  autocomplete="tel"
                />
              </div>
            </div>
          }
        </div>

        <button type="button" class="btn-small" (click)="addTenantRow()">+ Add Tenant</button>

        @if (tenantError()) {
          <p class="error-msg">{{ tenantError() }}</p>
        }

        <div class="btn-row">
          <button type="button" class="btn-secondary" (click)="step.set(2)">← Back to Lease</button>
          <button type="submit" class="btn-primary">Next: Confirm & Save</button>
        </div>
      </form>
    }

    @if (step() === 4) {
      <div>
        <div class="confirm-summary">
          <h4>Lease</h4>
          <p>Start: {{ leaseForm.getRawValue().start_date }}</p>
          @if (leaseForm.getRawValue().end_date) {
            <p>End: {{ leaseForm.getRawValue().end_date }}</p>
          }
          <p>Rent: {{ leaseForm.getRawValue().monthly_rent | currency }}/month</p>
          <p>Deposit: {{ leaseForm.getRawValue().security_deposit | currency }}</p>
          <p>Status: {{ leaseForm.getRawValue().status }}</p>
        </div>

        <div class="confirm-summary">
          <h4>Tenants</h4>
          @for (tenant of tenantForm.getRawValue().tenants; track $index) {
            <p>{{ tenant.first_name }} {{ tenant.last_name }}</p>
            @if (tenant.email) {
              <p>{{ tenant.email }}</p>
            }
            @if (tenant.phone) {
              <p>{{ tenant.phone }}</p>
            }
          }
        </div>

        @if (tenantError()) {
          <p class="error-msg">{{ tenantError() }}</p>
        }

        <div class="btn-row">
          <button type="button" class="btn-secondary" (click)="step.set(3)">
            ← Back to Tenants
          </button>
          <button class="btn-primary" [disabled]="saving()" (click)="save()">
            {{ saving() ? 'Saving…' : 'Save Tenancy' }}
          </button>
        </div>
      </div>
    }
  `,
})
export class NewTenancyWizardComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly leaseService = inject(LeaseService);
  private readonly tenantService = inject(TenantService);
  private readonly storage = inject(StorageService);
  private readonly aiExtraction = inject(AiExtractionService);
  private readonly propertyService = inject(PropertyService);

  readonly propertyId = input.required<string>();

  readonly saved = output<{ lease: Lease; tenants: Tenant[] }>();
  readonly cancelled = output<void>();

  readonly step = signal<WizardStep>(1);
  readonly saving = signal(false);

  readonly leaseError = signal<string | null>(null);
  readonly tenantError = signal<string | null>(null);
  readonly leaseExtractionError = signal<string | null>(null);
  readonly leaseExtractionWarnings = signal<string[]>([]);
  readonly extractedPropertyAddress = signal<string | null>(null);
  readonly expectedPropertyAddress = signal<string | null>(null);
  readonly addressMismatch = signal(false);
  readonly mismatchAcknowledged = signal(false);

  readonly nonMismatchWarnings = computed(() =>
    this.leaseExtractionWarnings().filter((w) => !w.startsWith('Property address mismatch')),
  );

  readonly extractingLease = signal(false);
  readonly leaseReviewConfirmed = signal(false);
  readonly selectedLeaseDocument = signal<File | null>(null);
  readonly selectedLeaseDocumentName = signal<string | null>(null);
  readonly leaseDocumentPath = signal<string | null>(null);

  readonly leaseForm = this.fb.nonNullable.group({
    start_date: ['', Validators.required],
    end_date: [''],
    monthly_rent: [null as number | null, Validators.required],
    security_deposit: [null as number | null, Validators.required],
    status: ['active'],
  });

  readonly tenantForm = this.fb.group({
    tenants: this.fb.array([this.createTenantGroup()]),
  });

  readonly tenantRows = () => this.tenantForm.controls.tenants.controls;

  ngOnInit(): void {
    this.propertyService.getProperty(this.propertyId()).subscribe({
      next: (property) => {
        this.expectedPropertyAddress.set(
          [property.address_line1, property.city, property.state, property.zip]
            .filter(Boolean)
            .join(', '),
        );
      },
      error: () => {
        this.expectedPropertyAddress.set(null);
      },
    });
  }

  proceedFromUpload(): void {
    void this.proceedFromUploadAsync();
  }

  private async proceedFromUploadAsync(): Promise<void> {
    const file = this.selectedLeaseDocument();
    if (!file) {
      this.leaseError.set('Please select a lease PDF before continuing.');
      return;
    }

    if (!this.leaseDocumentPath()) {
      this.extractingLease.set(true);
      this.leaseExtractionError.set(null);
      this.leaseExtractionWarnings.set([]);
      this.leaseError.set(null);
      this.addressMismatch.set(false);
      this.mismatchAcknowledged.set(false);

      try {
        const path = await firstValueFrom(
          this.storage.uploadLeaseDocument(this.propertyId(), file),
        );
        this.leaseDocumentPath.set(path);
        const result = await firstValueFrom(
          this.aiExtraction.extractLease({
            property_id: this.propertyId(),
            storage_bucket: 'lease-documents',
            storage_path: path,
            locale: 'en-US',
            currency: 'USD',
          }),
        );
        this.leaseExtractionWarnings.set(result.warnings ?? []);
        this.applyLeaseExtraction(result);
      } catch (err: unknown) {
        this.leaseExtractionError.set(
          err instanceof Error ? err.message : 'Failed to process lease document.',
        );
        this.extractingLease.set(false);
        return;
      }

      this.extractingLease.set(false);
    }

    if (this.addressMismatch() && !this.mismatchAcknowledged()) {
      return;
    }

    this.leaseError.set(null);
    this.step.set(2);
  }

  submitLeaseForm(): void {
    if (!this.leaseReviewConfirmed()) {
      this.leaseError.set('Please confirm that you have reviewed the lease details.');
      return;
    }

    if (this.leaseForm.invalid) {
      this.leaseForm.markAllAsTouched();
      return;
    }

    this.leaseError.set(null);
    this.step.set(3);
  }

  submitTenantForm(): void {
    if (this.tenantForm.invalid) {
      this.tenantForm.markAllAsTouched();
      return;
    }
    this.tenantError.set(null);
    this.step.set(4);
  }

  addTenantRow(): void {
    this.tenantForm.controls.tenants.push(this.createTenantGroup());
  }

  removeTenantRow(index: number): void {
    if (this.tenantForm.controls.tenants.length <= 1) {
      return;
    }
    this.tenantForm.controls.tenants.removeAt(index);
  }

  onLeaseDocumentSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;

    if (!file) {
      return;
    }

    if (!isPdfFile(file)) {
      this.selectedLeaseDocument.set(null);
      this.selectedLeaseDocumentName.set(null);
      this.leaseExtractionError.set('Only PDF files are supported for lease extraction.');
      input.value = '';
      return;
    }

    this.selectedLeaseDocument.set(file);
    this.selectedLeaseDocumentName.set(file.name);
    this.leaseDocumentPath.set(null);
    this.leaseReviewConfirmed.set(false);
    this.leaseExtractionError.set(null);
    this.leaseExtractionWarnings.set([]);
    this.addressMismatch.set(false);
    this.mismatchAcknowledged.set(false);
    this.extractedPropertyAddress.set(null);
  }

  toggleMismatchAcknowledged(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.mismatchAcknowledged.set(!!input.checked);
  }

  toggleLeaseReview(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.leaseReviewConfirmed.set(!!input.checked);
  }

  private applyLeaseExtraction(result: LeaseExtractionResult): void {
    const requiredThreshold = 0.85;
    const optionalThreshold = 0.7;
    const fields = result.extracted_fields;
    const confidence = result.confidence_by_field ?? {};

    if (fields.start_date && (confidence['start_date'] ?? 0) >= requiredThreshold) {
      this.leaseForm.patchValue({ start_date: fields.start_date });
    }
    if (fields.monthly_rent !== null && (confidence['monthly_rent'] ?? 0) >= requiredThreshold) {
      this.leaseForm.patchValue({ monthly_rent: fields.monthly_rent });
    }
    if (
      fields.security_deposit !== null &&
      (confidence['security_deposit'] ?? 0) >= requiredThreshold
    ) {
      this.leaseForm.patchValue({ security_deposit: fields.security_deposit });
    }
    if ((confidence['end_date'] ?? 0) >= optionalThreshold) {
      this.leaseForm.patchValue({ end_date: fields.end_date ?? '' });
    }
    if (fields.status && (confidence['status'] ?? 0) >= optionalThreshold) {
      this.leaseForm.patchValue({ status: fields.status });
    }

    if (fields.property_address) {
      this.extractedPropertyAddress.set(fields.property_address);
      const expected = this.expectedPropertyAddress();
      if (expected) {
        const leaseAddress = normalizeAddressForMatch(fields.property_address);
        const expectedAddress = normalizeAddressForMatch(expected);
        if (leaseAddress !== expectedAddress) {
          this.addressMismatch.set(true);
          this.mismatchAcknowledged.set(false);
        }
      }
    }

    const tenants = fields.tenants ?? [];
    if (tenants.length > 0) {
      this.setTenantRowCount(tenants.length);
      if (tenants.length > 1) {
        this.leaseExtractionWarnings.update((warnings) => [
          ...warnings,
          `Lease contains ${tenants.length} tenants. Tenant rows were prefilled from AI; review each tenant before saving.`,
        ]);
      }

      tenants.forEach((tenant, index) => {
        const row = this.tenantRows()[index];
        if (!row) {
          return;
        }

        if (tenant.first_name && (confidence['tenant_name'] ?? 0) >= optionalThreshold) {
          row.patchValue({ first_name: tenant.first_name });
        }
        if (tenant.last_name && (confidence['tenant_name'] ?? 0) >= optionalThreshold) {
          row.patchValue({ last_name: tenant.last_name });
        }
        if (tenant.phone && (confidence['tenant_phone'] ?? 0) >= optionalThreshold) {
          row.patchValue({ phone: tenant.phone });
        }
        if (tenant.email && (confidence['tenant_email'] ?? 0) >= optionalThreshold) {
          row.patchValue({ email: tenant.email });
        }
      });
    }

    this.leaseReviewConfirmed.set(false);
  }

  save(): void {
    void this.saveAsync();
  }

  private createTenantGroup() {
    return this.fb.nonNullable.group({
      first_name: ['', Validators.required],
      last_name: ['', Validators.required],
      email: ['', Validators.email],
      phone: [''],
    });
  }

  private setTenantRowCount(count: number): void {
    const target = Math.max(1, count);
    while (this.tenantForm.controls.tenants.length < target) {
      this.tenantForm.controls.tenants.push(this.createTenantGroup());
    }
    while (this.tenantForm.controls.tenants.length > target) {
      this.tenantForm.controls.tenants.removeAt(this.tenantForm.controls.tenants.length - 1);
    }
  }

  private async saveAsync(): Promise<void> {
    this.saving.set(true);
    this.tenantError.set(null);

    const leaseValue = this.leaseForm.getRawValue();
    const createLeaseData: CreateLeaseData = {
      property_id: this.propertyId(),
      start_date: leaseValue.start_date,
      end_date: leaseValue.end_date || null,
      monthly_rent: leaseValue.monthly_rent!,
      security_deposit: leaseValue.security_deposit!,
      status: leaseValue.status as 'active' | 'expired' | 'terminated',
      document_url: this.leaseDocumentPath(),
    };

    const tenantValues = this.tenantForm.getRawValue().tenants;
    const createTenantDataList: CreateTenantData[] = tenantValues.map((tenant) => ({
      first_name: tenant.first_name,
      last_name: tenant.last_name,
      email: tenant.email || null,
      phone: tenant.phone || null,
    }));

    let createdLease: Lease | null = null;
    const createdTenants: Tenant[] = [];

    try {
      createdLease = await firstValueFrom(this.leaseService.createLease(createLeaseData));

      for (const createTenantData of createTenantDataList) {
        const tenant = await firstValueFrom(this.tenantService.createTenant(createTenantData));
        createdTenants.push(tenant);
        await firstValueFrom(this.tenantService.linkTenantToLease(createdLease.id, tenant.id));
      }

      this.saved.emit({ lease: createdLease, tenants: createdTenants });
    } catch (err: unknown) {
      await Promise.all(
        createdTenants.map(async (tenant) => {
          try {
            await firstValueFrom(this.tenantService.deactivateTenant(tenant.id));
          } catch {
            return;
          }
        }),
      );

      if (createdLease) {
        try {
          await firstValueFrom(this.leaseService.deactivateLease(createdLease.id));
        } catch {
          // Ignore cleanup failure; surface the original tenancy creation issue.
        }
      }

      this.tenantError.set(
        err instanceof Error ? err.message : 'Failed to create tenancy with all tenants.',
      );
    } finally {
      this.saving.set(false);
    }
  }
}

function isPdfFile(file: File): boolean {
  return file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
}

function normalizeAddressForMatch(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .trim();
}
