import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { Title } from '@angular/platform-browser';
import { NgIconComponent } from '@ng-icons/core';
import { PropertyService } from '../../core/services/property.service';
import { ExpenseService, ExpenseWithCategory } from '../../core/services/expense.service';
import { RoleService } from '../../core/role/role.service';

interface DashboardStats {
  totalProperties: number;
  occupiedProperties: number;
  vacantProperties: number;
}

@Component({
  selector: 'app-dashboard-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, NgIconComponent, CurrencyPipe, DatePipe],
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

    .expense-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0.625rem 0;
      border-bottom: 1px solid #f7fafc;
      font-size: 0.9375rem;
    }

    .expense-row:last-child {
      border-bottom: none;
    }

    .expense-desc {
      color: #2d3748;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      max-width: 60%;
    }

    .expense-meta {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 0.125rem;
    }

    .expense-amount {
      font-weight: 600;
      color: #2d3748;
    }

    .expense-date {
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
          <div class="stat-card">
            <div class="stat-icon stat-icon-blue">
              <ng-icon name="heroBuildingOffice2" size="20" />
            </div>
            <p class="stat-value">{{ stats()!.totalProperties }}</p>
            <p class="stat-label">Total properties</p>
          </div>

          <div class="stat-card">
            <div class="stat-icon stat-icon-green">
              <ng-icon name="heroCheckCircle" size="20" />
            </div>
            <p class="stat-value">{{ stats()!.occupiedProperties }}</p>
            <p class="stat-label">Occupied</p>
          </div>

          <div class="stat-card">
            <div class="stat-icon stat-icon-orange">
              <ng-icon name="heroExclamationCircle" size="20" />
            </div>
            <p class="stat-value">{{ stats()!.vacantProperties }}</p>
            <p class="stat-label">Vacant</p>
          </div>
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
        <div class="recent-expenses" style="margin-top:2rem">
          <h2>Recent expenses</h2>
          @if (recentExpenses().length === 0 && !loading()) {
            <p style="color:#a0aec0;font-size:0.9375rem">No expenses recorded yet.</p>
          } @else {
            @for (exp of recentExpenses(); track exp.id) {
              <div class="expense-row">
                <span class="expense-desc">{{ exp.description }}</span>
                <div class="expense-meta">
                  <span class="expense-amount">{{ exp.amount | currency }}</span>
                  <span class="expense-date">{{ exp.date | date: 'mediumDate' }}</span>
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
  private readonly expenseService = inject(ExpenseService);
  private readonly roles = inject(RoleService);
  private readonly title = inject(Title);

  readonly loading = signal(true);
  readonly stats = signal<DashboardStats | null>(null);
  readonly recentExpenses = signal<ExpenseWithCategory[]>([]);

  canManage(): boolean {
    return this.roles.isManagerOrAbove();
  }

  ngOnInit(): void {
    this.title.setTitle('Dashboard – DHH');
    this.propertyService.getProperties().subscribe({
      next: (properties) => {
        const occupied = properties.filter((p) => p.isOccupied).length;
        this.stats.set({
          totalProperties: properties.length,
          occupiedProperties: occupied,
          vacantProperties: properties.length - occupied,
        });
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });

    if (this.canManage()) {
      this.expenseService.getRecentExpenses(5).subscribe({
        next: (expenses) => this.recentExpenses.set(expenses),
        error: () => {},
      });
    }
  }
}
