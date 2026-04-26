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
import {
  PropertyMarketValue,
  PropertyMarketValueService,
  CreateMarketValueData,
  UpdateMarketValueData,
} from '../../../core/services/property-market-value.service';

const VALUE_SOURCES: { value: PropertyMarketValue['source']; label: string; hint: string }[] = [
  { value: 'zillow', label: 'Zillow estimate', hint: 'Default for quick estimate entry' },
  { value: 'appraisal', label: 'Appraisal', hint: 'Formal valuation from an appraisal' },
  { value: 'other', label: 'Other source', hint: 'Any other estimate source' },
];

@Component({
  selector: 'app-market-value-form',
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
    textarea {
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

    textarea {
      resize: vertical;
      min-height: 80px;
    }

    .error {
      font-size: 0.8125rem;
      color: #e53e3e;
    }

    .source-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
      gap: 0.75rem;
    }

    .source-option {
      border: 1px solid #e2e8f0;
      border-radius: 0.5rem;
      padding: 0.875rem;
      background: #fff;
      cursor: pointer;
      transition:
        border-color 0.15s,
        box-shadow 0.15s,
        background 0.15s;
    }

    .source-option.active {
      border-color: #2b6cb0;
      background: #ebf8ff;
      box-shadow: 0 0 0 1px rgb(43 108 176 / 0.15);
    }

    .source-option-title {
      display: block;
      font-size: 0.875rem;
      font-weight: 600;
      color: #2d3748;
      margin-bottom: 0.25rem;
    }

    .source-option-hint {
      display: block;
      font-size: 0.75rem;
      color: #718096;
      line-height: 1.4;
    }

    .field-hint {
      font-size: 0.75rem;
      color: #718096;
      margin: 0;
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
      color: #4a5568;
      border: 1px solid #e2e8f0;
      border-radius: 0.375rem;
      font-size: 0.9375rem;
      cursor: pointer;

      &:hover {
        background: #f7fafc;
      }
    }

    .btn-save {
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
  `,
  template: `
    <form [formGroup]="form" (ngSubmit)="save()">
      <div class="form-grid">
        <div class="form-group">
          <label for="value_date">Date</label>
          <input id="value_date" type="date" formControlName="value_date" />
          @if (form.controls.value_date.invalid && form.controls.value_date.touched) {
            <span class="error">Date is required.</span>
          }
        </div>

        <div class="form-group">
          <label for="market_value">Market value ($)</label>
          <input
            id="market_value"
            type="number"
            min="0"
            step="0.01"
            formControlName="market_value"
            placeholder="Enter estimate"
          />
          @if (form.controls.market_value.invalid && form.controls.market_value.touched) {
            <span class="error">A valid market value is required.</span>
          }
        </div>

        <div class="form-group full-width">
          <label>Value source</label>
          <div class="source-grid">
            @for (source of valueSources; track source.value) {
              <button
                type="button"
                class="source-option"
                [class.active]="form.controls.source.value === source.value"
                (click)="form.controls.source.setValue(source.value)"
              >
                <span class="source-option-title">{{ source.label }}</span>
                <span class="source-option-hint">{{ source.hint }}</span>
              </button>
            }
          </div>
        </div>

        <div class="form-group full-width">
          <label for="notes">Notes (optional)</label>
          <textarea
            id="notes"
            formControlName="notes"
            placeholder="Add context like Zestimate link, appraisal date, or valuation notes"
          ></textarea>
        </div>
      </div>

      @if (errorMsg()) {
        <p style="margin-top:0.75rem;font-size:0.875rem;color:#e53e3e">{{ errorMsg() }}</p>
      }

      <div class="actions">
        <button type="button" class="btn-cancel" (click)="cancelled.emit()">Cancel</button>
        <button type="submit" class="btn-save" [disabled]="saving()">
          {{ saving() ? 'Saving…' : marketValue() ? 'Save changes' : 'Add value' }}
        </button>
      </div>
    </form>
  `,
})
export class MarketValueFormComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly svc = inject(PropertyMarketValueService);

  readonly valueSources = VALUE_SOURCES;

  readonly propertyId = input.required<string>();
  readonly marketValue = input<PropertyMarketValue | null>(null);

  readonly saved = output<PropertyMarketValue>();
  readonly cancelled = output<void>();

  readonly saving = signal(false);
  readonly errorMsg = signal<string | null>(null);

  readonly form = this.fb.group({
    value_date: ['', Validators.required],
    market_value: [null as number | null, [Validators.required, Validators.min(0)]],
    source: ['zillow' as PropertyMarketValue['source'], Validators.required],
    notes: [''],
  });

  ngOnInit(): void {
    const mv = this.marketValue();
    if (mv) {
      this.form.setValue({
        value_date: mv.value_date,
        market_value: mv.market_value,
        source: mv.source,
        notes: mv.notes ?? '',
      });
    } else {
      this.form.patchValue({
        value_date: new Date().toISOString().slice(0, 10),
        market_value: null,
        source: 'zillow',
      });
    }
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.saving.set(true);
    this.errorMsg.set(null);

    const { value_date, market_value, source, notes } = this.form.getRawValue();
    const mv = this.marketValue();

    if (market_value === null) {
      this.form.controls.market_value.markAsTouched();
      this.saving.set(false);
      return;
    }

    const obs$ = mv
      ? this.svc.update(mv.id, {
          value_date,
          market_value,
          source,
          notes: notes || null,
        } as UpdateMarketValueData)
      : this.svc.create({
          property_id: this.propertyId(),
          value_date,
          market_value,
          source,
          notes: notes || null,
        } as CreateMarketValueData);

    obs$.subscribe({
      next: (result) => {
        this.saving.set(false);
        this.saved.emit(result);
      },
      error: (err: unknown) => {
        this.saving.set(false);
        this.errorMsg.set(
          err instanceof Error ? err.message : 'An error occurred. Please try again.',
        );
      },
    });
  }
}
