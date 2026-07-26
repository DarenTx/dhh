import { ChangeDetectionStrategy, Component, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { ReactiveFormsModule, FormsModule, FormBuilder, Validators } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { NgIconComponent } from '@ng-icons/core';
import {
  AppSettings,
  ExpenseSubcategory,
  GmailAllowListEntry,
  GmailConfig,
  GmailHealth,
  InspectionTag,
  IrsCategory,
  SettingsService,
} from '../../core/services/settings.service';

const ROOM_TYPE_GROUP_LABELS: Record<string, string> = {
  exterior_front: 'Exterior Front Yard',
  exterior_left: 'Exterior Left Side',
  exterior_right: 'Exterior Right Side',
  exterior_back: 'Exterior Backyard',
  entryway: 'Entryway',
  living_room: 'Living Room',
  kitchen: 'Kitchen',
  utility_room: 'Utility Room',
  bedroom: 'Bedroom',
  bathroom: 'Bathroom',
  other: 'Other',
};

@Component({
  selector: 'app-settings-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, FormsModule, NgIconComponent, DatePipe],
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

    .insp-group-section {
      margin-bottom: 1.5rem;
      border: 1px solid #e2e8f0;
      border-radius: 0.5rem;
      overflow: hidden;
    }

    .insp-group-header {
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

    .insp-tag-list {
      padding: 0.75rem 1rem;
    }

    .insp-tag-item {
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

    .status-badge {
      display: inline-flex;
      align-items: center;
      gap: 0.375rem;
      padding: 0.25rem 0.625rem;
      border-radius: 9999px;
      font-size: 0.8125rem;
      font-weight: 600;

      &.connected {
        background: #c6f6d5;
        color: #276749;
      }
      &.reauth {
        background: #feebc8;
        color: #7b341e;
      }
      &.disconnected {
        background: #e2e8f0;
        color: #4a5568;
      }
    }

    .gmail-actions {
      display: flex;
      gap: 0.5rem;
      margin-top: 1rem;
      flex-wrap: wrap;
    }

    .health-row {
      display: flex;
      justify-content: space-between;
      padding: 0.375rem 0;
      border-bottom: 1px solid #edf2f7;
      font-size: 0.9375rem;

      &:last-of-type {
        border-bottom: none;
      }
    }

    .health-label {
      color: #718096;
    }
    .health-value {
      color: #2d3748;
      font-weight: 500;
    }
    .health-error {
      color: #c53030;
      font-weight: 600;
    }

    .allow-list-row {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.375rem 0;
      border-bottom: 1px solid #edf2f7;
      font-size: 0.9375rem;

      &:last-of-type {
        border-bottom: none;
      }
    }

    .allow-list-pattern {
      flex: 1;
      color: #2d3748;
      font-family: monospace;
    }
    .allow-list-label {
      flex: 1;
      color: #718096;
    }
    .dimmed {
      opacity: 0.45;
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

    <div class="section">
      <h2>Inspection Photo Tags</h2>

      @for (entry of roomTypeEntries; track entry.key) {
        <div class="insp-group-section">
          <div class="insp-group-header" (click)="toggleInspectionGroup(entry.key)">
            <span>{{ entry.label }}</span>
            <span>{{ expandedInspectionGroup() === entry.key ? '▲' : '▼' }}</span>
          </div>

          @if (expandedInspectionGroup() === entry.key) {
            <div class="insp-tag-list">
              @for (tag of inspectionTags()[entry.key] ?? []; track tag.id) {
                <div class="insp-tag-item">
                  <span>{{ tag.name }}</span>
                  <button
                    class="btn btn-sm btn-danger"
                    (click)="disableInspectionTag(entry.key, tag)"
                  >
                    Disable
                  </button>
                </div>
              }
              @if ((inspectionTags()[entry.key] ?? []).length === 0) {
                <p style="color: #718096; font-size: 0.875rem; margin: 0;">No active tags.</p>
              }

              <div class="add-form">
                <input
                  type="text"
                  placeholder="New tag…"
                  [(ngModel)]="newInspectionTagNames[entry.key]"
                  [ngModelOptions]="{ standalone: true }"
                />
                <button class="btn btn-primary btn-sm" (click)="addInspectionTag(entry.key)">
                  <ng-icon name="heroPlus" size="14" />
                  Add
                </button>
              </div>
            </div>
          }
        </div>
      }
    </div>

    <div class="section">
      <h2>Gmail Connection</h2>
      <div class="settings-card">
        @if (gmailConfig(); as cfg) {
          <div style="display:flex;align-items:center;gap:1rem;">
            <span
              class="status-badge"
              [class.connected]="cfg.auth_status === 'connected'"
              [class.reauth]="cfg.auth_status === 'reauth_required'"
              [class.disconnected]="cfg.auth_status === 'disconnected'"
            >
              @if (cfg.auth_status === 'connected') {
                • Connected
              } @else if (cfg.auth_status === 'reauth_required') {
                ⚠ Re-auth Required
              } @else {
                ○ Disconnected
              }
            </span>
            @if (cfg.connected_at) {
              <span style="font-size:0.875rem;color:#718096;"
                >Since {{ cfg.connected_at | date: 'mediumDate' }}</span
              >
            }
          </div>
          @if (cfg.auth_status === 'reauth_required') {
            <p class="error-msg" style="margin-top:0.75rem;">
              The Gmail connection needs to be re-authenticated.
            </p>
          }
          <div class="gmail-actions">
            @if (cfg.auth_status === 'connected') {
              <button
                class="btn btn-danger"
                (click)="disconnectGmail()"
                [disabled]="gmailConnecting()"
              >
                Disconnect Gmail
              </button>
            } @else {
              <button
                class="btn btn-primary"
                (click)="connectGmail()"
                [disabled]="gmailConnecting()"
              >
                <ng-icon name="heroArrowPath" size="16" />
                {{
                  cfg.auth_status === 'reauth_required' ? 'Re-authenticate Gmail' : 'Connect Gmail'
                }}
              </button>
            }
          </div>
        } @else {
          <p style="color:#718096;">Loading…</p>
        }
        @if (gmailConnectError()) {
          <p class="error-msg">{{ gmailConnectError() }}</p>
        }
      </div>
    </div>

    <div class="section">
      <h2>Gmail Allow List</h2>
      <div class="settings-card">
        @for (entry of gmailAllowList(); track entry.id) {
          <div class="allow-list-row" [class.dimmed]="!entry.is_active">
            <span class="allow-list-pattern">{{ entry.pattern }}</span>
            <span class="allow-list-label">{{ entry.label }}</span>
            <button
              class="btn btn-sm"
              style="background:#e2e8f0;color:#4a5568;"
              (click)="toggleAllowEntry(entry)"
            >
              {{ entry.is_active ? 'Disable' : 'Enable' }}
            </button>
            <button class="btn btn-sm btn-danger" (click)="deleteAllowEntry(entry.id)">
              <ng-icon name="heroTrash" size="13" />
            </button>
          </div>
        }
        @if (gmailAllowList().length === 0) {
          <p style="color:#718096;font-size:0.875rem;margin:0;">No entries yet.</p>
        }
        <div class="add-form" style="margin-top:1rem;">
          <input
            type="text"
            placeholder="domain.com or user@domain.com"
            [(ngModel)]="newAllowPattern"
            [ngModelOptions]="{ standalone: true }"
          />
          <input
            type="text"
            placeholder="Label (e.g. Stessa)"
            [(ngModel)]="newAllowLabel"
            [ngModelOptions]="{ standalone: true }"
          />
          <button class="btn btn-primary btn-sm" (click)="addAllowEntry()">
            <ng-icon name="heroPlus" size="14" /> Add
          </button>
        </div>
        @if (allowListError()) {
          <p class="error-msg">{{ allowListError() }}</p>
        }
      </div>
    </div>

    <div class="section">
      <h2>Gmail Processor Health</h2>
      <div class="settings-card">
        @if (gmailHealth(); as h) {
          <div class="health-row">
            <span class="health-label">Errors (last 7 days)</span>
            <span
              [class.health-error]="h.error_count_7d > 0"
              [class.health-value]="h.error_count_7d === 0"
              >{{ h.error_count_7d }}</span
            >
          </div>
          <div class="health-row">
            <span class="health-label">Permanently failed</span>
            <span
              [class.health-error]="h.permanently_failed_count > 0"
              [class.health-value]="h.permanently_failed_count === 0"
              >{{ h.permanently_failed_count }}</span
            >
          </div>
          <div class="health-row">
            <span class="health-label">Last successful run</span>
            <span class="health-value">{{
              h.last_processed_at ? (h.last_processed_at | date: 'medium') : 'Never'
            }}</span>
          </div>
          @if (h.last_error_detail) {
            <div class="health-row">
              <span class="health-label">Last error</span>
              <span class="health-error">{{ h.last_error_detail }}</span>
            </div>
          }
        } @else {
          <p style="color:#718096;">Loading…</p>
        }
      </div>
    </div>
  `,
})
export class SettingsPage {
  private readonly settingsService = inject(SettingsService);
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly savingSettings = signal(false);
  readonly settingsSaved = signal(false);
  readonly settingsError = signal<string | null>(null);
  readonly categories = signal<IrsCategory[]>([]);
  readonly subcategories = signal<Partial<Record<number, ExpenseSubcategory[]>>>({});
  readonly expandedCategory = signal<number | null>(null);
  readonly inspectionTags = signal<Partial<Record<string, InspectionTag[]>>>({});
  readonly expandedInspectionGroup = signal<string | null>(null);

  // Gmail
  readonly gmailConfig = signal<GmailConfig | null>(null);
  readonly gmailAllowList = signal<GmailAllowListEntry[]>([]);
  readonly gmailHealth = signal<GmailHealth | null>(null);
  readonly gmailConnecting = signal(false);
  readonly gmailConnectError = signal<string | null>(null);
  readonly allowListError = signal<string | null>(null);
  newAllowPattern = '';
  newAllowLabel = '';
  private readonly queryParams = toSignal(this.route.queryParams);

  readonly roomTypeEntries = Object.entries(ROOM_TYPE_GROUP_LABELS).map(([key, label]) => ({
    key,
    label,
  }));
  newSubName = '';
  newInspectionTagNames: Record<string, string> = {};

  readonly settingsForm = this.fb.group({
    expenseThreshold: [150, [Validators.required, Validators.min(0)]],
    hourCap: [20, [Validators.required, Validators.min(0)]],
  });

  constructor() {
    this.loadSettings();
    this.loadCategories();
    this.loadInspectionTags();
    this.loadGmailConfig();
    this.loadGmailAllowList();
    this.loadGmailHealth();

    // Handle OAuth callback: Google redirects back with ?code=...&state=gmail_oauth
    effect(() => {
      const params = this.queryParams();
      if (params?.['code'] && params?.['state'] === 'gmail_oauth') {
        this.exchangeGmailCode(params['code']);
      }
    });
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

  private loadInspectionTags(): void {
    this.settingsService.getInspectionTags().subscribe({
      next: (tags) => {
        const grouped: Record<string, InspectionTag[]> = {};
        for (const tag of tags) {
          if (!grouped[tag.room_type]) grouped[tag.room_type] = [];
          grouped[tag.room_type].push(tag);
        }
        this.inspectionTags.set(grouped);
      },
    });
  }

  toggleInspectionGroup(roomType: string): void {
    this.expandedInspectionGroup.set(this.expandedInspectionGroup() === roomType ? null : roomType);
  }

  addInspectionTag(roomType: string): void {
    const name = (this.newInspectionTagNames[roomType] ?? '').trim();
    if (!name) return;
    this.settingsService.addInspectionTag(roomType, name).subscribe({
      next: () => {
        this.newInspectionTagNames[roomType] = '';
        this.loadInspectionTags();
      },
    });
  }

  disableInspectionTag(roomType: string, tag: InspectionTag): void {
    this.settingsService.disableInspectionTag(tag.id).subscribe({
      next: () => this.loadInspectionTags(),
    });
  }

  // ── Gmail ──────────────────────────────────────────────────────────────────

  private loadGmailConfig(): void {
    this.settingsService.getGmailConfig().subscribe({
      next: (cfg) => this.gmailConfig.set(cfg),
    });
  }

  private loadGmailAllowList(): void {
    this.settingsService.getGmailAllowList().subscribe({
      next: (list) => this.gmailAllowList.set(list),
    });
  }

  private loadGmailHealth(): void {
    this.settingsService.getGmailHealth().subscribe({
      next: (h) => this.gmailHealth.set(h),
    });
  }

  connectGmail(): void {
    this.gmailConnecting.set(true);
    this.gmailConnectError.set(null);
    const redirectUri = `${window.location.origin}/settings`;
    this.settingsService.getGmailAuthUrl(redirectUri).subscribe({
      next: (url) => {
        window.location.href = url;
      },
      error: (err) => {
        this.gmailConnecting.set(false);
        this.gmailConnectError.set(err?.message ?? 'Failed to start Gmail connection.');
      },
    });
  }

  private exchangeGmailCode(code: string): void {
    this.gmailConnecting.set(true);
    this.gmailConnectError.set(null);
    const redirectUri = `${window.location.origin}/settings`;
    this.settingsService.exchangeGmailCode(code, redirectUri).subscribe({
      next: () => {
        this.gmailConnecting.set(false);
        this.router.navigate([], { queryParams: {}, replaceUrl: true });
        this.loadGmailConfig();
        this.loadGmailHealth();
      },
      error: (err) => {
        this.gmailConnecting.set(false);
        this.gmailConnectError.set(err?.message ?? 'Failed to complete Gmail authentication.');
        this.router.navigate([], { queryParams: {}, replaceUrl: true });
      },
    });
  }

  disconnectGmail(): void {
    this.settingsService.disconnectGmail().subscribe({
      next: () => this.loadGmailConfig(),
    });
  }

  addAllowEntry(): void {
    const pattern = this.newAllowPattern.trim();
    const label = this.newAllowLabel.trim();
    if (!pattern || !label) {
      this.allowListError.set('Both pattern and label are required.');
      return;
    }
    this.allowListError.set(null);
    this.settingsService.addGmailAllowListEntry(pattern, label).subscribe({
      next: () => {
        this.newAllowPattern = '';
        this.newAllowLabel = '';
        this.loadGmailAllowList();
      },
      error: (err) => this.allowListError.set(err?.message ?? 'Failed to add entry.'),
    });
  }

  toggleAllowEntry(entry: GmailAllowListEntry): void {
    this.settingsService.toggleGmailAllowListEntry(entry.id, !entry.is_active).subscribe({
      next: () => this.loadGmailAllowList(),
    });
  }

  deleteAllowEntry(id: string): void {
    this.settingsService.deleteGmailAllowListEntry(id).subscribe({
      next: () => this.loadGmailAllowList(),
    });
  }
}
