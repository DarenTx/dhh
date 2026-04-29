import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { TitleCasePipe } from '@angular/common';
import { ReactiveFormsModule, FormControl, FormGroup, Validators } from '@angular/forms';
import { NgIconComponent } from '@ng-icons/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import {
  ExpenseService,
  ExpenseWithCategory,
  UpdateExpensePayload,
} from '../../../core/services/expense.service';
import {
  ExpenseEvidenceService,
  ExpenseEvidence,
} from '../../../core/services/expense-evidence.service';
import { ApprovalService, ApprovalRequirement } from '../../../core/services/approval.service';
import { RoleService } from '../../../core/role/role.service';
import { AuthenticationService } from '../../../core/auth/authentication.service';
import {
  SettingsService,
  IrsCategory,
  ExpenseSubcategory,
} from '../../../core/services/settings.service';
import { PropertyService } from '../../../core/services/property.service';

@Component({
  selector: 'app-expense-detail-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgIconComponent, TitleCasePipe, ReactiveFormsModule],
  styles: `
    .page {
      padding: 1.5rem;
      max-width: 48rem;
    }
    .back-btn {
      display: flex;
      align-items: center;
      gap: 0.375rem;
      background: none;
      border: none;
      cursor: pointer;
      color: #4a5568;
      font-size: 0.875rem;
      padding: 0;
      margin-bottom: 1.25rem;
    }
    h1 {
      margin: 0 0 0.25rem;
      font-size: 1.5rem;
      font-weight: 700;
      color: #2d3748;
    }
    .meta {
      color: #718096;
      font-size: 0.9375rem;
      margin-bottom: 1.5rem;
    }

    .card {
      background: #fff;
      border: 1px solid #e2e8f0;
      border-radius: 0.75rem;
      padding: 1.25rem;
      margin-bottom: 1rem;
    }
    .card-title {
      font-size: 1rem;
      font-weight: 600;
      color: #2d3748;
      margin: 0 0 1rem;
    }

    .detail-grid {
      display: grid;
      grid-template-columns: max-content 1fr;
      gap: 0.5rem 1.5rem;
      font-size: 0.9375rem;
    }
    .dl {
      color: #718096;
      font-weight: 500;
    }
    .dv {
      color: #2d3748;
    }

    .status-badge {
      display: inline-flex;
      align-items: center;
      padding: 0.25rem 0.625rem;
      border-radius: 9999px;
      font-size: 0.8125rem;
      font-weight: 600;
    }
    .status-pending {
      background: #fef3c7;
      color: #92400e;
    }
    .status-approved {
      background: #d1fae5;
      color: #065f46;
    }
    .status-rejected {
      background: #fee2e2;
      color: #991b1b;
    }

    .evidence-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
      gap: 0.75rem;
    }
    .evidence-item {
      border: 1px solid #e2e8f0;
      border-radius: 0.5rem;
      overflow: hidden;
      position: relative;
    }
    .evidence-item img {
      width: 100%;
      aspect-ratio: 4/3;
      object-fit: cover;
      display: block;
    }
    .evidence-pdf {
      width: 100%;
      aspect-ratio: 4/3;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #f7fafc;
      color: #718096;
      font-size: 0.8125rem;
    }
    .evidence-label {
      padding: 0.375rem 0.5rem;
      font-size: 0.75rem;
      color: #4a5568;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .evidence-delete {
      position: absolute;
      top: 0.375rem;
      right: 0.375rem;
      background: rgba(0, 0, 0, 0.5);
      border: none;
      border-radius: 9999px;
      color: #fff;
      cursor: pointer;
      padding: 0.25rem;
      display: flex;
      align-items: center;
    }

    .approval-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0.625rem 0;
      border-bottom: 1px solid #f0f0f0;
    }
    .approval-row:last-child {
      border-bottom: none;
    }
    .approver-name {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 0.375rem;
      font-size: 0.9375rem;
      color: #2d3748;
    }
    .approver-cell {
      display: flex;
      align-items: center;
      gap: 0.625rem;
    }
    .approver-avatar {
      width: 2rem;
      height: 2rem;
      border-radius: 9999px;
      object-fit: cover;
      flex-shrink: 0;
    }
    .approver-avatar-placeholder {
      width: 2rem;
      height: 2rem;
      border-radius: 9999px;
      background: #e2e8f0;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.75rem;
      font-weight: 600;
      color: #718096;
      flex-shrink: 0;
    }
    .approval-actions {
      display: flex;
      gap: 0.5rem;
    }

    .btn-approve {
      padding: 0.375rem 0.75rem;
      background: #38a169;
      color: #fff;
      border: none;
      border-radius: 0.375rem;
      font-size: 0.875rem;
      cursor: pointer;
    }
    .btn-reject {
      padding: 0.375rem 0.75rem;
      background: #fff;
      color: #e53e3e;
      border: 1px solid #e53e3e;
      border-radius: 0.375rem;
      font-size: 0.875rem;
      cursor: pointer;
    }

    .action-row {
      display: flex;
      gap: 0.75rem;
      margin-top: 1rem;
      padding-top: 1rem;
      border-top: 1px solid #edf2f7;
    }
    .btn-edit {
      padding: 0.5rem 1rem;
      background: #fff;
      color: #2b6cb0;
      border: 1px solid #bee3f8;
      border-radius: 0.375rem;
      font-size: 0.875rem;
      cursor: pointer;
      &:hover {
        background: #ebf4ff;
      }
    }
    .btn-delete {
      padding: 0.5rem 1rem;
      background: #fff;
      color: #c53030;
      border: 1px solid #feb2b2;
      border-radius: 0.375rem;
      font-size: 0.875rem;
      cursor: pointer;
      &:hover {
        background: #fff5f5;
      }
    }

    .modal-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.4);
      z-index: 200;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 1rem;
    }
    .modal {
      background: #fff;
      border-radius: 0.75rem;
      padding: 1.5rem;
      width: 100%;
      max-width: 520px;
      max-height: 90vh;
      overflow-y: auto;
    }
    .modal h3 {
      margin: 0 0 1.25rem;
      font-size: 1.125rem;
      font-weight: 700;
      color: #2d3748;
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
    .field label {
      font-size: 0.875rem;
      font-weight: 500;
      color: #4a5568;
    }
    .field input,
    .field select,
    .field textarea {
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
    .form-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1rem;
    }
    .error-msg {
      font-size: 0.8125rem;
      color: #e53e3e;
    }
    .btn-row {
      display: flex;
      gap: 0.75rem;
      justify-content: flex-end;
      margin-top: 0.5rem;
    }
    .btn-secondary {
      padding: 0.5rem 1rem;
      background: #edf2f7;
      color: #4a5568;
      border: none;
      border-radius: 0.375rem;
      font-size: 0.9375rem;
      cursor: pointer;
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
      &:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }
    }
    .btn-danger {
      padding: 0.5rem 1.25rem;
      background: #e53e3e;
      color: #fff;
      border: none;
      border-radius: 0.375rem;
      font-size: 0.9375rem;
      font-weight: 500;
      cursor: pointer;
      &:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }
    }
    .confirm-body {
      font-size: 0.9375rem;
      color: #4a5568;
      margin-bottom: 1.5rem;
      line-height: 1.5;
    }

    .reject-modal-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.4);
      z-index: 200;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 1rem;
    }
    .reject-modal {
      background: #fff;
      border-radius: 0.75rem;
      padding: 1.5rem;
      width: 100%;
      max-width: 420px;
    }
    .reject-modal h3 {
      margin: 0 0 1rem;
      font-size: 1.125rem;
      font-weight: 700;
      color: #2d3748;
    }
    .reject-modal textarea {
      width: 100%;
      box-sizing: border-box;
      padding: 0.5rem;
      border: 1px solid #e2e8f0;
      border-radius: 0.375rem;
      font-size: 0.9375rem;
      margin-bottom: 1rem;
      resize: vertical;
    }
    .reject-actions {
      display: flex;
      gap: 0.75rem;
      justify-content: flex-end;
    }
    .btn-cancel-sm {
      padding: 0.4375rem 0.875rem;
      border: 1px solid #e2e8f0;
      border-radius: 0.375rem;
      background: #fff;
      color: #4a5568;
      font-size: 0.875rem;
      cursor: pointer;
    }
    .btn-confirm-reject {
      padding: 0.4375rem 0.875rem;
      background: #e53e3e;
      color: #fff;
      border: none;
      border-radius: 0.375rem;
      font-size: 0.875rem;
      font-weight: 500;
      cursor: pointer;
      &:disabled {
        opacity: 0.5;
      }
    }
    .server-error {
      padding: 0.625rem;
      background: #fff5f5;
      border: 1px solid #feb2b2;
      border-radius: 0.375rem;
      color: #c53030;
      font-size: 0.875rem;
      margin-bottom: 0.75rem;
    }
  `,
  template: `
    <div class="page">
      <button class="back-btn" (click)="back()">
        <ng-icon name="heroChevronLeft" size="16" />
        Back to Expenses
      </button>

      @if (loading()) {
        <p style="color:#718096">Loadingâ€¦</p>
      } @else if (!expense()) {
        <p style="color:#718096">Expense not found.</p>
      } @else {
        <h1>\${{ expense()!.amount.toFixed(2) }}</h1>
        <p class="meta">{{ expense()!.date }} &middot; {{ expense()!.description }}</p>

        <div class="card">
          <p class="card-title">Details</p>
          <div class="detail-grid">
            <span class="dl">Status</span>
            <span>
              <span class="status-badge status-{{ expense()!.status }}">
                {{ expense()!.status | titlecase }}
              </span>
            </span>
            <span class="dl">Category</span>
            <span class="dv">{{ expense()!.irs_expense_categories?.name ?? 'â€”' }}</span>
            <span class="dl">Sub-category</span>
            <span class="dv">{{ expense()!.expense_subcategories?.name ?? 'â€”' }}</span>
            <span class="dl">Property</span>
            <span class="dv">{{ expense()!.properties?.address_line1 ?? 'LLC-wide' }}</span>
          </div>

          @if (canEditOrDelete()) {
            <div class="action-row">
              <button class="btn-edit" (click)="openEdit()">Edit</button>
              <button class="btn-delete" (click)="showDeleteConfirm.set(true)">Delete</button>
            </div>
          }
        </div>

        <div class="card">
          <p class="card-title">Evidence ({{ evidence().length }})</p>
          @if (evidence().length === 0) {
            <p style="color:#718096;font-size:0.875rem;">No files attached.</p>
          } @else {
            <div class="evidence-grid">
              @for (ev of evidence(); track ev.id) {
                <div class="evidence-item">
                  @if (ev.mime_type === 'application/pdf') {
                    <div class="evidence-pdf">
                      <ng-icon name="heroDocument" size="32" />
                    </div>
                  } @else {
                    <img [src]="getSignedUrl(ev.id)" [alt]="ev.file_name" />
                  }
                  <div class="evidence-label">{{ ev.file_name }}</div>
                  @if (canManage()) {
                    <button
                      class="evidence-delete"
                      (click)="deleteEvidence(ev)"
                      aria-label="Delete file"
                    >
                      <ng-icon name="heroXMark" size="12" />
                    </button>
                  }
                </div>
              }
            </div>
          }
        </div>

        @if (allApprovals().length > 0) {
          <div class="card">
            <p class="card-title">Approval Status</p>
            @for (req of allApprovals(); track req.id) {
              <div class="approval-row">
                <span class="approver-name">
                  <span class="approver-cell">
                    @if (req.approver_avatar_url) {
                      <img
                        class="approver-avatar"
                        [src]="req.approver_avatar_url"
                        [alt]="req.approver_email ?? ''"
                      />
                    } @else {
                      <span class="approver-avatar-placeholder">
                        {{
                          (
                            req.approver_first_name?.[0] ??
                            req.approver_email?.[0] ??
                            '?'
                          ).toUpperCase()
                        }}
                      </span>
                    }
                    <span>
                      @if (req.approver_first_name || req.approver_last_name) {
                        {{ req.approver_first_name }} {{ req.approver_last_name }}
                      } @else {
                        {{ req.approver_email ?? 'Unknown' }}
                      }
                    </span>
                  </span>
                  <span class="status-badge status-{{ req.status }}">
                    {{ req.status | titlecase }}
                  </span>
                  @if (req.reason) {
                    <span style="color:#718096;font-size:0.8125rem;margin-left:0.5rem"
                      >&mdash; {{ req.reason }}</span
                    >
                  }
                </span>
                @if (req.approver_id === currentUserId() && req.status === 'pending') {
                  <div class="approval-actions">
                    <button class="btn-approve" (click)="approveReq(req.id)">Approve</button>
                    <button class="btn-reject" (click)="openReject(req.id)">Reject</button>
                  </div>
                }
              </div>
            }
          </div>
        }
      }
    </div>

    @if (showEditForm()) {
      <div class="modal-backdrop" (click)="showEditForm.set(false)">
        <div class="modal" (click)="$event.stopPropagation()">
          <h3>Edit Expense</h3>
          @if (editError()) {
            <p class="server-error">{{ editError() }}</p>
          }
          <form class="form" [formGroup]="editForm" (ngSubmit)="saveEdit()">
            <div class="form-row">
              <div class="field">
                <label for="edit-date">Date *</label>
                <input
                  id="edit-date"
                  type="date"
                  formControlName="date"
                  [class.invalid]="editForm.get('date')?.touched && editForm.get('date')?.invalid"
                />
                @if (editForm.get('date')?.touched && editForm.get('date')?.hasError('required')) {
                  <span class="error-msg">Date is required.</span>
                }
              </div>
              <div class="field">
                <label for="edit-amount">Amount ($) *</label>
                <input
                  id="edit-amount"
                  type="number"
                  step="0.01"
                  min="0.01"
                  formControlName="amount"
                  [class.invalid]="
                    editForm.get('amount')?.touched && editForm.get('amount')?.invalid
                  "
                />
                @if (
                  editForm.get('amount')?.touched && editForm.get('amount')?.hasError('required')
                ) {
                  <span class="error-msg">Amount is required.</span>
                }
              </div>
            </div>
            <div class="field">
              <label for="edit-desc">Description *</label>
              <textarea
                id="edit-desc"
                formControlName="description"
                rows="2"
                [class.invalid]="
                  editForm.get('description')?.touched && editForm.get('description')?.invalid
                "
              >
              </textarea>
              @if (
                editForm.get('description')?.touched &&
                editForm.get('description')?.hasError('required')
              ) {
                <span class="error-msg">Description is required.</span>
              }
            </div>
            <div class="form-row">
              <div class="field">
                <label for="edit-cat">IRS Category *</label>
                <select
                  id="edit-cat"
                  formControlName="irs_category_id"
                  (change)="onEditCategoryChange()"
                  [class.invalid]="
                    editForm.get('irs_category_id')?.touched &&
                    editForm.get('irs_category_id')?.invalid
                  "
                >
                  <option value="">Select categoryâ€¦</option>
                  @for (cat of editCategories(); track cat.id) {
                    <option [value]="cat.id">{{ cat.name }}</option>
                  }
                </select>
              </div>
              <div class="field">
                <label for="edit-sub">Sub-category *</label>
                <select
                  id="edit-sub"
                  formControlName="subcategory_id"
                  [class.invalid]="
                    editForm.get('subcategory_id')?.touched &&
                    editForm.get('subcategory_id')?.invalid
                  "
                >
                  <option value="">Select sub-categoryâ€¦</option>
                  @for (sub of editSubcategories(); track sub.id) {
                    <option [value]="sub.id">{{ sub.name }}</option>
                  }
                </select>
                @if (
                  editForm.get('subcategory_id')?.touched &&
                  editForm.get('subcategory_id')?.hasError('required')
                ) {
                  <span class="error-msg">Sub-category is required.</span>
                }
              </div>
            </div>
            <div class="field">
              <label for="edit-prop">Property *</label>
              <select
                id="edit-prop"
                formControlName="property_id"
                [class.invalid]="
                  editForm.get('property_id')?.touched && editForm.get('property_id')?.invalid
                "
              >
                <option value="">Select propertyâ€¦</option>
                @for (prop of editProperties(); track prop.id) {
                  <option [value]="prop.id">{{ prop.address_line1 }}</option>
                }
              </select>
              @if (
                editForm.get('property_id')?.touched &&
                editForm.get('property_id')?.hasError('required')
              ) {
                <span class="error-msg">Property is required.</span>
              }
            </div>
            <div class="btn-row">
              <button type="button" class="btn-secondary" (click)="showEditForm.set(false)">
                Cancel
              </button>
              <button type="submit" class="btn-primary" [disabled]="editSaving()">
                {{ editSaving() ? 'Savingâ€¦' : 'Save Changes' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    }

    @if (showDeleteConfirm()) {
      <div class="modal-backdrop" (click)="showDeleteConfirm.set(false)">
        <div class="modal" (click)="$event.stopPropagation()">
          <h3>Delete Expense?</h3>
          <p class="confirm-body">
            This will permanently remove
            <strong>\${{ expense()!.amount.toFixed(2) }}</strong> logged on {{ expense()!.date }}.
            This cannot be undone.
          </p>
          <div class="btn-row">
            <button type="button" class="btn-secondary" (click)="showDeleteConfirm.set(false)">
              Cancel
            </button>
            <button type="button" class="btn-danger" (click)="confirmDelete()">Delete</button>
          </div>
        </div>
      </div>
    }

    @if (rejectDialogOpen()) {
      <div class="reject-modal-backdrop" (click)="closeReject()">
        <div class="reject-modal" (click)="$event.stopPropagation()">
          <h3>Reject Expense</h3>
          <textarea
            rows="4"
            placeholder="Reason for rejection..."
            [value]="rejectReason()"
            (input)="rejectReason.set($any($event.target).value)"
          ></textarea>
          <div class="reject-actions">
            <button class="btn-cancel-sm" (click)="closeReject()">Cancel</button>
            <button
              class="btn-confirm-reject"
              [disabled]="!rejectReason().trim() || actioning()"
              (click)="confirmReject()"
            >
              {{ actioning() ? 'Rejectingâ€¦' : 'Confirm Reject' }}
            </button>
          </div>
        </div>
      </div>
    }
  `,
})
export class ExpenseDetailPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly title = inject(Title);
  private readonly expenseService = inject(ExpenseService);
  private readonly evidenceService = inject(ExpenseEvidenceService);
  private readonly approvalService = inject(ApprovalService);
  private readonly roles = inject(RoleService);
  private readonly authService = inject(AuthenticationService);
  private readonly settingsService = inject(SettingsService);
  private readonly propertyService = inject(PropertyService);

  readonly currentUserId = toSignal(
    this.authService.getSession().pipe(map((s) => s?.user?.id ?? null)),
    { initialValue: null as string | null },
  );

  readonly loading = signal(true);
  readonly expense = signal<ExpenseWithCategory | null>(null);
  readonly evidence = signal<ExpenseEvidence[]>([]);
  readonly signedUrls = signal<Record<string, string>>({});

  getSignedUrl(id: string): string {
    return this.signedUrls()[id] ?? '';
  }

  readonly allApprovals = signal<ApprovalRequirement[]>([]);

  readonly canEditOrDelete = computed(() => {
    const expense = this.expense();
    if (!expense || !this.canManage()) return false;
    // Only the record owner may edit or delete, regardless of role.
    // Also hide buttons when the session hasn't resolved yet (uid === null).
    const uid = this.currentUserId();
    if (!uid || expense.created_by !== uid) return false;
    const approvals = this.allApprovals();
    const anyApproved = approvals.some((r) => r.status === 'approved');
    // Pending and nobody has approved it yet
    if (expense.status === 'pending' && !anyApproved) return true;
    // Auto-approved (no approval rows = below threshold) within 24 hours of entry
    if (expense.status === 'approved' && approvals.length === 0) {
      const created = new Date(expense.created_at).getTime();
      return Date.now() - created < 24 * 60 * 60 * 1000;
    }
    return false;
  });

  // Edit state
  readonly showEditForm = signal(false);
  readonly editSaving = signal(false);
  readonly editError = signal<string | null>(null);
  readonly editCategories = signal<IrsCategory[]>([]);
  readonly editSubcategories = signal<ExpenseSubcategory[]>([]);
  readonly editProperties = signal<{ id: string; address_line1: string }[]>([]);

  readonly editForm = new FormGroup({
    date: new FormControl('', Validators.required),
    amount: new FormControl<number | null>(null, [Validators.required, Validators.min(0.01)]),
    description: new FormControl('', Validators.required),
    irs_category_id: new FormControl('', Validators.required),
    subcategory_id: new FormControl('', Validators.required),
    property_id: new FormControl('', Validators.required),
  });

  // Delete state
  readonly showDeleteConfirm = signal(false);

  readonly rejectDialogOpen = signal(false);
  readonly rejectReason = signal('');
  readonly actioning = signal(false);
  private pendingRejectId: string | null = null;

  canManage(): boolean {
    return this.roles.isManagerOrAbove();
  }

  ngOnInit(): void {
    this.title.setTitle('Expense â€“ DHH');
    const id = this.route.snapshot.paramMap.get('id')!;
    this.load(id);
  }

  private load(id: string): void {
    this.expenseService.getExpense(id).subscribe({
      next: (expense) => {
        this.expense.set(expense);
        this.loading.set(false);
        this.loadEvidence(id);
        this.loadApprovals(id);
      },
      error: () => this.loading.set(false),
    });
  }

  private loadEvidence(id: string): void {
    this.evidenceService.getEvidenceForExpense(id).subscribe((ev) => {
      this.evidence.set(ev);
      ev.filter((e) => e.mime_type !== 'application/pdf').forEach((e) => {
        this.evidenceService.getSignedUrl(e.storage_path).subscribe((url) => {
          this.signedUrls.update((prev) => ({ ...prev, [e.id]: url }));
        });
      });
    });
  }

  private loadApprovals(expenseId: string): void {
    this.approvalService.getApprovalsForExpense(expenseId).subscribe((rows) => {
      this.allApprovals.set(rows);
    });
  }

  back(): void {
    this.router.navigate(['/expenses']);
  }

  openEdit(): void {
    const e = this.expense()!;
    this.editForm.setValue({
      date: e.date,
      amount: e.amount,
      description: e.description,
      irs_category_id: String(e.irs_category_id),
      subcategory_id: e.subcategory_id,
      property_id: e.property_id ?? '',
    });
    this.settingsService.getCategories().subscribe((cats) => this.editCategories.set(cats));
    this.propertyService
      .getProperties()
      .subscribe((props) =>
        this.editProperties.set(props.map((p) => ({ id: p.id, address_line1: p.address_line1 }))),
      );
    if (e.irs_category_id) {
      this.settingsService
        .getSubcategories(e.irs_category_id)
        .subscribe((subs) => this.editSubcategories.set(subs));
    }
    this.editError.set(null);
    this.showEditForm.set(true);
  }

  onEditCategoryChange(): void {
    const catId = Number(this.editForm.get('irs_category_id')?.value);
    if (catId) {
      this.editForm.patchValue({ subcategory_id: '' });
      this.settingsService
        .getSubcategories(catId)
        .subscribe((subs) => this.editSubcategories.set(subs));
    }
  }

  saveEdit(): void {
    this.editForm.markAllAsTouched();
    if (this.editForm.invalid) return;
    const v = this.editForm.getRawValue();
    const payload: UpdateExpensePayload = {
      date: v.date!,
      amount: Number(v.amount),
      description: v.description!,
      irs_category_id: Number(v.irs_category_id),
      subcategory_id: v.subcategory_id!,
      property_id: v.property_id || null,
    };
    this.editSaving.set(true);
    this.editError.set(null);
    this.expenseService.updateExpense(this.expense()!.id, payload).subscribe({
      next: () => {
        this.editSaving.set(false);
        this.showEditForm.set(false);
        this.load(this.expense()!.id);
      },
      error: (err) => {
        this.editSaving.set(false);
        this.editError.set(err?.message ?? 'Failed to save changes.');
      },
    });
  }

  confirmDelete(): void {
    const expense = this.expense();
    if (!expense) return;
    this.expenseService.retractExpense(expense.id).subscribe(() => {
      this.router.navigate(['/expenses']);
    });
  }

  deleteEvidence(ev: ExpenseEvidence): void {
    this.evidenceService.deleteEvidence(ev.id, ev.storage_path).subscribe(() => {
      this.evidence.update((prev) => prev.filter((e) => e.id !== ev.id));
    });
  }

  approveReq(id: string): void {
    this.actioning.set(true);
    this.approvalService.approve(id).subscribe(() => {
      this.actioning.set(false);
      this.load(this.expense()!.id);
    });
  }

  openReject(id: string): void {
    this.pendingRejectId = id;
    this.rejectReason.set('');
    this.rejectDialogOpen.set(true);
  }

  closeReject(): void {
    this.rejectDialogOpen.set(false);
    this.pendingRejectId = null;
  }

  confirmReject(): void {
    if (!this.pendingRejectId || !this.rejectReason().trim()) return;
    this.actioning.set(true);
    this.approvalService.reject(this.pendingRejectId, this.rejectReason()).subscribe(() => {
      this.actioning.set(false);
      this.closeReject();
      this.load(this.expense()!.id);
    });
  }
}
