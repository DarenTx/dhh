import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { NgIconComponent } from '@ng-icons/core';
import { Tenant, TenantService } from '../../core/services/tenant.service';
import { Lease, LeaseService } from '../../core/services/lease.service';
import { RoleService } from '../../core/role/role.service';
import { NotesSectionComponent } from '../../shared/components/notes-section/notes-section.component';
import { TenantFormComponent } from '../properties/tenant-form/tenant-form.component';

type TabId = 'info' | 'leases' | 'notes';

const TABS: { id: TabId; label: string }[] = [
  { id: 'info', label: 'Info' },
  { id: 'leases', label: 'Lease history' },
  { id: 'notes', label: 'Notes' },
];

@Component({
  selector: 'app-tenant-detail-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, NgIconComponent, NotesSectionComponent, TenantFormComponent],
  styles: `
    .breadcrumb {
      display: flex;
      align-items: center;
      gap: 0.375rem;
      padding: 1rem 1.5rem 0;
      font-size: 0.875rem;
      color: #718096;

      a {
        color: #2b6cb0;
        text-decoration: none;
        &:hover {
          text-decoration: underline;
        }
      }
    }

    .header {
      padding: 0.75rem 1.5rem 0;
      display: flex;
      align-items: flex-start;
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

    .tab-bar {
      display: flex;
      gap: 0;
      border-bottom: 1px solid #e2e8f0;
      padding: 0 1.5rem;
      margin-top: 1rem;
      overflow-x: auto;
    }

    .tab-btn {
      padding: 0.625rem 1rem;
      background: none;
      border: none;
      border-bottom: 2px solid transparent;
      font-size: 0.9375rem;
      font-weight: 500;
      color: #718096;
      cursor: pointer;
      white-space: nowrap;
      transition:
        color 0.15s,
        border-color 0.15s;
      margin-bottom: -1px;

      &:hover {
        color: #2d3748;
      }
      &.active {
        color: #2b6cb0;
        border-bottom-color: #2b6cb0;
      }
    }

    .tab-content {
      padding: 1.5rem;
      padding-bottom: 4rem;
    }

    .info-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0.75rem 2rem;
      max-width: 480px;
    }

    @media (max-width: 400px) {
      .info-grid {
        grid-template-columns: 1fr;
      }
    }

    .detail-label {
      font-size: 0.8125rem;
      color: #a0aec0;
      margin: 0;
    }
    .detail-value {
      font-size: 1rem;
      color: #2d3748;
      margin: 0;
      font-weight: 500;
    }

    .lease-card {
      background: #fff;
      border: 1px solid #e2e8f0;
      border-radius: 0.5rem;
      padding: 1rem;
      margin-bottom: 0.75rem;
    }

    .lease-card h3 {
      margin: 0 0 0.5rem;
      font-size: 1rem;
      font-weight: 600;
      color: #2d3748;
    }
    .lease-meta {
      font-size: 0.875rem;
      color: #718096;
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem 1.5rem;
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
      color: #a0aec0;
    }
    .loading {
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
    <nav class="breadcrumb">
      <a routerLink="/tenants">Tenants</a>
      <span>/</span>
      <span>{{ tenant() ? tenant()!.first_name + ' ' + tenant()!.last_name : 'Loading…' }}</span>
    </nav>

    @if (loading()) {
      <p style="padding: 2rem 1.5rem; color: #718096;">Loading…</p>
    } @else if (!tenant()) {
      <p style="padding: 2rem 1.5rem; color: #e53e3e;">Tenant not found.</p>
    } @else {
      <div class="header">
        <h1>{{ tenant()!.first_name }} {{ tenant()!.last_name }}</h1>
        @if (canManage()) {
          <button class="btn-primary" (click)="showForm.set(true)">
            <ng-icon name="heroPencilSquare" size="16" />
            Edit
          </button>
        }
      </div>

      <div class="tab-bar">
        @for (tab of tabs; track tab.id) {
          <button
            class="tab-btn"
            [class.active]="activeTab() === tab.id"
            (click)="activeTab.set(tab.id)"
          >
            {{ tab.label }}
          </button>
        }
      </div>

      <div class="tab-content">
        @switch (activeTab()) {
          @case ('info') {
            <div class="info-grid">
              @if (canViewPII()) {
                @if (tenant()!.email) {
                  <div>
                    <p class="detail-label">Email</p>
                    <p class="detail-value">{{ tenant()!.email }}</p>
                  </div>
                }
                @if (tenant()!.phone) {
                  <div>
                    <p class="detail-label">Phone</p>
                    <p class="detail-value">{{ tenant()!.phone }}</p>
                  </div>
                }
              } @else {
                <p style="color:#a0aec0;font-size:0.875rem;">
                  Contact details are visible to managers only.
                </p>
              }
            </div>
          }

          @case ('leases') {
            @if (leasesLoading()) {
              <p class="loading">Loading lease history…</p>
            } @else if (leases().length === 0) {
              <p class="empty">No lease history.</p>
            } @else {
              @for (lease of leases(); track lease.id) {
                <div class="lease-card">
                  <h3>
                    <a [routerLink]="['/properties', lease.property_id]">
                      {{ lease.property_id }}
                    </a>
                    — {{ lease.status }}
                  </h3>
                  <div class="lease-meta">
                    <span>Start: {{ lease.start_date }}</span>
                    @if (lease.end_date) {
                      <span>End: {{ lease.end_date }}</span>
                    }
                  </div>
                </div>
              }
            }
          }

          @case ('notes') {
            @if (tenant()) {
              <app-notes-section entityType="tenant" [entityId]="tenant()!.id" />
            }
          }
        }
      </div>
    }

    @if (showForm() && tenant()) {
      <div class="modal-backdrop" (click)="showForm.set(false)">
        <div class="modal" (click)="$event.stopPropagation()">
          <h2>Edit tenant</h2>
          <app-tenant-form
            [tenant]="tenant()"
            (saved)="onTenantSaved($event)"
            (cancelled)="showForm.set(false)"
          />
        </div>
      </div>
    }
  `,
})
export class TenantDetailPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly tenantService = inject(TenantService);
  private readonly leaseService = inject(LeaseService);
  private readonly roles = inject(RoleService);
  private readonly title = inject(Title);

  readonly tabs = TABS;
  readonly loading = signal(true);
  readonly tenant = signal<Tenant | null>(null);
  readonly activeTab = signal<TabId>('info');

  readonly leases = signal<Lease[]>([]);
  readonly leasesLoading = signal(false);

  readonly showForm = signal(false);

  canManage(): boolean {
    return this.roles.isManagerOrAbove();
  }
  canViewPII(): boolean {
    return this.roles.isManagerOrAbove();
  }

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id')!;
    this.tenantService.getTenant(id).subscribe({
      next: (t) => {
        this.tenant.set(t);
        this.title.setTitle(`${t.first_name} ${t.last_name} – DHH`);
        this.loading.set(false);
        this.loadLeases(id);
      },
      error: () => this.loading.set(false),
    });
  }

  private loadLeases(tenantId: string): void {
    this.leasesLoading.set(true);
    this.leaseService.getLeasesForTenant(tenantId).subscribe({
      next: (leases) => {
        this.leases.set(leases);
        this.leasesLoading.set(false);
      },
      error: () => this.leasesLoading.set(false),
    });
  }

  onTenantSaved(updated: Tenant): void {
    this.tenant.set(updated);
    this.title.setTitle(`${updated.first_name} ${updated.last_name} – DHH`);
    this.showForm.set(false);
  }
}
