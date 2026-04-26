import {
  ChangeDetectionStrategy,
  Component,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { TitleCasePipe } from '@angular/common';
import { NgIconComponent } from '@ng-icons/core';
import { ExpenseService, ExpenseWithCategory } from '../../../core/services/expense.service';
import { ExpenseEvidenceService, ExpenseEvidence } from '../../../core/services/expense-evidence.service';
import { ApprovalService, ApprovalRequirement } from '../../../core/services/approval.service';
import { RoleService } from '../../../core/role/role.service';

@Component({
  selector: 'app-expense-detail-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgIconComponent, TitleCasePipe],
  styles: `
    .page { padding: 1.5rem; max-width: 48rem; }
    .back-btn {
      display: flex; align-items: center; gap: 0.375rem;
      background: none; border: none; cursor: pointer;
      color: #4a5568; font-size: 0.875rem; padding: 0; margin-bottom: 1.25rem;
    }
    h1 { margin: 0 0 0.25rem; font-size: 1.5rem; font-weight: 700; color: #2d3748; }
    .meta { color: #718096; font-size: 0.9375rem; margin-bottom: 1.5rem; }

    .card {
      background: #fff; border: 1px solid #e2e8f0; border-radius: 0.75rem;
      padding: 1.25rem; margin-bottom: 1rem;
    }
    .card-title { font-size: 1rem; font-weight: 600; color: #2d3748; margin: 0 0 1rem; }

    .detail-grid {
      display: grid; grid-template-columns: max-content 1fr;
      gap: 0.5rem 1.5rem; font-size: 0.9375rem;
    }
    .dl { color: #718096; font-weight: 500; }
    .dv { color: #2d3748; }

    .status-badge {
      display: inline-flex; align-items: center;
      padding: 0.25rem 0.625rem; border-radius: 9999px;
      font-size: 0.8125rem; font-weight: 600;
    }
    .status-pending { background: #fef3c7; color: #92400e; }
    .status-approved { background: #d1fae5; color: #065f46; }
    .status-rejected { background: #fee2e2; color: #991b1b; }

    .evidence-grid {
      display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 0.75rem;
    }
    .evidence-item {
      border: 1px solid #e2e8f0; border-radius: 0.5rem; overflow: hidden;
      position: relative;
    }
    .evidence-item img { width: 100%; aspect-ratio: 4/3; object-fit: cover; display: block; }
    .evidence-pdf {
      width: 100%; aspect-ratio: 4/3; display: flex; align-items: center; justify-content: center;
      background: #f7fafc; color: #718096; font-size: 0.8125rem;
    }
    .evidence-label {
      padding: 0.375rem 0.5rem; font-size: 0.75rem; color: #4a5568;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .evidence-delete {
      position: absolute; top: 0.375rem; right: 0.375rem;
      background: rgba(0,0,0,0.5); border: none; border-radius: 9999px;
      color: #fff; cursor: pointer; padding: 0.25rem;
      display: flex; align-items: center;
    }

    .approval-row {
      display: flex; align-items: center; justify-content: space-between;
      padding: 0.625rem 0; border-bottom: 1px solid #f0f0f0;
    }
    .approval-row:last-child { border-bottom: none; }
    .approver-name { font-size: 0.9375rem; color: #2d3748; }
    .approval-actions { display: flex; gap: 0.5rem; }

    .btn-approve {
      padding: 0.375rem 0.75rem; background: #38a169; color: #fff; border: none;
      border-radius: 0.375rem; font-size: 0.875rem; cursor: pointer;
    }
    .btn-reject {
      padding: 0.375rem 0.75rem; background: #fff; color: #e53e3e;
      border: 1px solid #e53e3e; border-radius: 0.375rem; font-size: 0.875rem; cursor: pointer;
    }

    .retract-btn {
      padding: 0.5rem 1rem; background: #fff; color: #c53030;
      border: 1px solid #feb2b2; border-radius: 0.375rem; font-size: 0.875rem;
      cursor: pointer; margin-top: 0.5rem;
    }

    .reject-modal-backdrop {
      position: fixed; inset: 0; background: rgba(0,0,0,0.4); z-index: 200;
      display: flex; align-items: center; justify-content: center; padding: 1rem;
    }
    .reject-modal {
      background: #fff; border-radius: 0.75rem; padding: 1.5rem;
      width: 100%; max-width: 420px;
    }
    .reject-modal h3 { margin: 0 0 1rem; font-size: 1.125rem; font-weight: 700; color: #2d3748; }
    .reject-modal textarea {
      width: 100%; box-sizing: border-box; padding: 0.5rem; border: 1px solid #e2e8f0;
      border-radius: 0.375rem; font-size: 0.9375rem; margin-bottom: 1rem; resize: vertical;
    }
    .reject-actions { display: flex; gap: 0.75rem; justify-content: flex-end; }
    .btn-cancel-sm {
      padding: 0.4375rem 0.875rem; border: 1px solid #e2e8f0; border-radius: 0.375rem;
      background: #fff; color: #4a5568; font-size: 0.875rem; cursor: pointer;
    }
    .btn-confirm-reject {
      padding: 0.4375rem 0.875rem; background: #e53e3e; color: #fff; border: none;
      border-radius: 0.375rem; font-size: 0.875rem; font-weight: 500; cursor: pointer;
      &:disabled { opacity: 0.5; }
    }
  `,
  template: `
    <div class="page">
      <button class="back-btn" (click)="back()">
        <ng-icon name="heroChevronLeft" size="16" />
        Back to Expenses
      </button>

      @if (loading()) {
        <p style="color:#718096">Loading…</p>
      } @else if (!expense()) {
        <p style="color:#718096">Expense not found.</p>
      } @else {
        <h1>\${{ expense()!.amount.toFixed(2) }}</h1>
        <p class="meta">{{ expense()!.date }} · {{ expense()!.description }}</p>

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
            <span class="dv">{{ expense()!.irs_expense_categories?.name ?? '—' }}</span>
            <span class="dl">Sub-category</span>
            <span class="dv">{{ expense()!.expense_subcategories?.name ?? '—' }}</span>
            <span class="dl">Property</span>
            <span class="dv">{{ expense()!.properties?.address_line1 ?? 'LLC-wide' }}</span>
          </div>

          @if (expense()!.status === 'pending' && canManage()) {
            <button class="retract-btn" (click)="retract()">Retract expense</button>
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
                    <button class="evidence-delete" (click)="deleteEvidence(ev)" aria-label="Delete file">
                      <ng-icon name="heroXMark" size="12" />
                    </button>
                  }
                </div>
              }
            </div>
          }
        </div>

        @if (approvals().length > 0) {
          <div class="card">
            <p class="card-title">Approval Status</p>
            @for (req of approvals(); track req.id) {
              <div class="approval-row">
                <span class="approver-name">
                  Approver
                  <span class="status-badge status-{{ req.status }}" style="margin-left:0.5rem">
                    {{ req.status | titlecase }}
                  </span>
                  @if (req.reason) {
                    <span style="color:#718096;font-size:0.8125rem;margin-left:0.5rem">— {{ req.reason }}</span>
                  }
                </span>
                @if (req.status === 'pending' && canManage()) {
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

    @if (rejectDialogOpen()) {
      <div class="reject-modal-backdrop" (click)="closeReject()">
        <div class="reject-modal" (click)="$event.stopPropagation()">
          <h3>Reject Expense</h3>
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
export class ExpenseDetailPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly title = inject(Title);
  private readonly expenseService = inject(ExpenseService);
  private readonly evidenceService = inject(ExpenseEvidenceService);
  private readonly approvalService = inject(ApprovalService);
  private readonly roles = inject(RoleService);

  readonly loading = signal(true);
  readonly expense = signal<ExpenseWithCategory | null>(null);
  readonly evidence = signal<ExpenseEvidence[]>([]);
  readonly signedUrls = signal<Record<string, string>>({});

  getSignedUrl(id: string): string {
    return this.signedUrls()[id] ?? '';
  }
  readonly approvals = signal<ApprovalRequirement[]>([]);
  readonly rejectDialogOpen = signal(false);
  readonly rejectReason = signal('');
  readonly actioning = signal(false);
  private pendingRejectId: string | null = null;

  canManage(): boolean {
    return this.roles.isManagerOrAbove();
  }

  ngOnInit(): void {
    this.title.setTitle('Expense – DHH');
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
    // Load all approval rows for this expense (visible to admin/manager)
    import('../../../core/auth/supabase.provider').then(({ SUPABASE_CLIENT }) => {
      // Use the approval service's getPendingForMe for the current user's row,
      // but for detail view we want all approvers.
      // Fetch directly via supabase is not available here — load via approvalService
      // Only show current user's pending row for action
      this.approvalService.getPendingForMe().subscribe((rows) => {
        this.approvals.set(rows.filter((r) => r.approvable_id === this.expense()?.id));
      });
    });
  }

  back(): void {
    this.router.navigate(['/expenses']);
  }

  retract(): void {
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
      this.approvals.update((prev) =>
        prev.map((r) => (r.id === id ? { ...r, status: 'approved' } : r)),
      );
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
