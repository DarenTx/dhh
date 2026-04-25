import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Title } from '@angular/platform-browser';
import { NgIconComponent } from '@ng-icons/core';
import { Tenant, TenantService } from '../../core/services/tenant.service';
import { RoleService } from '../../core/role/role.service';
import { TenantFormComponent } from '../properties/tenant-form/tenant-form.component';

@Component({
  selector: 'app-tenants-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, FormsModule, NgIconComponent, TenantFormComponent],
  styles: `
    .page-header {
      padding: 1.25rem 1.5rem 0;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.75rem;
      flex-wrap: wrap;
    }

    h1 {
      margin: 0;
      font-size: 1.375rem;
      font-weight: 700;
      color: #2d3748;
    }

    .toolbar {
      display: flex;
      gap: 0.75rem;
      padding: 1rem 1.5rem 0;
      flex-wrap: wrap;
    }

    .search-input {
      flex: 1;
      min-width: 200px;
      padding: 0.5rem 0.75rem;
      border: 1px solid #cbd5e0;
      border-radius: 0.375rem;
      font-size: 0.9375rem;
      color: #2d3748;

      &:focus {
        outline: none;
        border-color: #4299e1;
        box-shadow: 0 0 0 2px rgb(66 153 225 / 0.25);
      }
    }

    .tenant-list {
      padding: 1rem 1.5rem;
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .tenant-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: #fff;
      border: 1px solid #e2e8f0;
      border-radius: 0.5rem;
      padding: 0.875rem 1rem;
      text-decoration: none;
      color: inherit;
      transition:
        border-color 0.15s,
        box-shadow 0.15s;

      &:hover {
        border-color: #bee3f8;
        box-shadow: 0 1px 4px rgb(0 0 0 / 0.06);
      }
    }

    .tenant-name {
      font-weight: 600;
      color: #2d3748;
      margin: 0;
      font-size: 1rem;
    }
    .tenant-email {
      font-size: 0.875rem;
      color: #718096;
      margin: 0;
    }

    .btn-primary {
      display: flex;
      align-items: center;
      gap: 0.375rem;
      padding: 0.5rem 1rem;
      background: #2b6cb0;
      color: #fff;
      border: none;
      border-radius: 0.375rem;
      font-size: 0.9375rem;
      font-weight: 500;
      cursor: pointer;
      white-space: nowrap;

      &:hover {
        background: #2c5282;
      }
    }

    .empty {
      padding: 2rem 1.5rem;
      color: #a0aec0;
    }
    .loading {
      padding: 2rem 1.5rem;
      color: #718096;
    }

    .modal-backdrop {
      position: fixed;
      inset: 0;
      background: rgb(0 0 0 / 0.4);
      z-index: 100;
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

    .modal h2 {
      margin: 0 0 1.25rem;
      font-size: 1.25rem;
      font-weight: 700;
      color: #2d3748;
    }
  `,
  template: `
    <div class="page-header">
      <h1>Tenants</h1>
      @if (canManage()) {
        <button class="btn-primary" (click)="showForm.set(true)">
          <ng-icon name="heroPlus" size="16" />
          Add tenant
        </button>
      }
    </div>

    <div class="toolbar">
      <input
        class="search-input"
        type="search"
        placeholder="Search by name or email…"
        [(ngModel)]="searchQuery"
        aria-label="Search tenants"
      />
    </div>

    @if (loading()) {
      <p class="loading">Loading tenants…</p>
    } @else if (filtered().length === 0) {
      <p class="empty">
        {{ searchQuery() ? 'No tenants match your search.' : 'No tenants yet.' }}
      </p>
    } @else {
      <div class="tenant-list">
        @for (tenant of filtered(); track tenant.id) {
          <a class="tenant-row" [routerLink]="['/tenants', tenant.id]">
            <div>
              <p class="tenant-name">{{ tenant.last_name }}, {{ tenant.first_name }}</p>
              @if (canViewPII() && tenant.email) {
                <p class="tenant-email">{{ tenant.email }}</p>
              }
            </div>
            <ng-icon name="heroChevronRight" size="18" style="color:#a0aec0" />
          </a>
        }
      </div>
    }

    @if (showForm()) {
      <div class="modal-backdrop" (click)="showForm.set(false)">
        <div class="modal" (click)="$event.stopPropagation()">
          <h2>Add tenant</h2>
          <app-tenant-form (saved)="onTenantSaved($event)" (cancelled)="showForm.set(false)" />
        </div>
      </div>
    }
  `,
})
export class TenantsPage implements OnInit {
  private readonly tenantService = inject(TenantService);
  private readonly roles = inject(RoleService);
  private readonly title = inject(Title);

  readonly loading = signal(true);
  readonly tenants = signal<Tenant[]>([]);
  readonly searchQuery = signal('');
  readonly showForm = signal(false);

  readonly filtered = computed(() => {
    const q = this.searchQuery().toLowerCase().trim();
    if (!q) return this.tenants();
    return this.tenants().filter(
      (t) =>
        t.first_name.toLowerCase().includes(q) ||
        t.last_name.toLowerCase().includes(q) ||
        (t.email ?? '').toLowerCase().includes(q),
    );
  });

  canManage(): boolean {
    return this.roles.isManagerOrAbove();
  }
  canViewPII(): boolean {
    return this.roles.isManagerOrAbove();
  }

  ngOnInit(): void {
    this.title.setTitle('Tenants – DHH');
    this.tenantService.getTenants().subscribe({
      next: (tenants) => {
        this.tenants.set(tenants);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  onTenantSaved(tenant: Tenant): void {
    this.tenants.update((prev) =>
      [...prev, tenant].sort(
        (a, b) =>
          a.last_name.localeCompare(b.last_name) || a.first_name.localeCompare(b.first_name),
      ),
    );
    this.showForm.set(false);
  }
}
