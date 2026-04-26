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
import { GuaranteedPaymentService, CreateGuaranteedPaymentPayload, GuaranteedPayment } from '../../../core/services/guaranteed-payment.service';

@Component({
  selector: 'app-guaranteed-payment-form',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule],
  styles: `
    .form { display: flex; flex-direction: column; gap: 1rem; }
    .field { display: flex; flex-direction: column; gap: 0.375rem; }
    label { font-size: 0.875rem; font-weight: 500; color: #4a5568; }
    input, textarea {
      padding: 0.5rem 0.75rem; border: 1px solid #e2e8f0; border-radius: 0.375rem;
      font-size: 0.9375rem; color: #2d3748; background: #fff; width: 100%; box-sizing: border-box;
      &:focus { outline: 2px solid #3182ce; outline-offset: -1px; }
    }
    textarea { resize: vertical; min-height: 4rem; }
    .row { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
    .error-msg { font-size: 0.8125rem; color: #e53e3e; }
    .hours-preview {
      padding: 0.5rem 0.75rem; background: #ebf4ff; border: 1px solid #bee3f8;
      border-radius: 0.375rem; font-size: 0.875rem; color: #2b6cb0;
    }
    .actions {
      display: flex; gap: 0.75rem; justify-content: flex-end;
      padding-top: 0.5rem; border-top: 1px solid #e2e8f0; margin-top: 0.5rem;
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
    .server-error {
      padding: 0.625rem; background: #fff5f5; border: 1px solid #feb2b2;
      border-radius: 0.375rem; color: #c53030; font-size: 0.875rem;
    }
  `,
  template: `
    @if (serverError()) {
      <p class="server-error">{{ serverError() }}</p>
    }

    <form class="form" [formGroup]="form" (ngSubmit)="submit()">
      <div class="row">
        <div class="field">
          <label for="work_date">Work Date *</label>
          <input id="work_date" type="date" formControlName="work_date" />
          @if (form.get('work_date')?.touched && form.get('work_date')?.hasError('required')) {
            <span class="error-msg">Date is required.</span>
          }
        </div>
        <div class="field">
          <label for="hours_billed">Hours *</label>
          <input id="hours_billed" type="number" step="0.25" min="0.25" formControlName="hours_billed" placeholder="0.00" (input)="updatePreview()" />
          @if (form.get('hours_billed')?.touched && form.get('hours_billed')?.hasError('required')) {
            <span class="error-msg">Hours are required.</span>
          }
        </div>
      </div>

      @if (monthlyHoursPreview() !== null) {
        <div class="hours-preview">
          Monthly total after this entry: <strong>{{ monthlyHoursPreview()!.toFixed(2) }} hrs</strong>
          @if (hourCap() !== null) {
            / {{ hourCap() }} hr cap
          }
        </div>
      }

      <div class="field">
        <label for="work_description">Work Description *</label>
        <textarea id="work_description" formControlName="work_description" rows="3"></textarea>
        @if (form.get('work_description')?.touched && form.get('work_description')?.hasError('required')) {
          <span class="error-msg">Description is required.</span>
        }
      </div>

      <div class="actions">
        <button type="button" class="btn-cancel" (click)="cancelled.emit()">Cancel</button>
        <button type="submit" class="btn-submit" [disabled]="saving()">
          {{ saving() ? 'Saving…' : 'Log Entry' }}
        </button>
      </div>
    </form>
  `,
})
export class GuaranteedPaymentFormComponent implements OnInit {
  @Output() saved = new EventEmitter<GuaranteedPayment>();
  @Output() cancelled = new EventEmitter<void>();

  private readonly gpService = inject(GuaranteedPaymentService);

  readonly saving = signal(false);
  readonly serverError = signal<string | null>(null);
  readonly monthlyHoursPreview = signal<number | null>(null);
  readonly hourCap = signal<number | null>(null);
  private currentMonthlyHours = 0;

  readonly form = new FormGroup({
    work_date: new FormControl(new Date().toISOString().slice(0, 10), Validators.required),
    hours_billed: new FormControl<number | null>(null, [Validators.required, Validators.min(0.25)]),
    work_description: new FormControl('', Validators.required),
  });

  ngOnInit(): void {
    const now = new Date();
    this.gpService.getMonthlyHours(now.getFullYear(), now.getMonth() + 1).subscribe((hours) => {
      this.currentMonthlyHours = hours;
    });
  }

  updatePreview(): void {
    const hours = Number(this.form.get('hours_billed')?.value ?? 0);
    if (hours > 0) {
      this.monthlyHoursPreview.set(this.currentMonthlyHours + hours);
    } else {
      this.monthlyHoursPreview.set(null);
    }
  }

  submit(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;

    const value = this.form.getRawValue();
    const payload: CreateGuaranteedPaymentPayload = {
      work_date: value.work_date!,
      hours_billed: Number(value.hours_billed),
      work_description: value.work_description!,
    };

    this.saving.set(true);
    this.serverError.set(null);

    this.gpService.createPayment(payload).subscribe({
      next: (gp) => {
        this.saving.set(false);
        this.saved.emit(gp);
      },
      error: (err) => {
        this.saving.set(false);
        this.serverError.set(err?.message ?? 'Failed to save entry. (A duplicate entry for this date may already exist.)');
      },
    });
  }
}
