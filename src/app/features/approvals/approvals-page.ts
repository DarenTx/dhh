import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { SlicePipe } from '@angular/common';
import { ApprovalService, ApprovalRequirement } from '../../core/services/approval.service';

@Component({
  selector: 'app-approvals-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SlicePipe],
  styles: `
    .page { padding: 1.5rem; max-width: 56rem; }
    h1 { margin: 0 0 1.5rem; font-size: 1.5rem; font-weight: 700; color: #2d3748; }

    .section { margin-bottom: 2rem; }
    .section-title {
      font-size: 1rem; font-weight: 600; color: #4a5568;
      margin: 0 0 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; font-size: 0.8125rem;
    }

    .approval-row {
      display: flex; align-items: flex-start; justify-content: space-between;
      padding: 1rem; background: #fff; border: 1px solid #e2e8f0; border-radius: 0.625rem;
      margin-bottom: 0.5rem; gap: 1rem;
    }
    .row-info { flex: 1; min-width: 0; }
    .row-type {
      font-size: 0.75rem; font-weight: 600; color: #718096;
      text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.25rem;
    }
    .row-id { font-size: 0.9375rem; font-weight: 500; color: #2d3748; }
    .row-date { font-size: 0.8125rem; color: #718096; margin-top: 0.25rem; }

    .actions { display: flex; gap: 0.5rem; flex-shrink: 0; }
    .btn-approve {
      padding: 0.4375rem 0.875rem; background: #38a169; color: #fff; border: none;
      border-radius: 0.375rem; font-size: 0.875rem; font-weight: 500; cursor: pointer;
      white-space: nowrap;
    }
    .btn-reject {
      padding: 0.4375rem 0.875rem; background: #fff; color: #e53e3e;
      border: 1px solid #e53e3e; border-radius: 0.375rem; font-size: 0.875rem; cursor: pointer;
      white-space: nowrap;
    }
    .btn-view {
      padding: 0.4375rem 0.875rem; background: #fff; color: #4a5568;
      border: 1px solid #e2e8f0; border-radius: 0.375rem; font-size: 0.875rem; cursor: pointer;
      white-space: nowrap;
    }

    .empty-state { padding: 2rem; text-align: center; color: #a0aec0; background: #f7fafc;
      border: 1px dashed #e2e8f0; border-radius: 0.625rem; }
    .loading { color: #718096; }

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
      <h1>Approvals</h1>

      @if (loading()) {
        <p class="loading">Loading…</p>
      } @else {
        <div class="section">
          <p class="section-title">Expenses ({{ expenseItems().length }})</p>
          @if (expenseItems().length === 0) {
            <div class="empty-state">No pending expense approvals.</div>
          } @else {
            @for (req of expenseItems(); track req.id) {
              <div class="approval-row">
                <div class="row-info">
                  <div class="row-type">Expense</div>
                  <div class="row-id">ID: {{ req.approvable_id.slice(0, 8) }}…</div>
                  <div class="row-date">Submitted {{ req.created_at | slice:0:10 }}</div>
                </div>
                <div class="actions">
                  <button class="btn-view" (click)="viewItem(req)">View</button>
                  <button class="btn-approve" (click)="approveReq(req.id)">Approve</button>
                  <button class="btn-reject" (click)="openReject(req.id)">Reject</button>
                </div>
              </div>
            }
          }
        </div>

        <div class="section">
          <p class="section-title">Guaranteed Payments ({{ gpItems().length }})</p>
          @if (gpItems().length === 0) {
            <div class="empty-state">No pending GP approvals.</div>
          } @else {
            @for (req of gpItems(); track req.id) {
              <div class="approval-row">
                <div class="row-info">
                  <div class="row-type">Guaranteed Payment</div>
                  <div class="row-id">ID: {{ req.approvable_id.slice(0, 8) }}…</div>
                  <div class="row-date">Submitted {{ req.created_at | slice:0:10 }}</div>
                </div>
                <div class="actions">
                  <button class="btn-view" (click)="viewItem(req)">View</button>
                  <button class="btn-approve" (click)="approveReq(req.id)">Approve</button>
                  <button class="btn-reject" (click)="openReject(req.id)">Reject</button>
                </div>
              </div>
            }
          }
        </div>
      }
    </div>

    @if (rejectDialogOpen()) {
      <div class="reject-modal-backdrop" (click)="closeReject()">
        <div class="reject-modal" (click)="$event.stopPropagation()">
          <h3>Reject</h3>
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
export class ApprovalsPage implements OnInit {
  private readonly approvalService = inject(ApprovalService);
  private readonly router = inject(Router);
  private readonly title = inject(Title);

  readonly loading = signal(true);
  readonly items = signal<ApprovalRequirement[]>([]);
  readonly rejectDialogOpen = signal(false);
  readonly rejectReason = signal('');
  readonly actioning = signal(false);
  private pendingRejectId: string | null = null;

  readonly expenseItems = computed(() =>
    this.items().filter((r) => r.approvable_type === 'expense'),
  );
  readonly gpItems = computed(() =>
    this.items().filter((r) => r.approvable_type === 'guaranteed_payment'),
  );

  ngOnInit(): void {
    this.title.setTitle('Approvals – DHH');
    this.load();
  }

  private load(): void {
    this.loading.set(true);
    this.approvalService.getPendingForMe().subscribe({
      next: (rows) => {
        this.items.set(rows);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  viewItem(req: ApprovalRequirement): void {
    const path =
      req.approvable_type === 'expense' ? '/expenses' : '/guaranteed-payments';
    this.router.navigate([path, req.approvable_id]);
  }

  approveReq(id: string): void {
    this.actioning.set(true);
    this.approvalService.approve(id).subscribe(() => {
      this.actioning.set(false);
      this.items.update((prev) => prev.filter((r) => r.id !== id));
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
      const id = this.pendingRejectId!;
      this.closeReject();
      this.items.update((prev) => prev.filter((r) => r.id !== id));
    });
  }
}
