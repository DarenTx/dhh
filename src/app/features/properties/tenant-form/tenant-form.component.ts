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
import { Tenant, TenantService, CreateTenantData } from '../../../core/services/tenant.service';

@Component({
  selector: 'app-tenant-form',
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

    label {
      font-size: 0.875rem;
      font-weight: 600;
      color: #4a5568;
    }

    input {
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

    .error {
      font-size: 0.8125rem;
      color: #e53e3e;
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
          <label for="first">First name *</label>
          <input id="first" formControlName="first_name" autocomplete="given-name" />
          @if (form.controls.first_name.invalid && form.controls.first_name.touched) {
            <span class="error">First name is required</span>
          }
        </div>

        <div class="form-group">
          <label for="last">Last name *</label>
          <input id="last" formControlName="last_name" autocomplete="family-name" />
          @if (form.controls.last_name.invalid && form.controls.last_name.touched) {
            <span class="error">Last name is required</span>
          }
        </div>

        <div class="form-group">
          <label for="email">Email</label>
          <input id="email" type="email" formControlName="email" autocomplete="email" />
          @if (form.controls.email.invalid && form.controls.email.touched) {
            <span class="error">Enter a valid email address</span>
          }
        </div>

        <div class="form-group">
          <label for="phone">Phone</label>
          <input id="phone" type="tel" formControlName="phone" autocomplete="tel" />
        </div>
      </div>

      @if (serverError()) {
        <p class="error" style="margin-top: 0.75rem">{{ serverError() }}</p>
      }

      <div class="actions">
        <button type="button" class="btn-cancel" (click)="cancelled.emit()">Cancel</button>
        <button type="submit" class="btn-submit" [disabled]="saving()">
          {{ saving() ? 'Saving…' : tenant() ? 'Save changes' : 'Add tenant' }}
        </button>
      </div>
    </form>
  `,
})
export class TenantFormComponent implements OnInit {
  readonly tenant = input<Tenant | null>(null);

  readonly saved = output<Tenant>();
  readonly cancelled = output<void>();

  readonly saving = signal(false);
  readonly serverError = signal<string | null>(null);

  private readonly fb = inject(FormBuilder);
  private readonly tenantService = inject(TenantService);

  readonly form = this.fb.group({
    first_name: ['', Validators.required],
    last_name: ['', Validators.required],
    email: ['', Validators.email],
    phone: [''],
  });

  ngOnInit(): void {
    const t = this.tenant();
    if (t) {
      this.form.patchValue({
        first_name: t.first_name,
        last_name: t.last_name,
        email: t.email ?? '',
        phone: t.phone ?? '',
      });
    }
  }

  submit(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.saving()) return;

    const raw = this.form.getRawValue();
    const data: CreateTenantData = {
      first_name: raw.first_name!,
      last_name: raw.last_name!,
      email: raw.email || null,
      phone: raw.phone || null,
    };

    this.saving.set(true);
    this.serverError.set(null);

    const existing = this.tenant();
    const save$ = existing
      ? this.tenantService.updateTenant(existing.id, data)
      : this.tenantService.createTenant(data);

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
  }
}
