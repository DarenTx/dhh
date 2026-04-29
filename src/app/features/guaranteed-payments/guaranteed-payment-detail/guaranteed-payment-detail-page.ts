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
  GuaranteedPaymentService,
  GuaranteedPayment,
  UpdateGuaranteedPaymentPayload,
} from '../../../core/services/guaranteed-payment.service';
import { ApprovalService, ApprovalRequirement } from '../../../core/services/approval.service';
import { RoleService } from '../../../core/role/role.service';
import { AuthenticationService } from '../../../core/auth/authentication.service';

@Component({
  selector: 'app-guaranteed-payment-detail-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgIconComponent, TitleCasePipe, ReactiveFormsModule],
  styles: `
    .page {
      padding: 1.5rem;
      max-width: 40rem;
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
      max-width: 480px;
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
    }
    .confirm-body {
      font-size: 0.9375rem;
      color: #4a5568;
      margin-bottom: 1.5rem;
      line-height: 1.5;
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
  `,
  template: `
    <div class="page">
      <button class="back-btn" (click)="back()">
        <ng-icon name="heroChevronLeft" size="16" />
        Back to Guaranteed Payments
      </button>

      @if (loading()) {
        <p style="color:#718096">Loading…</p>
      } @else if (!payment()) {
        <p style="color:#718096">Entry not found.</p>
      } @else {
        <h1>{{ payment()!.hours_billed }} hrs</h1>
        <p class="meta">{{ payment()!.work_date }}</p>

        <div class="card">
          <p class="card-title">Details</p>
          <div class="detail-grid">
            <span class="dl">Status</span>
            <span>
              <span class="status-badge status-{{ payment()!.status }}">
                {{ payment()!.status | titlecase }}
              </span>
            </span>
            <span class="dl">Description</span>
            <span class="dv">{{ payment()!.work_description }}</span>
            <span class="dl">Work Date</span>
            <span class="dv">{{ payment()!.work_date }}</span>
          </div>

          @if (canEditOrDelete()) {
            <div class="action-row">
              <button class="btn-edit" (click)="openEdit()">Edit</button>
              <button class="btn-delete" (click)="showDeleteConfirm.set(true)">Delete</button>
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
          <h3>Edit Entry</h3>
          @if (editError()) {
            <p class="server-error">{{ editError() }}</p>
          }
          <form class="form" [formGroup]="editForm" (ngSubmit)="saveEdit()">
            <div class="form-row">
              <div class="field">
                <label for="edit-date">Work Date *</label>
                <input
                  id="edit-date"
                  type="date"
                  formControlName="work_date"
                  [class.invalid]="
                    editForm.get('work_date')?.touched && editForm.get('work_date')?.invalid
                  "
                />
                @if (
                  editForm.get('work_date')?.touched &&
                  editForm.get('work_date')?.hasError('required')
                ) {
                  <span class="error-msg">Date is required.</span>
                }
              </div>
              <div class="field">
                <label for="edit-hours">Hours *</label>
                <input
                  id="edit-hours"
                  type="number"
                  step="0.25"
                  min="0.25"
                  formControlName="hours_billed"
                  [class.invalid]="
                    editForm.get('hours_billed')?.touched && editForm.get('hours_billed')?.invalid
                  "
                />
                @if (
                  editForm.get('hours_billed')?.touched &&
                  editForm.get('hours_billed')?.hasError('required')
                ) {
                  <span class="error-msg">Hours are required.</span>
                }
              </div>
            </div>
            <div class="field">
              <label for="edit-desc">Work Description *</label>
              <textarea
                id="edit-desc"
                formControlName="work_description"
                rows="3"
                [class.invalid]="
                  editForm.get('work_description')?.touched &&
                  editForm.get('work_description')?.invalid
                "
              ></textarea>
              @if (
                editForm.get('work_description')?.touched &&
                editForm.get('work_description')?.hasError('required')
              ) {
                <span class="error-msg">Description is required.</span>
              }
            </div>
            <div class="btn-row">
              <button type="button" class="btn-secondary" (click)="showEditForm.set(false)">
                Cancel
              </button>
              <button type="submit" class="btn-primary" [disabled]="editSaving()">
                {{ editSaving() ? 'Saving…' : 'Save Changes' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    }

    @if (showDeleteConfirm()) {
      <div class="modal-backdrop" (click)="showDeleteConfirm.set(false)">
        <div class="modal" (click)="$event.stopPropagation()">
          <h3>Delete Entry?</h3>
          <p class="confirm-body">
            This will permanently remove the entry for
            <strong>{{ payment()!.hours_billed }} hrs</strong> on {{ payment()!.work_date }}. This
            cannot be undone.
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
          <h3>Reject Entry</h3>
          <textarea
            rows="4"
            placeholder="Reason for rejection…"
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
              {{ actioning() ? 'Rejecting…' : 'Confirm Reject' }}
            </button>
          </div>
        </div>
      </div>
    }
  `,
})
export class GuaranteedPaymentDetailPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly title = inject(Title);
  private readonly gpService = inject(GuaranteedPaymentService);
  private readonly approvalService = inject(ApprovalService);
  private readonly roles = inject(RoleService);
  private readonly authService = inject(AuthenticationService);

  readonly currentUserId = toSignal(
    this.authService.getSession().pipe(map((s) => s?.user?.id ?? null)),
    { initialValue: null as string | null },
  );

  readonly loading = signal(true);
  readonly payment = signal<GuaranteedPayment | null>(null);
  readonly allApprovals = signal<ApprovalRequirement[]>([]);

  readonly canEditOrDelete = computed(() => {
    const payment = this.payment();
    if (!payment || !this.canManage()) return false;
    const uid = this.currentUserId();
    if (!uid || payment.created_by !== uid) return false;
    const approvals = this.allApprovals();
    const anyApproved = approvals.some((r) => r.status === 'approved');
    if (payment.status === 'pending' && !anyApproved) return true;
    if (payment.status === 'approved' && approvals.length === 0) {
      const created = new Date(payment.created_at).getTime();
      return Date.now() - created < 24 * 60 * 60 * 1000;
    }
    return false;
  });

  // Edit state
  readonly showEditForm = signal(false);
  readonly editSaving = signal(false);
  readonly editError = signal<string | null>(null);

  readonly editForm = new FormGroup({
    work_date: new FormControl('', Validators.required),
    hours_billed: new FormControl<number | null>(null, [Validators.required, Validators.min(0.25)]),
    work_description: new FormControl('', Validators.required),
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
    this.title.setTitle('GP Entry – DHH');
    const id = this.route.snapshot.paramMap.get('id')!;
    this.load(id);
  }

  private load(id: string): void {
    this.gpService.getPayment(id).subscribe({
      next: (gp) => {
        this.payment.set(gp);
        this.loading.set(false);
        this.loadApprovals(id);
      },
      error: () => this.loading.set(false),
    });
  }

  private loadApprovals(gpId: string): void {
    this.approvalService.getApprovalsForGP(gpId).subscribe((rows) => {
      this.allApprovals.set(rows);
    });
  }

  back(): void {
    this.router.navigate(['/guaranteed-payments']);
  }

  openEdit(): void {
    const gp = this.payment()!;
    this.editForm.setValue({
      work_date: gp.work_date,
      hours_billed: gp.hours_billed,
      work_description: gp.work_description,
    });
    this.editError.set(null);
    this.showEditForm.set(true);
  }

  saveEdit(): void {
    this.editForm.markAllAsTouched();
    if (this.editForm.invalid) return;
    const v = this.editForm.getRawValue();
    const payload: UpdateGuaranteedPaymentPayload = {
      work_date: v.work_date!,
      hours_billed: Number(v.hours_billed),
      work_description: v.work_description!,
    };
    this.editSaving.set(true);
    this.editError.set(null);
    this.gpService.updatePayment(this.payment()!.id, payload).subscribe({
      next: () => {
        this.editSaving.set(false);
        this.showEditForm.set(false);
        this.load(this.payment()!.id);
      },
      error: (err) => {
        this.editSaving.set(false);
        this.editError.set(err?.message ?? 'Failed to save changes.');
      },
    });
  }

  confirmDelete(): void {
    const gp = this.payment();
    if (!gp) return;
    this.gpService.retractPayment(gp.id).subscribe(() => {
      this.router.navigate(['/guaranteed-payments']);
    });
  }

  approveReq(id: string): void {
    this.actioning.set(true);
    this.approvalService.approve(id).subscribe(() => {
      this.actioning.set(false);
      this.load(this.payment()!.id);
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
      this.load(this.payment()!.id);
    });
  }
}
