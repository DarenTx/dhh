import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { DatePipe, JsonPipe } from '@angular/common';
import { NgIconComponent } from '@ng-icons/core';
import { AuditRow, AuditService, AuditLoadParams } from '../../core/services/audit.service';

const PAGE_SIZE = 150;

function fmt(data: Record<string, unknown> | null): Record<string, unknown> {
  return data ?? {};
}

function money(val: unknown): string {
  const n = Number(val);
  return isNaN(n)
    ? String(val ?? '')
    : `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function describeAuditRow(row: AuditRow): string {
  const actor = row.performer_display ?? '(system)';
  const d = fmt(row.new_data ?? row.old_data);
  const prev = fmt(row.old_data);
  const op = row.operation;

  switch (row.table_name) {
    case 'expenses': {
      const amount = money(d['amount']);
      if (op === 'INSERT') return `${actor} submitted an expense for ${amount}`;
      if (op === 'DELETE') return `${actor} deleted an expense for ${amount}`;
      if (op === 'UPDATE') {
        if (d['status'] === 'approved' && prev['status'] !== 'approved')
          return `${actor} approved an expense for ${amount}`;
        if (d['status'] === 'rejected' && prev['status'] !== 'rejected')
          return `${actor} rejected an expense for ${amount}`;
        return `${actor} updated an expense for ${amount}`;
      }
      break;
    }

    case 'guaranteed_payments': {
      const hours = d['hours_billed'];
      const desc = d['work_description'] ?? '';
      if (op === 'INSERT') return `${actor} logged ${hours} hrs — ${desc}`;
      if (op === 'DELETE') return `${actor} deleted a guaranteed payment (${hours} hrs)`;
      if (op === 'UPDATE') {
        if (d['status'] === 'approved' && prev['status'] !== 'approved')
          return `${actor} approved a guaranteed payment (${hours} hrs)`;
        if (d['status'] === 'rejected' && prev['status'] !== 'rejected')
          return `${actor} rejected a guaranteed payment (${hours} hrs)`;
        return `${actor} updated a guaranteed payment (${hours} hrs)`;
      }
      break;
    }

    case 'properties': {
      const addr = d['address_line1'] ?? 'a property';
      if (op === 'INSERT') return `${actor} added property: ${addr}`;
      if (op === 'DELETE') return `${actor} deleted property: ${addr}`;
      if (op === 'UPDATE') {
        if (d['is_active'] === false && prev['is_active'] !== false)
          return `${actor} deactivated property: ${addr}`;
        if (d['is_active'] === true && prev['is_active'] !== true)
          return `${actor} reactivated property: ${addr}`;
        return `${actor} updated property: ${addr}`;
      }
      break;
    }

    case 'tenants': {
      const name = [d['first_name'], d['last_name']].filter(Boolean).join(' ') || 'a tenant';
      if (op === 'INSERT') return `${actor} added tenant: ${name}`;
      if (op === 'DELETE') return `${actor} deleted tenant: ${name}`;
      if (op === 'UPDATE') {
        if (d['is_active'] === false && prev['is_active'] !== false)
          return `${actor} deactivated tenant: ${name}`;
        if (d['is_active'] === true && prev['is_active'] !== true)
          return `${actor} reactivated tenant: ${name}`;
        return `${actor} updated tenant: ${name}`;
      }
      break;
    }

    case 'leases': {
      const rent = money(d['monthly_rent']);
      if (op === 'INSERT') return `${actor} created a lease at ${rent}/mo`;
      if (op === 'DELETE') return `${actor} deleted a lease`;
      if (op === 'UPDATE') {
        if (d['status'] === 'terminated' && prev['status'] !== 'terminated')
          return `${actor} terminated a lease`;
        if (d['status'] === 'expired' && prev['status'] !== 'expired')
          return `${actor} marked a lease as expired`;
        return `${actor} updated a lease at ${rent}/mo`;
      }
      break;
    }

    case 'notes': {
      if (op === 'INSERT') return `${actor} added a note`;
      if (op === 'DELETE') return `${actor} deleted a note`;
      return `${actor} updated a note`;
    }

    case 'user_roles': {
      const email = d['email'] ?? 'a user';
      const role = d['role'] ?? '';
      if (op === 'INSERT') return `${actor} invited ${email} as ${role}`;
      if (op === 'DELETE') return `${actor} removed user ${email}`;
      if (op === 'UPDATE') {
        if (d['is_active'] === false && prev['is_active'] !== false)
          return `${actor} deactivated user ${email}`;
        if (d['is_active'] === true && prev['is_active'] !== true)
          return `${actor} reactivated user ${email}`;
        if (d['role'] !== prev['role']) return `${actor} changed ${email}'s role to ${role}`;
        return `${actor} updated user ${email}`;
      }
      break;
    }

    case 'app_settings': {
      if (op === 'UPDATE') return `${actor} updated application settings`;
      break;
    }

    case 'expense_subcategories': {
      const name = d['name'] ?? 'a subcategory';
      if (op === 'INSERT') return `${actor} added expense subcategory: ${name}`;
      if (op === 'DELETE') return `${actor} deleted expense subcategory: ${name}`;
      if (op === 'UPDATE') {
        if (d['is_active'] === false && prev['is_active'] !== false)
          return `${actor} disabled expense subcategory: ${name}`;
        return `${actor} updated expense subcategory: ${name}`;
      }
      break;
    }

    case 'approval_requirements': {
      if (op === 'INSERT') return `${actor} added an approval requirement`;
      if (op === 'DELETE') return `${actor} removed an approval requirement`;
      return `${actor} updated an approval requirement`;
    }

    case 'documents': {
      const title = d['title'] ?? 'a document';
      if (op === 'INSERT') return `${actor} uploaded document: ${title}`;
      if (op === 'DELETE') return `${actor} deleted document: ${title}`;
      if (op === 'UPDATE') {
        if (d['is_active'] === false && prev['is_active'] !== false)
          return `${actor} archived document: ${title}`;
        if (d['is_active'] === true && prev['is_active'] !== true)
          return `${actor} restored document: ${title}`;
        return `${actor} updated document: ${title}`;
      }
      break;
    }
  }

  // Generic fallback
  const label = row.table_name.replace(/_/g, ' ');
  const pastTense: Record<string, string> = {
    INSERT: 'inserted',
    UPDATE: 'updated',
    DELETE: 'deleted',
  };
  return `${actor} ${pastTense[op] ?? op.toLowerCase()} a ${label} record`;
}

@Component({
  selector: 'app-audit-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, DatePipe, JsonPipe, NgIconComponent],
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
      display: flex;
      align-items: center;
      gap: 0.375rem;
      padding: 0.375rem 0.875rem;
      border-radius: 0.375rem;
      font-size: 0.875rem;
      font-weight: 600;
      cursor: pointer;
      border: none;
    }

    .btn-primary {
      background: #2b6cb0;
      color: #fff;
    }
    .btn-ghost {
      background: transparent;
      color: #2b6cb0;
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

    .diff-row td {
      background: #f7fafc;
      padding: 0.75rem;
    }

    .diff-meta {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin-bottom: 0.625rem;
    }

    .diff-table {
      font-family: monospace;
      font-size: 0.8125rem;
      color: #4a5568;
      background: #edf2f7;
      padding: 0.125rem 0.5rem;
      border-radius: 0.25rem;
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
      <button class="btn btn-primary" (click)="applyFilters()">
        <ng-icon name="heroFunnel" size="16" />
        Apply
      </button>
      <button class="btn btn-ghost" (click)="clearFilters()">Clear</button>
    </div>

    <div class="content">
      @if (rows().length === 0 && !loading()) {
        <div class="empty-state">No audit records found.</div>
      } @else {
        <table>
          <thead>
            <tr>
              <th style="width: 10rem">Timestamp</th>
              <th>Description</th>
            </tr>
          </thead>
          <tbody>
            @for (row of rows(); track row.id) {
              @if (row.performer_display) {
                <tr class="expandable" (click)="toggleRow(row.id)">
                  <td>{{ row.performed_at | date: 'M/d/yy h:mm a' }}</td>
                  <td>{{ describe(row) }}</td>

                </tr>
                @if (expandedRowId() === row.id) {
                  <tr class="diff-row">
                    <td colspan="3">
                      <div class="diff-meta">
                        <span class="diff-table">{{ row.table_name }}</span>
                        <span class="op-badge op-{{ row.operation }}">{{ row.operation }}</span>
                      </div>
                      <strong>Before:</strong>
                      <pre>{{ row.old_data | json }}</pre>
                      <strong>After:</strong>
                      <pre>{{ row.new_data | json }}</pre>
                    </td>
                  </tr>
                }
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

  readonly describe = describeAuditRow;

  readonly PAGE_SIZE = PAGE_SIZE;
  readonly rows = signal<AuditRow[]>([]);
  readonly totalCount = signal(0);
  readonly currentPage = signal(1);
  readonly loading = signal(false);
  readonly expandedRowId = signal<string | null>(null);

  filters: { from: string; to: string } = AuditPage.defaultDateRange();

  private static defaultDateRange(): { from: string; to: string } {
    const today = new Date();
    const from = new Date(today);
    from.setDate(from.getDate() - 60);
    return {
      from: from.toISOString().split('T')[0],
      to: today.toISOString().split('T')[0],
    };
  }

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
    this.filters = AuditPage.defaultDateRange();
    this.router.navigate([], { queryParams: { page: 1 }, replaceUrl: true });
  }

  goToPage(page: number): void {
    this.router.navigate([], { queryParams: { page }, replaceUrl: true });
  }

  toggleRow(id: string): void {
    this.expandedRowId.set(this.expandedRowId() === id ? null : id);
  }
}
