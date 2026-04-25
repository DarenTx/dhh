import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { DatePipe, JsonPipe } from '@angular/common';
import { AuditRow, AuditService, AuditLoadParams } from '../../core/services/audit.service';

const PAGE_SIZE = 150;

@Component({
  selector: 'app-audit-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, DatePipe, JsonPipe],
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

    .filters {
      padding: 1rem 1.5rem;
      display: flex;
      flex-wrap: wrap;
      gap: 0.75rem;
      align-items: flex-end;
      border-bottom: 1px solid #e2e8f0;
      background: #f7fafc;
    }

    .filter-group {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }

    label {
      font-size: 0.75rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #718096;
    }

    input[type='date'],
    select {
      padding: 0.375rem 0.625rem;
      border: 1px solid #cbd5e0;
      border-radius: 0.375rem;
      font-size: 0.875rem;
      color: #2d3748;
      background: #fff;
      outline: none;

      &:focus {
        border-color: #4299e1;
      }
    }

    .btn {
      padding: 0.375rem 0.875rem;
      border-radius: 0.375rem;
      font-size: 0.875rem;
      font-weight: 600;
      cursor: pointer;
      border: none;
    }

    .btn-primary {
      background: #4299e1;
      color: #fff;
    }
    .btn-ghost {
      background: transparent;
      color: #4299e1;
      border: 1px solid #bee3f8;
    }

    .content {
      padding: 0 1.5rem 1.5rem;
    }

    .empty-state {
      padding: 3rem 0;
      text-align: center;
      color: #718096;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.875rem;
      margin-top: 1rem;
    }

    th {
      text-align: left;
      padding: 0.5rem 0.75rem;
      font-size: 0.75rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #718096;
      border-bottom: 2px solid #e2e8f0;
    }

    td {
      padding: 0.625rem 0.75rem;
      border-bottom: 1px solid #edf2f7;
      color: #4a5568;
      vertical-align: top;
    }

    tr.expandable {
      cursor: pointer;
    }
    tr.expandable:hover td {
      background: #f7fafc;
    }

    .op-badge {
      display: inline-block;
      padding: 0.125rem 0.5rem;
      border-radius: 9999px;
      font-size: 0.75rem;
      font-weight: 600;
    }

    .op-INSERT {
      background: #f0fff4;
      color: #276749;
    }
    .op-UPDATE {
      background: #ebf4ff;
      color: #2b6cb0;
    }
    .op-DELETE {
      background: #fff5f5;
      color: #c53030;
    }

    .diff-row td {
      background: #f7fafc;
      padding: 0.75rem;
    }

    pre {
      margin: 0;
      font-size: 0.8125rem;
      white-space: pre-wrap;
      word-break: break-word;
      max-height: 16rem;
      overflow-y: auto;
    }

    .pagination {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 1rem 0;
      font-size: 0.9375rem;
      color: #4a5568;
    }
  `,
  template: `
    <div class="page-header">
      <h1>Audit Log</h1>
    </div>

    <div class="filters">
      <div class="filter-group">
        <label for="from">From</label>
        <input id="from" type="date" [(ngModel)]="filters.from" />
      </div>
      <div class="filter-group">
        <label for="to">To</label>
        <input id="to" type="date" [(ngModel)]="filters.to" />
      </div>
      <div class="filter-group">
        <label for="table">Table</label>
        <select id="table" [(ngModel)]="filters.table">
          <option value="">All tables</option>
          <option value="user_roles">user_roles</option>
          <option value="app_settings">app_settings</option>
          <option value="expense_subcategories">expense_subcategories</option>
          <option value="approval_requirements">approval_requirements</option>
        </select>
      </div>
      <div class="filter-group">
        <label for="operation">Operation</label>
        <select id="operation" [(ngModel)]="filters.operation">
          <option value="">All operations</option>
          <option value="INSERT">INSERT</option>
          <option value="UPDATE">UPDATE</option>
          <option value="DELETE">DELETE</option>
        </select>
      </div>
      <button class="btn btn-primary" (click)="applyFilters()">Apply</button>
      <button class="btn btn-ghost" (click)="clearFilters()">Clear</button>
    </div>

    <div class="content">
      @if (rows().length === 0 && !loading()) {
        <div class="empty-state">No audit records found.</div>
      } @else {
        <table>
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>User</th>
              <th>Table</th>
              <th>Operation</th>
              <th>Record ID</th>
            </tr>
          </thead>
          <tbody>
            @for (row of rows(); track row.id) {
              <tr class="expandable" (click)="toggleRow(row.id)">
                <td>{{ row.performed_at | date: 'short' }}</td>
                <td>{{ row.performer_email ?? '(system)' }}</td>
                <td>{{ row.table_name }}</td>
                <td>
                  <span class="op-badge" [class]="'op-' + row.operation">
                    {{ row.operation }}
                  </span>
                </td>
                <td>{{ row.record_id }}</td>
              </tr>
              @if (expandedRowId() === row.id) {
                <tr class="diff-row">
                  <td colspan="5">
                    <strong>Before:</strong>
                    <pre>{{ row.old_data | json }}</pre>
                    <strong>After:</strong>
                    <pre>{{ row.new_data | json }}</pre>
                  </td>
                </tr>
              }
            }
          </tbody>
        </table>

        @if (totalCount() > PAGE_SIZE) {
          <div class="pagination">
            <button
              class="btn btn-ghost"
              [disabled]="currentPage() <= 1"
              (click)="goToPage(currentPage() - 1)"
            >
              ← Prev
            </button>
            <span>Page {{ currentPage() }} of {{ totalPages() }}</span>
            <button
              class="btn btn-ghost"
              [disabled]="currentPage() >= totalPages()"
              (click)="goToPage(currentPage() + 1)"
            >
              Next →
            </button>
          </div>
        }
      }
    </div>
  `,
})
export class AuditPage {
  private readonly auditService = inject(AuditService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly PAGE_SIZE = PAGE_SIZE;
  readonly rows = signal<AuditRow[]>([]);
  readonly totalCount = signal(0);
  readonly currentPage = signal(1);
  readonly loading = signal(false);
  readonly expandedRowId = signal<string | null>(null);

  filters: { from?: string; to?: string; table?: string; operation?: string } = {};

  totalPages(): number {
    return Math.max(1, Math.ceil(this.totalCount() / PAGE_SIZE));
  }

  constructor() {
    this.route.queryParamMap.subscribe((params) => {
      const page = parseInt(params.get('page') ?? '1', 10);
      this.currentPage.set(isNaN(page) || page < 1 ? 1 : page);
      this.load();
    });
  }

  private load(): void {
    this.loading.set(true);
    const params: AuditLoadParams = {
      page: this.currentPage(),
      ...(this.filters.from ? { from: this.filters.from } : {}),
      ...(this.filters.to ? { to: this.filters.to } : {}),
      ...(this.filters.table ? { table: this.filters.table } : {}),
      ...(this.filters.operation
        ? { operation: this.filters.operation as AuditLoadParams['operation'] }
        : {}),
    };

    this.auditService.loadAudit(params).subscribe({
      next: (result) => {
        this.rows.set(result.rows);
        this.totalCount.set(result.totalCount);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  applyFilters(): void {
    this.router.navigate([], { queryParams: { page: 1 }, replaceUrl: true });
  }

  clearFilters(): void {
    this.filters = {};
    this.router.navigate([], { queryParams: { page: 1 }, replaceUrl: true });
  }

  goToPage(page: number): void {
    this.router.navigate([], { queryParams: { page }, replaceUrl: true });
  }

  toggleRow(id: string): void {
    this.expandedRowId.set(this.expandedRowId() === id ? null : id);
  }
}
