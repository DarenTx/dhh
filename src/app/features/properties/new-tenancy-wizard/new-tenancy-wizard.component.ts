import { ChangeDetectionStrategy, Component, inject, input, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { CurrencyPipe } from '@angular/common';
import { Lease, LeaseService, CreateLeaseData } from '../../../core/services/lease.service';
import { Tenant, TenantService, CreateTenantData } from '../../../core/services/tenant.service';

type WizardStep = 1 | 2 | 3;

@Component({
  selector: 'app-new-tenancy-wizard',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, CurrencyPipe],
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
    <!-- Step indicators -->
    <div class="wizard-steps">
      <div class="step-indicator" [class.active]="step() === 1" [class.done]="step() > 1">
        <span class="step-num">{{ step() > 1 ? '✓' : '1' }}</span>
        <span>Lease</span>
      </div>
      <div class="step-sep"></div>
      <div class="step-indicator" [class.active]="step() === 2" [class.done]="step() > 2">
        <span class="step-num">{{ step() > 2 ? '✓' : '2' }}</span>
        <span>Tenant</span>
      </div>
      <div class="step-sep"></div>
      <div class="step-indicator" [class.active]="step() === 3">
        <span class="step-num">3</span>
        <span>Confirm</span>
      </div>
    </div>

    <!-- Step 1: Lease -->
    @if (step() === 1) {
      <form [formGroup]="leaseForm" (ngSubmit)="submitLease()">
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

        @if (leaseError()) {
          <p class="error-msg">{{ leaseError() }}</p>
        }

        <div class="btn-row">
          <button type="button" class="btn-secondary" (click)="cancelled.emit()">Cancel</button>
          <button type="submit" class="btn-primary" [disabled]="saving()">
            {{ saving() ? 'Saving…' : 'Next: Add Tenant' }}
          </button>
        </div>
      </form>
    }

    <!-- Step 2: Tenant -->
    @if (step() === 2) {
      <form [formGroup]="tenantForm" (ngSubmit)="submitTenant()">
        <div class="form-row">
          <div class="field">
            <label for="first_name">First name *</label>
            <input
              id="first_name"
              type="text"
              formControlName="first_name"
              autocomplete="given-name"
              [class.invalid]="
                tenantForm.get('first_name')!.invalid && tenantForm.get('first_name')!.touched
              "
            />
            @if (tenantForm.get('first_name')!.invalid && tenantForm.get('first_name')!.touched) {
              <span class="error-msg">Required</span>
            }
          </div>
          <div class="field">
            <label for="last_name">Last name *</label>
            <input
              id="last_name"
              type="text"
              formControlName="last_name"
              autocomplete="family-name"
              [class.invalid]="
                tenantForm.get('last_name')!.invalid && tenantForm.get('last_name')!.touched
              "
            />
            @if (tenantForm.get('last_name')!.invalid && tenantForm.get('last_name')!.touched) {
              <span class="error-msg">Required</span>
            }
          </div>
        </div>

        <div class="field">
          <label for="email">Email</label>
          <input
            id="email"
            type="email"
            formControlName="email"
            autocomplete="email"
            [class.invalid]="tenantForm.get('email')!.invalid && tenantForm.get('email')!.touched"
          />
          @if (tenantForm.get('email')!.errors?.['email'] && tenantForm.get('email')!.touched) {
            <span class="error-msg">Enter a valid email</span>
          }
        </div>

        <div class="field">
          <label for="phone">Phone</label>
          <input id="phone" type="tel" formControlName="phone" autocomplete="tel" />
        </div>

        @if (tenantError()) {
          <p class="error-msg">{{ tenantError() }}</p>
        }

        <div class="btn-row">
          <button type="button" class="btn-secondary" (click)="step.set(1)">Back</button>
          <button type="submit" class="btn-primary" [disabled]="saving()">
            {{ saving() ? 'Saving…' : 'Next: Confirm' }}
          </button>
        </div>
      </form>
    }

    <!-- Step 3: Confirmation -->
    @if (step() === 3) {
      <div>
        <div class="confirm-summary">
          <h4>Lease created</h4>
          <p>Start: {{ createdLease()!.start_date }}</p>
          @if (createdLease()!.end_date) {
            <p>End: {{ createdLease()!.end_date }}</p>
          }
          <p>Rent: {{ createdLease()!.monthly_rent | currency }}/month</p>
          <p>Deposit: {{ createdLease()!.security_deposit | currency }}</p>
        </div>

        <div class="confirm-summary">
          <h4>Tenant added</h4>
          <p>{{ createdTenant()!.first_name }} {{ createdTenant()!.last_name }}</p>
          @if (createdTenant()!.email) {
            <p>{{ createdTenant()!.email }}</p>
          }
          @if (createdTenant()!.phone) {
            <p>{{ createdTenant()!.phone }}</p>
          }
        </div>

        <div class="btn-row">
          <button class="btn-primary" (click)="finish()">Done</button>
        </div>
      </div>
    }
  `,
})
export class NewTenancyWizardComponent {
  private readonly fb = inject(FormBuilder);
  private readonly leaseService = inject(LeaseService);
  private readonly tenantService = inject(TenantService);

  /** ID of the property to create tenancy for */
  readonly propertyId = input.required<string>();

  readonly saved = output<{ lease: Lease; tenant: Tenant }>();
  readonly cancelled = output<void>();

  readonly step = signal<WizardStep>(1);
  readonly saving = signal(false);

  readonly leaseError = signal<string | null>(null);
  readonly tenantError = signal<string | null>(null);

  readonly createdLease = signal<Lease | null>(null);
  readonly createdTenant = signal<Tenant | null>(null);

  readonly leaseForm = this.fb.nonNullable.group({
    start_date: ['', Validators.required],
    end_date: [''],
    monthly_rent: [null as number | null, Validators.required],
    security_deposit: [null as number | null, Validators.required],
    status: ['active'],
  });

  readonly tenantForm = this.fb.nonNullable.group({
    first_name: ['', Validators.required],
    last_name: ['', Validators.required],
    email: ['', Validators.email],
    phone: [''],
  });

  submitLease(): void {
    if (this.leaseForm.invalid) {
      this.leaseForm.markAllAsTouched();
      return;
    }
    const v = this.leaseForm.getRawValue();
    const data: CreateLeaseData = {
      property_id: this.propertyId(),
      start_date: v.start_date,
      end_date: v.end_date || null,
      monthly_rent: v.monthly_rent!,
      security_deposit: v.security_deposit!,
      status: v.status as 'active' | 'expired' | 'terminated',
    };
    this.saving.set(true);
    this.leaseError.set(null);
    this.leaseService.createLease(data).subscribe({
      next: (lease) => {
        this.createdLease.set(lease);
        this.saving.set(false);
        this.step.set(2);
      },
      error: (err: unknown) => {
        this.leaseError.set(err instanceof Error ? err.message : 'Failed to create lease.');
        this.saving.set(false);
      },
    });
  }

  submitTenant(): void {
    if (this.tenantForm.invalid) {
      this.tenantForm.markAllAsTouched();
      return;
    }
    const v = this.tenantForm.getRawValue();
    const data: CreateTenantData = {
      first_name: v.first_name,
      last_name: v.last_name,
      email: v.email || null,
      phone: v.phone || null,
    };
    this.saving.set(true);
    this.tenantError.set(null);
    this.tenantService.createTenant(data).subscribe({
      next: (tenant) => {
        // Link tenant to the created lease
        this.tenantService.linkTenantToLease(this.createdLease()!.id, tenant.id).subscribe({
          next: () => {
            this.createdTenant.set(tenant);
            this.saving.set(false);
            this.step.set(3);
          },
          error: (err: unknown) => {
            this.tenantError.set(
              err instanceof Error ? err.message : 'Failed to link tenant to lease.',
            );
            this.saving.set(false);
          },
        });
      },
      error: (err: unknown) => {
        this.tenantError.set(err instanceof Error ? err.message : 'Failed to create tenant.');
        this.saving.set(false);
      },
    });
  }

  finish(): void {
    this.saved.emit({ lease: this.createdLease()!, tenant: this.createdTenant()! });
  }
}
