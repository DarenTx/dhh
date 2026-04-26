import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { CurrencyPipe, DatePipe, SlicePipe } from '@angular/common';
import { Title } from '@angular/platform-browser';
import { NgIconComponent } from '@ng-icons/core';
import { PropertyService } from '../../core/services/property.service';
import { ExpenseService, ExpenseWithCategory } from '../../core/services/expense.service';
import { ApprovalService, ApprovalRequirement } from '../../core/services/approval.service';
import { RoleService } from '../../core/role/role.service';
import { LeaseService } from '../../core/services/lease.service';

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
  imports: [RouterLink, NgIconComponent, CurrencyPipe, DatePipe, SlicePipe],
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

    .quick-links h2 {
      margin: 0 0 1rem;
      font-size: 1.125rem;
      font-weight: 600;
      color: #2d3748;
    }

    .link-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
      gap: 0.75rem;
    }

    .link-card {
      background: #fff;
      border: 1px solid #e2e8f0;
      border-radius: 0.75rem;
      padding: 1rem;
      text-decoration: none;
      display: flex;
      align-items: center;
      gap: 0.625rem;
      font-size: 0.9375rem;
      font-weight: 500;
      color: #2d3748;
      transition:
        border-color 0.15s,
        box-shadow 0.15s;

      &:hover {
        border-color: #bee3f8;
        box-shadow: 0 1px 4px rgb(0 0 0 / 0.06);
      }
    }

    .loading {
      color: #718096;
    }

    .recent-expenses h2 {
      margin: 0 0 1rem;
      font-size: 1.125rem;
      font-weight: 600;
      color: #2d3748;
    }

    .expense-card {
      background: #fff;
      border: 1px solid #e2e8f0;
      border-radius: 0.5rem;
      padding: 1rem;
      margin-bottom: 0.75rem;
    }

    .expense-card:last-child {
      margin-bottom: 0;
    }

    .expense-card h3 {
      margin: 0 0 0.375rem;
      font-size: 1rem;
      font-weight: 600;
      color: #2d3748;
    }

    .expense-meta {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem 1.5rem;
      font-size: 0.875rem;
      color: #718096;
    }

    .expense-amount {
      font-weight: 600;
      color: #2d3748;
    }

    .expense-date {
      font-size: 0.8125rem;
      color: #a0aec0;
    }

    .section-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 1rem;

      h2 {
        margin: 0;
        font-size: 1.125rem;
        font-weight: 600;
        color: #2d3748;
      }
    }

    .approval-group {
      background: #fff;
      border: 1px solid #e2e8f0;
      border-radius: 0.75rem;
      padding: 1rem 1.25rem;
      margin-bottom: 0.75rem;
    }

    .approval-group-header {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin-bottom: 0.5rem;
    }

    .approval-group-title {
      margin: 0;
      font-size: 0.8125rem;
      font-weight: 600;
      color: #4a5568;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }

    .approval-badge {
      min-width: 1.25rem;
      height: 1.25rem;
      padding: 0 0.3rem;
      background: #e53e3e;
      color: #fff;
      border-radius: 9999px;
      font-size: 0.6875rem;
      font-weight: 700;
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }

    .all-clear {
      margin: 0;
      font-size: 0.875rem;
      color: #a0aec0;
    }

    .approval-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0.375rem 0;
      border-bottom: 1px solid #f7fafc;
      font-size: 0.875rem;

      &:last-child {
        border-bottom: none;
        padding-bottom: 0;
      }
    }

    .approval-item-id {
      color: #4a5568;
      font-family: monospace;
      font-size: 0.8125rem;
    }

    .approval-item-date {
      font-size: 0.8125rem;
      color: #a0aec0;
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

      <div class="quick-links">
        <h2>Quick links</h2>
        <div class="link-grid">
          <a class="link-card" routerLink="/properties">
            <ng-icon name="heroBuildingOffice2" size="18" />
            Properties
          </a>
          @if (canManage()) {
            <a class="link-card" routerLink="/expenses">
              <ng-icon name="heroCreditCard" size="18" />
              Expenses
            </a>
            <a class="link-card" routerLink="/guaranteed-payments">
              <ng-icon name="heroClock" size="18" />
              Guaranteed Payments
            </a>
            <a class="link-card" routerLink="/approvals">
              <ng-icon name="heroCheckCircle" size="18" />
              Approvals
            </a>
          }
        </div>
      </div>

      @if (canManage()) {
        <div class="approvals-section" style="margin-top: 2rem">
          <div class="section-header">
            <h2>Outstanding Approvals</h2>
            <a class="view-all-link" routerLink="/approvals">
              <ng-icon name="heroArrowRight" size="14" />
              View all
            </a>
          </div>

          @if (approvalsLoading()) {
            <p class="loading">Loading…</p>
          } @else {
            <div class="approval-group">
              <div class="approval-group-header">
                <p class="approval-group-title">Expenses</p>
                @if (pendingExpenseApprovals().length > 0) {
                  <span class="approval-badge">{{ pendingExpenseApprovals().length }}</span>
                }
              </div>
              @if (pendingExpenseApprovals().length === 0) {
                <p class="all-clear">No pending expense approvals.</p>
              } @else {
                @for (req of pendingExpenseApprovals(); track req.id) {
                  <div class="approval-item">
                    <span class="approval-item-id">{{ req.approvable_id | slice: 0 : 8 }}…</span>
                    <span class="approval-item-date">{{ req.created_at | slice: 0 : 10 }}</span>
                  </div>
                }
              }
            </div>

            <div class="approval-group">
              <div class="approval-group-header">
                <p class="approval-group-title">Guaranteed Payments</p>
                @if (pendingGpApprovals().length > 0) {
                  <span class="approval-badge">{{ pendingGpApprovals().length }}</span>
                }
              </div>
              @if (pendingGpApprovals().length === 0) {
                <p class="all-clear">No pending guaranteed payment approvals.</p>
              } @else {
                @for (req of pendingGpApprovals(); track req.id) {
                  <div class="approval-item">
                    <span class="approval-item-id">{{ req.approvable_id | slice: 0 : 8 }}…</span>
                    <span class="approval-item-date">{{ req.created_at | slice: 0 : 10 }}</span>
                  </div>
                }
              }
            </div>
          }
        </div>

        <div class="recent-expenses" style="margin-top:2rem">
          <h2>Recent expenses</h2>
          @if (recentExpenses().length === 0 && !loading()) {
            <p style="color:#a0aec0;font-size:0.9375rem">No expenses recorded yet.</p>
          } @else {
            @for (exp of recentExpenses(); track exp.id) {
              <div class="expense-card">
                <h3>{{ exp.description }}</h3>
                <div class="expense-meta">
                  <span>{{ exp.amount | currency }}</span>
                  <span>{{ exp.date | date: 'mediumDate' }}</span>
                </div>
              </div>
            }
            <a class="view-all-link" routerLink="/expenses">
              <ng-icon name="heroArrowRight" size="14" />
              View all expenses
            </a>
          }
        </div>
      }
    </div>
  `,
})
export class DashboardPage implements OnInit {
  private readonly propertyService = inject(PropertyService);
  private readonly leaseService = inject(LeaseService);
  private readonly expenseService = inject(ExpenseService);
  private readonly approvalService = inject(ApprovalService);
  private readonly roles = inject(RoleService);
  private readonly title = inject(Title);

  readonly loading = signal(true);
  readonly stats = signal<DashboardStats | null>(null);
  readonly recentExpenses = signal<ExpenseWithCategory[]>([]);
  readonly pendingApprovals = signal<ApprovalRequirement[]>([]);
  readonly approvalsLoading = signal(true);

  readonly pendingExpenseApprovals = computed(() =>
    this.pendingApprovals().filter((r) => r.approvable_type === 'expense'),
  );

  readonly pendingGpApprovals = computed(() =>
    this.pendingApprovals().filter((r) => r.approvable_type === 'guaranteed_payment'),
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
      this.approvalService.getPendingForMe().subscribe({
        next: (items) => {
          this.pendingApprovals.set(items);
          this.approvalsLoading.set(false);
        },
        error: () => this.approvalsLoading.set(false),
      });
    } else {
      this.approvalsLoading.set(false);
    }
  }
}
