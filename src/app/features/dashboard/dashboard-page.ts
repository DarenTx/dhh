import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { CurrencyPipe } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { Title } from '@angular/platform-browser';
import { NgIconComponent } from '@ng-icons/core';
import { PropertyService } from '../../core/services/property.service';
import { ExpenseService, ExpenseWithCategory } from '../../core/services/expense.service';
import { ApprovalService, ApprovalRequirement } from '../../core/services/approval.service';
import { RoleService } from '../../core/role/role.service';
import { LeaseService } from '../../core/services/lease.service';
import {
  GuaranteedPaymentService,
  GuaranteedPayment,
} from '../../core/services/guaranteed-payment.service';

interface DashboardStats {
  totalProperties: number;
  occupiedProperties: number;
  vacantProperties: number;
  totalMarketValue: number;
  totalMonthlyRent: number;
}

@Component({
  selector: 'app-dashboard-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, NgIconComponent, CurrencyPipe],
  styles: `
    .page {
      padding: 1.25rem 1.5rem;
    }

    h1 {
      margin: 0 0 1.5rem;
      font-size: 1.375rem;
      font-weight: 700;
      color: #2d3748;
    }

    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
      gap: 1rem;
      margin-bottom: 2rem;
    }

    .stat-card {
      background: #fff;
      border: 1px solid #e2e8f0;
      border-radius: 0.75rem;
      padding: 1.25rem;
      display: flex;
      flex-direction: column;
      gap: 0.375rem;
      text-decoration: none;
      color: inherit;
      transition:
        border-color 0.15s,
        box-shadow 0.15s,
        transform 0.15s;

      &:hover {
        border-color: #bee3f8;
        box-shadow: 0 2px 8px rgb(0 0 0 / 0.08);
        transform: translateY(-1px);
      }
    }

    .stat-icon {
      width: 2.5rem;
      height: 2.5rem;
      border-radius: 0.5rem;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 0.5rem;
    }

    .stat-icon-blue {
      background: #ebf8ff;
      color: #2b6cb0;
    }
    .stat-icon-green {
      background: #f0fff4;
      color: #276749;
    }
    .stat-icon-orange {
      background: #fffaf0;
      color: #c05621;
    }

    .stat-value {
      font-size: 2rem;
      font-weight: 700;
      color: #2d3748;
      margin: 0;
    }
    .stat-label {
      font-size: 0.875rem;
      color: #718096;
      margin: 0;
    }

    .loading {
      color: #718096;
    }

    .recent-expenses {
      .section-toggle {
        width: 100%;
        display: flex;
        align-items: center;
        justify-content: space-between;
        background: #fff;
        border: 1px solid #e2e8f0;
        border-radius: 0.75rem;
        padding: 0.875rem 1.25rem;
        margin-bottom: 0;
        cursor: pointer;
        color: inherit;
        transition:
          border-color 0.15s,
          box-shadow 0.15s,
          background 0.15s;

        &:hover {
          border-color: #bee3f8;
          background: #f7fafc;
          box-shadow: 0 1px 4px rgb(0 0 0 / 0.06);
        }

        &.is-open {
          border-bottom-left-radius: 0;
          border-bottom-right-radius: 0;
          border-bottom-color: transparent;
        }

        h2 {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          margin: 0;
          font-size: 1.125rem;
          font-weight: 600;
          color: #2d3748;
        }

        ng-icon {
          color: #718096;
          flex-shrink: 0;
          transition: color 0.15s;
        }

        ng-icon.toggle-icon {
          color: #4a5568;
          transition:
            color 0.15s,
            transform 0.2s;
        }

        &:hover ng-icon {
          color: #2b6cb0;
        }
      }

      .expenses-body {
        border: 1px solid #e2e8f0;
        border-top: none;
        border-bottom-left-radius: 0.75rem;
        border-bottom-right-radius: 0.75rem;
        padding: 1rem 1rem 0.5rem;
        background: #fff;
        margin-bottom: 0;
      }
    }

    .approval-count {
      padding: 0.1875rem 0.5rem;
      background: #c53030;
      color: #fff;
      border-radius: 0.25rem;
      font-family: ui-rounded, 'SF Pro Rounded', system-ui, sans-serif;
      font-size: 0.8125rem;
      font-weight: 800;
      font-variant-numeric: tabular-nums;
      letter-spacing: 0.01em;
      flex-shrink: 0;
    }

    .expense-row {
      background: #fff;
      border: 1px solid #e2e8f0;
      border-radius: 0.5rem;
      padding: 1rem;
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      cursor: pointer;
      transition:
        border-color 0.12s,
        box-shadow 0.12s;
      gap: 1rem;
      margin-bottom: 0.5rem;
      text-decoration: none;
      &:last-child {
        margin-bottom: 0;
      }
      &:hover {
        border-color: #bee3f8;
        box-shadow: 0 1px 4px rgb(0 0 0 / 0.06);
      }
    }
    .expense-left {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }
    .expense-date {
      font-size: 0.8125rem;
      color: #718096;
    }
    .expense-desc {
      font-size: 1rem;
      color: #2d3748;
      font-weight: 600;
    }
    .expense-sub {
      font-size: 0.875rem;
      color: #718096;
    }
    .expense-right {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      flex-shrink: 0;
    }

    .needs-approval-badge {
      display: inline-flex;
      align-items: center;
      padding: 0.125rem 0.5rem;
      background: #fff7ed;
      color: #c05621;
      border: 1px solid #fed7aa;
      border-radius: 9999px;
      font-size: 0.6875rem;
      font-weight: 700;
      white-space: nowrap;
      text-transform: uppercase;
      letter-spacing: 0.04em;

      &::before {
        content: '';
        width: 5px;
        height: 5px;
        border-radius: 50%;
        background: currentColor;
        margin-right: 0.3rem;
        flex-shrink: 0;
      }
    }

    .expense-row.needs-approval {
      border-left: 3px solid #ed8936;
      padding-left: calc(1rem - 2px);
    }
    .expense-amount {
      font-size: 0.9375rem;
      font-weight: 600;
      color: #2d3748;
    }
    .status-badge {
      display: inline-flex;
      align-items: center;
      padding: 0.125rem 0.5rem;
      border-radius: 9999px;
      font-size: 0.75rem;
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

    .view-all-link {
      display: inline-flex;
      align-items: center;
      gap: 0.375rem;
      font-size: 0.875rem;
      color: #2b6cb0;
      text-decoration: none;
      margin-top: 0.75rem;
    }

    .recent-gps {
      .section-toggle {
        width: 100%;
        display: flex;
        align-items: center;
        justify-content: space-between;
        background: #fff;
        border: 1px solid #e2e8f0;
        border-radius: 0.75rem;
        padding: 0.875rem 1.25rem;
        margin-bottom: 0;
        cursor: pointer;
        color: inherit;
        transition:
          border-color 0.15s,
          box-shadow 0.15s,
          background 0.15s;

        &:hover {
          border-color: #bee3f8;
          background: #f7fafc;
          box-shadow: 0 1px 4px rgb(0 0 0 / 0.06);
        }

        &.is-open {
          border-bottom-left-radius: 0;
          border-bottom-right-radius: 0;
          border-bottom-color: transparent;
        }

        h2 {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          margin: 0;
          font-size: 1.125rem;
          font-weight: 600;
          color: #2d3748;
        }

        ng-icon {
          color: #718096;
          flex-shrink: 0;
          transition: color 0.15s;
        }

        ng-icon.toggle-icon {
          color: #4a5568;
          transition:
            color 0.15s,
            transform 0.2s;
        }

        &:hover ng-icon {
          color: #2b6cb0;
        }
      }

      .gps-body {
        border: 1px solid #e2e8f0;
        border-top: none;
        border-bottom-left-radius: 0.75rem;
        border-bottom-right-radius: 0.75rem;
        padding: 1rem 1rem 0.5rem;
        background: #fff;
        margin-bottom: 0;
      }
    }

    .gp-row {
      background: #fff;
      border: 1px solid #e2e8f0;
      border-radius: 0.5rem;
      padding: 1rem;
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      cursor: pointer;
      transition:
        border-color 0.12s,
        box-shadow 0.12s;
      gap: 1rem;
      margin-bottom: 0.5rem;
      text-decoration: none;
      color: inherit;
      &:last-child {
        margin-bottom: 0;
      }
      &:hover {
        border-color: #bee3f8;
        box-shadow: 0 1px 4px rgb(0 0 0 / 0.06);
      }
      &.needs-approval {
        border-left: 3px solid #ed8936;
        padding-left: calc(1rem - 2px);
      }
    }
    .gp-left {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }
    .gp-date {
      font-size: 0.8125rem;
      color: #718096;
    }
    .gp-desc {
      font-size: 1rem;
      color: #2d3748;
      font-weight: 600;
    }
    .gp-right {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      flex-shrink: 0;
    }
    .gp-hours {
      font-size: 0.9375rem;
      font-weight: 600;
      color: #2d3748;
    }
  `,

  template: `
    <div class="page">
      <h1>Dashboard</h1>

      @if (loading()) {
        <p class="loading">Loading…</p>
      } @else {
        <div class="stats-grid">
          <a class="stat-card" routerLink="/properties">
            <div class="stat-icon stat-icon-blue">
              <ng-icon name="heroBuildingOffice2" size="20" />
            </div>
            <p class="stat-value">{{ stats()!.totalProperties }}</p>
            <p class="stat-label">Total properties</p>
          </a>

          <a class="stat-card" routerLink="/properties" [queryParams]="{ filter: 'occupied' }">
            <div class="stat-icon stat-icon-green">
              <ng-icon name="heroCheckCircle" size="20" />
            </div>
            <p class="stat-value">{{ stats()!.occupiedProperties }}</p>
            <p class="stat-label">Occupied</p>
          </a>

          <a class="stat-card" routerLink="/properties" [queryParams]="{ filter: 'vacant' }">
            <div class="stat-icon stat-icon-orange">
              <ng-icon name="heroKey" size="20" />
            </div>
            <p class="stat-value">{{ stats()!.vacantProperties }}</p>
            <p class="stat-label">Vacant</p>
          </a>

          <a class="stat-card" routerLink="/properties">
            <div class="stat-icon stat-icon-blue">
              <ng-icon name="heroBuildingOffice2" size="20" />
            </div>
            <p class="stat-value">
              {{ stats()!.totalMarketValue | currency: 'USD' : 'symbol' : '1.0-0' }}
            </p>
            <p class="stat-label">Total market value</p>
          </a>

          <a class="stat-card" routerLink="/properties">
            <div class="stat-icon stat-icon-green">
              <ng-icon name="heroCreditCard" size="20" />
            </div>
            <p class="stat-value">
              {{ stats()!.totalMonthlyRent | currency: 'USD' : 'symbol' : '1.0-0' }}
            </p>
            <p class="stat-label">Total monthly rent</p>
          </a>
        </div>
      }

      @if (canManage()) {
        <div class="recent-gps" style="margin-top:2rem">
          <button
            class="section-toggle"
            [class.is-open]="gpsExpanded()"
            (click)="gpsExpanded.update(v => !v)"
          >
            <h2>
              <ng-icon
                [name]="gpsExpanded() ? 'heroChevronDown' : 'heroChevronRight'"
                size="16"
                class="toggle-icon"
              />
              Recent guaranteed payments
              @if (pendingGPApprovalCount() > 0) {
                <span class="approval-count">{{ pendingGPApprovalCount() }}</span>
              }
            </h2>
            <ng-icon [name]="gpsExpanded() ? 'heroChevronUp' : 'heroChevronDown'" size="18" />
          </button>
          @if (gpsExpanded()) {
            <div class="gps-body">
              @if (recentGPs().length === 0 && !loading()) {
                <p style="color:#a0aec0;font-size:0.9375rem">
                  No guaranteed payments recorded yet.
                </p>
              } @else {
                @for (gp of recentGPs(); track gp.id) {
                  <a
                    class="gp-row"
                    [class.needs-approval]="pendingGPApprovalIds().has(gp.id)"
                    [routerLink]="['/guaranteed-payments', gp.id]"
                  >
                    <div class="gp-left">
                      <span class="gp-date">{{ gp.work_date }}</span>
                      <span class="gp-desc">{{ gp.work_description }}</span>
                    </div>
                    <div class="gp-right">
                      @if (pendingGPApprovalIds().has(gp.id)) {
                        <span class="needs-approval-badge">Review</span>
                      }
                      <span class="status-badge status-{{ gp.status }}">{{ gp.status }}</span>
                      <span class="gp-hours">{{ gp.hours_billed }} hrs</span>
                    </div>
                  </a>
                }
                <a class="view-all-link" routerLink="/guaranteed-payments">
                  <ng-icon name="heroArrowRight" size="14" />
                  View all guaranteed payments
                </a>
              }
            </div>
          }
        </div>

        <div class="recent-expenses" style="margin-top:1rem">
          <button
            class="section-toggle"
            [class.is-open]="expensesExpanded()"
            (click)="expensesExpanded.update(v => !v)"
          >
            <h2>
              <ng-icon
                [name]="expensesExpanded() ? 'heroChevronDown' : 'heroChevronRight'"
                size="16"
                class="toggle-icon"
              />
              Recent expenses
              @if (pendingExpenseApprovalCount() > 0) {
                <span class="approval-count">{{ pendingExpenseApprovalCount() }}</span>
              }
            </h2>
            <ng-icon [name]="expensesExpanded() ? 'heroChevronUp' : 'heroChevronDown'" size="18" />
          </button>
          @if (expensesExpanded()) {
            <div class="expenses-body">
              @if (recentExpenses().length === 0 && !loading()) {
                <p style="color:#a0aec0;font-size:0.9375rem">No expenses recorded yet.</p>
              } @else {
                @for (exp of recentExpenses(); track exp.id) {
                  <a
                    class="expense-row"
                    [class.needs-approval]="pendingExpenseApprovalIds().has(exp.id)"
                    [routerLink]="['/expenses', exp.id]"
                  >
                    <div class="expense-left">
                      <span class="expense-date">{{ exp.date }}</span>
                      <span class="expense-desc">{{ exp.description }}</span>
                      <span class="expense-sub">
                        {{ exp.irs_expense_categories?.name ?? '' }}
                        @if (exp.expense_subcategories?.name) {
                          · {{ exp.expense_subcategories!.name }}
                        }
                        @if (exp.properties?.address_line1) {
                          · {{ exp.properties!.address_line1 }}
                        } @else {
                          · LLC-wide
                        }
                      </span>
                    </div>
                    <div class="expense-right">
                      @if (pendingExpenseApprovalIds().has(exp.id)) {
                        <span class="needs-approval-badge">Review</span>
                      }
                      <span class="status-badge status-{{ exp.status }}">{{ exp.status }}</span>
                      <span class="expense-amount">\${{ exp.amount.toFixed(2) }}</span>
                    </div>
                  </a>
                }
                <a class="view-all-link" routerLink="/expenses">
                  <ng-icon name="heroArrowRight" size="14" />
                  View all expenses
                </a>
              }
            </div>
          }
        </div>
      }
    </div>
  `,
})
export class DashboardPage implements OnInit {
  private readonly propertyService = inject(PropertyService);
  private readonly leaseService = inject(LeaseService);
  private readonly approvalService = inject(ApprovalService);
  private readonly expenseService = inject(ExpenseService);
  private readonly gpService = inject(GuaranteedPaymentService);
  private readonly roles = inject(RoleService);
  private readonly title = inject(Title);

  readonly loading = signal(true);
  readonly stats = signal<DashboardStats | null>(null);
  readonly recentExpenses = signal<ExpenseWithCategory[]>([]);
  readonly recentGPs = signal<GuaranteedPayment[]>([]);
  readonly expensesExpanded = signal(false);
  readonly gpsExpanded = signal(false);

  readonly pendingExpenseApprovals = toSignal(
    this.approvalService.getPendingForMe().pipe(
      map((items) => items.filter((r) => r.approvable_type === 'expense')),
      catchError(() => of([] as ApprovalRequirement[])),
    ),
    { initialValue: [] as ApprovalRequirement[] },
  );

  readonly pendingExpenseApprovalCount = computed(() => this.pendingExpenseApprovals().length);

  readonly pendingExpenseApprovalIds = computed(
    () => new Set(this.pendingExpenseApprovals().map((r) => r.approvable_id)),
  );

  readonly pendingGPApprovals = toSignal(
    this.approvalService.getPendingForMe().pipe(
      map((items) => items.filter((r) => r.approvable_type === 'guaranteed_payment')),
      catchError(() => of([] as ApprovalRequirement[])),
    ),
    { initialValue: [] as ApprovalRequirement[] },
  );

  readonly pendingGPApprovalCount = computed(() => this.pendingGPApprovals().length);

  readonly pendingGPApprovalIds = computed(
    () => new Set(this.pendingGPApprovals().map((r) => r.approvable_id)),
  );

  canManage(): boolean {
    return this.roles.isManagerOrAbove();
  }

  ngOnInit(): void {
    this.title.setTitle('Dashboard – DHH');
    this.propertyService.getProperties().subscribe({
      next: (properties) => {
        const occupied = properties.filter((p) => p.isOccupied).length;
        const totalMarketValue = properties.reduce(
          (sum, property) => sum + (property.latestMarketValue?.market_value ?? 0),
          0,
        );

        this.leaseService.getActiveLeases().subscribe({
          next: (leases) => {
            const totalMonthlyRent = leases.reduce((sum, lease) => sum + lease.monthly_rent, 0);
            this.stats.set({
              totalProperties: properties.length,
              occupiedProperties: occupied,
              vacantProperties: properties.length - occupied,
              totalMarketValue,
              totalMonthlyRent,
            });
            this.loading.set(false);
          },
          error: () => {
            this.stats.set({
              totalProperties: properties.length,
              occupiedProperties: occupied,
              vacantProperties: properties.length - occupied,
              totalMarketValue,
              totalMonthlyRent: 0,
            });
            this.loading.set(false);
          },
        });
      },
      error: () => this.loading.set(false),
    });

    if (this.canManage()) {
      this.expenseService.getRecentExpenses(5).subscribe({
        next: (expenses) => this.recentExpenses.set(expenses),
        error: () => {},
      });
      this.gpService.getRecentPayments(5).subscribe({
        next: (gps) => this.recentGPs.set(gps),
        error: () => {},
      });
    }
  }
}
