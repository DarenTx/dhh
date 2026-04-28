import {
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
  OnInit,
  output,
  signal,
} from '@angular/core';
import { NgIconComponent } from '@ng-icons/core';
import { Lease } from '../../../core/services/lease.service';
import { Tenant, TenantService } from '../../../core/services/tenant.service';
import { TenantFormComponent } from '../tenant-form/tenant-form.component';

type View = 'list' | 'add' | 'edit';

@Component({
  selector: 'app-lease-tenant-form',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgIconComponent, TenantFormComponent],
  styles: `
    .tenant-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.75rem;
      padding: 0.625rem 0;
      border-bottom: 1px solid #f7fafc;
    }

    .tenant-row:last-of-type {
      border-bottom: none;
    }

    .tenant-name {
      font-weight: 600;
      font-size: 0.9375rem;
      color: #2d3748;
      margin: 0;
    }

    .tenant-contact {
      font-size: 0.8125rem;
      color: #718096;
      margin: 0.125rem 0 0;
    }

    .tenant-actions {
      display: flex;
      gap: 0.375rem;
      flex-shrink: 0;
    }

    .btn-icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 2rem;
      height: 2rem;
      border-radius: 0.375rem;
      border: 1px solid #e2e8f0;
      background: #fff;
      color: #4a5568;
      cursor: pointer;

      &:hover {
        background: #f7fafc;
      }
      &:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
    }

    .btn-icon.danger {
      color: #e53e3e;

      &:hover {
        background: #fff5f5;
        border-color: #fed7d7;
      }
    }

    .empty {
      color: #a0aec0;
      font-size: 0.9375rem;
      margin: 0.5rem 0 0.75rem;
    }

    .btn-add {
      display: flex;
      align-items: center;
      gap: 0.375rem;
      padding: 0.5rem 1rem;
      background: #2b6cb0;
      color: #fff;
      border: none;
      border-radius: 0.375rem;
      font-size: 0.875rem;
      font-weight: 500;
      cursor: pointer;
      margin-top: 0.875rem;

      &:hover {
        background: #2c5282;
      }
    }

    .actions {
      display: flex;
      justify-content: flex-end;
      margin-top: 1.25rem;
      padding-top: 1rem;
      border-top: 1px solid #e2e8f0;
    }

    .btn-done {
      padding: 0.5rem 1.25rem;
      background: #2b6cb0;
      color: #fff;
      border: none;
      border-radius: 0.375rem;
      font-size: 0.9375rem;
      font-weight: 500;
      cursor: pointer;

      &:hover {
        background: #2c5282;
      }
    }

    .back-btn {
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
      font-size: 0.875rem;
      color: #2b6cb0;
      background: none;
      border: none;
      cursor: pointer;
      padding: 0;
      margin-bottom: 1rem;

      &:hover {
        text-decoration: underline;
      }
    }

    .sub-heading {
      font-size: 1rem;
      font-weight: 600;
      color: #2d3748;
      margin: 0 0 1rem;
    }

    .error {
      font-size: 0.8125rem;
      color: #e53e3e;
      margin: 0.5rem 0 0;
    }
  `,
  template: `
    @if (view() === 'list') {
      @if (loading()) {
        <p class="empty">Loading tenants…</p>
      } @else if (tenants().length === 0) {
        <p class="empty">No tenants linked to this lease yet.</p>
      } @else {
        @for (tenant of tenants(); track tenant.id) {
          <div class="tenant-row">
            <div>
              <p class="tenant-name">{{ tenant.first_name }} {{ tenant.last_name }}</p>
              @if (tenant.email || tenant.phone) {
                <p class="tenant-contact">
                  {{ tenant.email }}{{ tenant.email && tenant.phone ? ' · ' : '' }}{{ tenant.phone }}
                </p>
              }
            </div>
            <div class="tenant-actions">
              <button
                class="btn-icon"
                type="button"
                (click)="startEdit(tenant)"
                aria-label="Edit tenant"
              >
                <ng-icon name="heroPencilSquare" size="14" />
              </button>
              <button
                class="btn-icon danger"
                type="button"
                (click)="removeTenant(tenant)"
                [disabled]="removingId() === tenant.id"
                aria-label="Remove tenant from lease"
              >
                <ng-icon name="heroXMark" size="14" />
              </button>
            </div>
          </div>
        }
      }

      @if (removeError()) {
        <p class="error">{{ removeError() }}</p>
      }

      <button class="btn-add" type="button" (click)="view.set('add')">
        <ng-icon name="heroPlus" size="15" />
        Add tenant
      </button>

      <div class="actions">
        <button class="btn-done" type="button" (click)="done.emit()">Done</button>
      </div>
    } @else {
      <button class="back-btn" type="button" (click)="cancelSubform()">
        <ng-icon name="heroChevronLeft" size="14" />
        Back to tenants
      </button>
      <p class="sub-heading">{{ view() === 'edit' ? 'Edit tenant' : 'Add tenant' }}</p>

      @if (linkError()) {
        <p class="error">{{ linkError() }}</p>
      }

      <app-tenant-form
        [tenant]="editingTenant()"
        (saved)="onTenantFormSaved($event)"
        (cancelled)="cancelSubform()"
      />
    }
  `,
})
export class LeaseTenantFormComponent implements OnInit {
  readonly lease = input.required<Lease>();

  readonly done = output<void>();
  readonly changed = output<Tenant[]>();

  private readonly tenantService = inject(TenantService);

  readonly tenants = signal<Tenant[]>([]);
  readonly loading = signal(false);
  readonly view = signal<View>('list');
  readonly editingTenant = signal<Tenant | null>(null);
  readonly removingId = signal<string | null>(null);
  readonly removeError = signal<string | null>(null);
  readonly linkError = signal<string | null>(null);

  ngOnInit(): void {
    this.loadTenants();
  }

  private loadTenants(): void {
    this.loading.set(true);
    this.tenantService.getTenantsForLease(this.lease().id).subscribe({
      next: (tenants) => {
        this.tenants.set(tenants);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  startEdit(tenant: Tenant): void {
    this.editingTenant.set(tenant);
    this.view.set('edit');
  }

  cancelSubform(): void {
    this.editingTenant.set(null);
    this.linkError.set(null);
    this.view.set('list');
  }

  onTenantFormSaved(tenant: Tenant): void {
    if (this.view() === 'edit') {
      this.tenants.update((prev) => {
        const idx = prev.findIndex((t) => t.id === tenant.id);
        if (idx < 0) return prev;
        const updated = [...prev];
        updated[idx] = tenant;
        return updated;
      });
      this.editingTenant.set(null);
      this.view.set('list');
      this.changed.emit(this.tenants());
    } else {
      // 'add': tenant was just created — link it to this lease
      this.linkError.set(null);
      this.tenantService.linkTenantToLease(this.lease().id, tenant.id).subscribe({
        next: () => {
          this.tenants.update((prev) => [...prev, tenant]);
          this.view.set('list');
          this.changed.emit(this.tenants());
        },
        error: () => {
          this.linkError.set('Tenant was created but could not be linked to this lease.');
        },
      });
    }
  }

  removeTenant(tenant: Tenant): void {
    this.removingId.set(tenant.id);
    this.removeError.set(null);
    this.tenantService.unlinkTenantFromLease(this.lease().id, tenant.id).subscribe({
      next: () => {
        this.tenants.update((prev) => prev.filter((t) => t.id !== tenant.id));
        this.removingId.set(null);
        this.changed.emit(this.tenants());
      },
      error: () => {
        this.removingId.set(null);
        this.removeError.set('Failed to remove tenant from lease.');
      },
    });
  }
}
