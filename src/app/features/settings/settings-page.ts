import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ReactiveFormsModule, FormsModule, FormBuilder, Validators } from '@angular/forms';
import { NgIconComponent } from '@ng-icons/core';
import {
  AppSettings,
  ExpenseSubcategory,
  IrsCategory,
  SettingsService,
} from '../../core/services/settings.service';

@Component({
  selector: 'app-settings-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, FormsModule, NgIconComponent],
  styles: `
    :host {
      display: block;
    }

    .page-header {
      padding: 2rem 1.5rem 1rem;
      border-bottom: 1px solid #e2e8f0;
    }

    h1 {
      margin: 0;
      font-size: 1.5rem;
      font-weight: 700;
      color: #2d3748;
    }

    .section {
      padding: 1.5rem;
      max-width: 42rem;
    }

    h2 {
      font-size: 1.125rem;
      font-weight: 600;
      margin: 0 0 1rem;
      color: #2d3748;
    }

    .settings-card {
      background: #fff;
      border: 1px solid #e2e8f0;
      border-radius: 0.75rem;
      padding: 1.5rem;
    }

    .form-group {
      display: flex;
      flex-direction: column;
      gap: 0.375rem;
      margin-bottom: 1rem;
    }

    label {
      font-size: 0.875rem;
      font-weight: 600;
      color: #4a5568;
    }

    .hint {
      font-size: 0.8125rem;
      color: #718096;
    }

    input {
      padding: 0.5rem 0.75rem;
      border: 1px solid #cbd5e0;
      border-radius: 0.375rem;
      font-size: 0.9375rem;
      color: #2d3748;
      outline: none;
      width: 12rem;

      &:focus {
        border-color: #4299e1;
        box-shadow: 0 0 0 3px rgba(66, 153, 225, 0.2);
      }
    }

    .error-text {
      font-size: 0.8125rem;
      color: #c53030;
    }

    .btn {
      display: flex;
      align-items: center;
      gap: 0.375rem;
      padding: 0.5rem 1rem;
      border-radius: 0.375rem;
      font-size: 0.9375rem;
      font-weight: 600;
      cursor: pointer;
      border: none;
      transition: opacity 0.15s;

      &:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }
    }

    .btn-primary {
      background: #2b6cb0;
      color: #fff;
    }
    .btn-sm {
      font-size: 0.8125rem;
      padding: 0.25rem 0.625rem;
    }
    .btn-danger {
      background: #fc8181;
      color: #fff;
    }

    .success-msg {
      color: #276749;
      font-size: 0.9375rem;
      margin-top: 0.75rem;
    }
    .error-msg {
      color: #c53030;
      font-size: 0.9375rem;
      margin-top: 0.75rem;
    }

    .category-section {
      margin-bottom: 1.5rem;
      border: 1px solid #e2e8f0;
      border-radius: 0.5rem;
      overflow: hidden;
    }

    .category-header {
      padding: 0.625rem 1rem;
      background: #f7fafc;
      font-weight: 600;
      font-size: 0.9375rem;
      color: #2d3748;
      cursor: pointer;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .subcategory-list {
      padding: 0.75rem 1rem;
    }

    .subcategory-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0.375rem 0;
      border-bottom: 1px solid #edf2f7;
      font-size: 0.9375rem;
      color: #4a5568;

      &:last-of-type {
        border-bottom: none;
      }
    }

    .add-form {
      display: flex;
      gap: 0.5rem;
      margin-top: 0.75rem;
    }

    .add-form input {
      flex: 1;
      width: auto;
    }
  `,
  template: `
    <div class="page-header">
      <h1>Settings</h1>
    </div>

    <div class="section">
      <h2>Application Thresholds</h2>
      <div class="settings-card">
        <form [formGroup]="settingsForm" (ngSubmit)="saveSettings()">
          <div class="form-group">
            <label for="threshold">Monthly Expense Aggregate Threshold ($)</label>
            <span class="hint"
              >Expenses exceeding this total in a calendar month require approval.</span
            >
            <input id="threshold" type="number" formControlName="expenseThreshold" min="0" />
            @if (
              settingsForm.controls.expenseThreshold.invalid &&
              settingsForm.controls.expenseThreshold.touched
            ) {
              @if (settingsForm.controls.expenseThreshold.errors?.['required']) {
                <span class="error-text">Threshold is required.</span>
              } @else if (settingsForm.controls.expenseThreshold.errors?.['min']) {
                <span class="error-text">Threshold must be 0 or greater.</span>
              }
            }
          </div>

          <div class="form-group">
            <label for="hourCap">Guaranteed Payment Hour Cap (hrs/month)</label>
            <span class="hint">Hours over this cap per month require approval.</span>
            <input id="hourCap" type="number" formControlName="hourCap" min="0" />
            @if (settingsForm.controls.hourCap.invalid && settingsForm.controls.hourCap.touched) {
              @if (settingsForm.controls.hourCap.errors?.['required']) {
                <span class="error-text">Hour cap is required.</span>
              } @else if (settingsForm.controls.hourCap.errors?.['min']) {
                <span class="error-text">Hour cap must be 0 or greater.</span>
              }
            }
          </div>

          <button class="btn btn-primary" type="submit" [disabled]="savingSettings()">
            <ng-icon name="heroCheckCircle" size="16" />
            {{ savingSettings() ? 'Saving…' : 'Save Settings' }}
          </button>
        </form>

        @if (settingsSaved()) {
          <p class="success-msg">Settings saved.</p>
        }
        @if (settingsError()) {
          <p class="error-msg">{{ settingsError() }}</p>
        }
      </div>
    </div>

    <div class="section">
      <h2>Expense Subcategories</h2>

      @for (cat of categories(); track cat.id) {
        <div class="category-section">
          <div class="category-header" (click)="toggleCategory(cat.id)">
            <span>{{ cat.name }}</span>
            <span>{{ expandedCategory() === cat.id ? '▲' : '▼' }}</span>
          </div>

          @if (expandedCategory() === cat.id) {
            <div class="subcategory-list">
              @for (sub of subcategories()[cat.id] ?? []; track sub.id) {
                <div class="subcategory-item">
                  <span>{{ sub.name }}</span>
                  <button class="btn btn-sm btn-danger" (click)="disableSub(cat.id, sub)">
                    Disable
                  </button>
                </div>
              }
              @if ((subcategories()[cat.id] ?? []).length === 0) {
                <p style="color: #718096; font-size: 0.875rem; margin: 0;">
                  No active subcategories.
                </p>
              }

              <div class="add-form">
                <input
                  type="text"
                  [placeholder]="'New subcategory…'"
                  [(ngModel)]="newSubName"
                  [ngModelOptions]="{ standalone: true }"
                />
                <button class="btn btn-primary btn-sm" (click)="addSub(cat.id)">
                  <ng-icon name="heroPlus" size="14" />
                  Add
                </button>
              </div>
            </div>
          }
        </div>
      }
    </div>
  `,
})
export class SettingsPage {
  private readonly settingsService = inject(SettingsService);
  private readonly fb = inject(FormBuilder);

  readonly savingSettings = signal(false);
  readonly settingsSaved = signal(false);
  readonly settingsError = signal<string | null>(null);
  readonly categories = signal<IrsCategory[]>([]);
  readonly subcategories = signal<Partial<Record<number, ExpenseSubcategory[]>>>({});
  readonly expandedCategory = signal<number | null>(null);

  newSubName = '';

  readonly settingsForm = this.fb.group({
    expenseThreshold: [150, [Validators.required, Validators.min(0)]],
    hourCap: [20, [Validators.required, Validators.min(0)]],
  });

  constructor() {
    this.loadSettings();
    this.loadCategories();
  }

  private loadSettings(): void {
    this.settingsService.getSettings().subscribe({
      next: (s: AppSettings) => {
        this.settingsForm.patchValue({
          expenseThreshold: s.expense_monthly_aggregate_threshold,
          hourCap: s.guaranteed_payment_hour_cap,
        });
      },
    });
  }

  private loadCategories(): void {
    this.settingsService.getCategories().subscribe({
      next: (cats) => this.categories.set(cats),
    });
  }

  toggleCategory(catId: number): void {
    if (this.expandedCategory() === catId) {
      this.expandedCategory.set(null);
    } else {
      this.expandedCategory.set(catId);
      if (!this.subcategories()[catId]) {
        this.loadSubcategories(catId);
      }
    }
  }

  private loadSubcategories(catId: number): void {
    this.settingsService.getSubcategories(catId).subscribe({
      next: (subs) => this.subcategories.update((prev) => ({ ...prev, [catId]: subs })),
    });
  }

  saveSettings(): void {
    if (this.settingsForm.invalid) {
      this.settingsForm.markAllAsTouched();
      return;
    }
    this.savingSettings.set(true);
    this.settingsSaved.set(false);
    this.settingsError.set(null);

    const { expenseThreshold, hourCap } = this.settingsForm.value;
    this.settingsService
      .updateSettings({ expenseThreshold: expenseThreshold!, hourCap: hourCap! })
      .subscribe({
        next: () => {
          this.savingSettings.set(false);
          this.settingsSaved.set(true);
        },
        error: (err) => {
          this.savingSettings.set(false);
          this.settingsError.set(err?.message ?? 'Failed to save settings.');
        },
      });
  }

  addSub(catId: number): void {
    const name = this.newSubName.trim();
    if (!name) return;
    this.settingsService.addSubcategory(catId, name).subscribe({
      next: () => {
        this.newSubName = '';
        this.loadSubcategories(catId);
      },
    });
  }

  disableSub(catId: number, sub: ExpenseSubcategory): void {
    this.settingsService.disableSubcategory(sub.id).subscribe({
      next: () => this.loadSubcategories(catId),
    });
  }
}
