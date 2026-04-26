import {
  ChangeDetectionStrategy,
  Component,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { NgIconComponent } from '@ng-icons/core';
import { GuaranteedPaymentService, GuaranteedPayment } from '../../../core/services/guaranteed-payment.service';
import { ApprovalService, ApprovalRequirement } from '../../../core/services/approval.service';
import { RoleService } from '../../../core/role/role.service';

@Component({
  selector: 'app-guaranteed-payment-detail-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgIconComponent],
  styles: `
    .page { padding: 1.5rem; max-width: 40rem; }
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

    .approval-row {
      display: flex; align-items: center; justify-content: space-between;
      padding: 0.625rem 0; border-bottom: 1px solid #f0f0f0;
    }
    .approval-row:last-child { border-bottom: none; }
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
                {{ payment()!.status }}
              </span>
            </span>
            <span class="dl">Description</span>
            <span class="dv">{{ payment()!.work_description }}</span>
            <span class="dl">Work Date</span>
            <span class="dv">{{ payment()!.work_date }}</span>
          </div>

          @if (payment()!.status === 'pending' && canManage()) {
            <button class="retract-btn" (click)="retract()">Retract entry</button>
          }
        </div>

        @if (approvals().length > 0) {
          <div class="card">
            <p class="card-title">Approval Status</p>
            @for (req of approvals(); track req.id) {
              <div class="approval-row">
                <span>
                  <span class="status-badge status-{{ req.status }}" style="margin-right:0.5rem">
                    {{ req.status }}
                  </span>
                  @if (req.reason) {
                    <span style="color:#718096;font-size:0.8125rem">{{ req.reason }}</span>
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

  readonly loading = signal(true);
  readonly payment = signal<GuaranteedPayment | null>(null);
  readonly approvals = signal<ApprovalRequirement[]>([]);
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
        this.approvalService.getPendingForMe().subscribe((rows) => {
          this.approvals.set(rows.filter((r) => r.approvable_id === id));
        });
      },
      error: () => this.loading.set(false),
    });
  }

  back(): void {
    this.router.navigate(['/guaranteed-payments']);
  }

  retract(): void {
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
