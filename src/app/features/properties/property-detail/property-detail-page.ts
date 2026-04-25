import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { DecimalPipe, CurrencyPipe, DatePipe, TitleCasePipe } from '@angular/common';
import { NgIconComponent } from '@ng-icons/core';
import {
  Property,
  PropertyWithOccupancy,
  PropertyService,
} from '../../../core/services/property.service';
import { Lease, LeaseService } from '../../../core/services/lease.service';
import { Tenant, TenantService } from '../../../core/services/tenant.service';
import { RoleService } from '../../../core/role/role.service';
import { NotesSectionComponent } from '../../../shared/components/notes-section/notes-section.component';
import { PropertyFormComponent } from '../property-form/property-form.component';
import { LeaseFormComponent } from '../lease-form/lease-form.component';
import { TenantFormComponent } from '../tenant-form/tenant-form.component';
import { NewTenancyWizardComponent } from '../new-tenancy-wizard/new-tenancy-wizard.component';

type TabId = 'overview' | 'leases' | 'tenants' | 'notes';

const TABS: { id: TabId; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'leases', label: 'Leases' },
  { id: 'tenants', label: 'Tenants' },
  { id: 'notes', label: 'Notes' },
];

@Component({
  selector: 'app-property-detail-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    DecimalPipe,
    CurrencyPipe,
    DatePipe,
    TitleCasePipe,
    NgIconComponent,
    NotesSectionComponent,
    PropertyFormComponent,
    LeaseFormComponent,
    TenantFormComponent,
    NewTenancyWizardComponent,
  ],
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

    .sub {
      margin: 0;
      font-size: 0.9375rem;
      color: #718096;
    }

    .badge {
      font-size: 0.75rem;
      font-weight: 600;
      padding: 0.2rem 0.5rem;
      border-radius: 9999px;
      align-self: flex-start;
    }

    .badge-occupied {
      background: #c6f6d5;
      color: #276749;
    }
    .badge-vacant {
      background: #fed7d7;
      color: #9b2c2c;
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

    .overview-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0.75rem 2rem;
      max-width: 480px;
    }

    @media (max-width: 400px) {
      .overview-grid {
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

    .action-bar {
      display: flex;
      justify-content: flex-end;
      margin-bottom: 1rem;
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

      &:hover {
        background: #2c5282;
      }
    }

    .lease-card,
    .tenant-card {
      background: #fff;
      border: 1px solid #e2e8f0;
      border-radius: 0.5rem;
      padding: 1rem;
      margin-bottom: 0.75rem;
    }

    .lease-card h3,
    .tenant-card h3 {
      margin: 0 0 0.5rem;
      font-size: 1rem;
      font-weight: 600;
      color: #2d3748;
    }

    .lease-meta,
    .tenant-meta {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
      gap: 0.5rem 1.5rem;
      font-size: 0.875rem;
      color: #718096;
    }

    .loading {
      color: #718096;
    }
    .empty {
      color: #a0aec0;
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
      max-width: 560px;
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
      <a routerLink="/properties">Properties</a>
      <span>/</span>
      <span>{{ property()?.address_line1 ?? 'Loading…' }}</span>
    </nav>

    @if (loading()) {
      <p style="padding: 2rem 1.5rem; color: #718096;">Loading…</p>
    } @else if (!property()) {
      <p style="padding: 2rem 1.5rem; color: #e53e3e;">Property not found.</p>
    } @else {
      <div class="header">
        <div>
          <h1>{{ property()!.address_line1 }}</h1>
          <p class="sub">{{ property()!.city }}, {{ property()!.state }} {{ property()!.zip }}</p>
        </div>
        <div style="display:flex;gap:0.5rem;align-items:center;">
          @if (property()!.isOccupied) {
            <span class="badge badge-occupied">Occupied</span>
          } @else {
            <span class="badge badge-vacant">Vacant</span>
          }
          @if (canManage()) {
            <button class="btn-primary" (click)="editProperty()">
              <ng-icon name="heroPencilSquare" size="16" />
              Edit
            </button>
          }
        </div>
      </div>

      <!-- Tab bar -->
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

      <!-- Tab content -->
      <div class="tab-content">
        @switch (activeTab()) {
          @case ('overview') {
            <div class="overview-grid">
              @if (property()!.year_built) {
                <div>
                  <p class="detail-label">Year built</p>
                  <p class="detail-value">{{ property()!.year_built }}</p>
                </div>
              }
              @if (property()!.square_footage) {
                <div>
                  <p class="detail-label">Square footage</p>
                  <p class="detail-value">{{ property()!.square_footage | number }} sq ft</p>
                </div>
              }
              @if (property()!.bedrooms) {
                <div>
                  <p class="detail-label">Bedrooms</p>
                  <p class="detail-value">{{ property()!.bedrooms }}</p>
                </div>
              }
              @if (property()!.bathrooms) {
                <div>
                  <p class="detail-label">Bathrooms</p>
                  <p class="detail-value">{{ property()!.bathrooms }}</p>
                </div>
              }
              @if (property()!.address_line2) {
                <div style="grid-column: 1 / -1">
                  <p class="detail-label">Unit</p>
                  <p class="detail-value">{{ property()!.address_line2 }}</p>
                </div>
              }
            </div>

            @if (!property()!.isOccupied && canManage()) {
              <div style="margin-top: 1.5rem;">
                <button class="btn-primary" (click)="startNewTenancy()">
                  <ng-icon name="heroPlus" size="16" />
                  Start New Tenancy
                </button>
              </div>
            }
          }

          @case ('leases') {
            @if (canManage()) {
              <div class="action-bar">
                <button class="btn-primary" (click)="showLeaseForm.set(true)">
                  <ng-icon name="heroPlus" size="16" />
                  Add lease
                </button>
              </div>
            }
            @if (leasesLoading()) {
              <p class="loading">Loading leases…</p>
            } @else if (leases().length === 0) {
              <p class="empty">No leases on record.</p>
            } @else {
              @for (lease of leases(); track lease.id) {
                <div class="lease-card">
                  <h3>Lease — {{ lease.status | titlecase }}</h3>
                  <div class="lease-meta">
                    <span>Start: {{ lease.start_date | date: 'mediumDate' }}</span>
                    @if (lease.end_date) {
                      <span>End: {{ lease.end_date | date: 'mediumDate' }}</span>
                    }
                    <span>Rent: {{ lease.monthly_rent | currency }}</span>
                    <span>Deposit: {{ lease.security_deposit | currency }}</span>
                  </div>
                </div>
              }
            }
          }

          @case ('tenants') {
            @if (canManage()) {
              <div class="action-bar">
                <button class="btn-primary" (click)="showTenantForm.set(true)">
                  <ng-icon name="heroPlus" size="16" />
                  Add tenant
                </button>
              </div>
            }
            @if (tenantsLoading()) {
              <p class="loading">Loading tenants…</p>
            } @else if (tenants().length === 0) {
              <p class="empty">No tenants on record.</p>
            } @else {
              @for (tenant of tenants(); track tenant.id) {
                <div class="tenant-card">
                  <h3>{{ tenant.first_name }} {{ tenant.last_name }}</h3>
                  <div class="tenant-meta">
                    @if (canViewPII()) {
                      @if (tenant.email) {
                        <span>{{ tenant.email }}</span>
                      }
                      @if (tenant.phone) {
                        <span>{{ tenant.phone }}</span>
                      }
                    }
                  </div>
                </div>
              }
            }
          }

          @case ('notes') {
            @if (property()) {
              <app-notes-section entityType="property" [entityId]="property()!.id" />
            }
          }
        }
      </div>
    }

    <!-- Edit property modal -->
    @if (showPropertyForm()) {
      <div class="modal-backdrop" (click)="showPropertyForm.set(false)">
        <div class="modal" (click)="$event.stopPropagation()">
          <h2>Edit property</h2>
          <app-property-form
            [property]="property()"
            (saved)="onPropertySaved($event)"
            (cancelled)="showPropertyForm.set(false)"
          />
        </div>
      </div>
    }

    <!-- Add lease modal -->
    @if (showLeaseForm()) {
      <div class="modal-backdrop" (click)="showLeaseForm.set(false)">
        <div class="modal" (click)="$event.stopPropagation()">
          <h2>Add lease</h2>
          <app-lease-form
            [propertyId]="property()!.id"
            (saved)="onLeaseSaved($event)"
            (cancelled)="showLeaseForm.set(false)"
          />
        </div>
      </div>
    }

    <!-- Add tenant modal -->
    @if (showTenantForm()) {
      <div class="modal-backdrop" (click)="showTenantForm.set(false)">
        <div class="modal" (click)="$event.stopPropagation()">
          <h2>Add tenant</h2>
          <app-tenant-form
            (saved)="onTenantSaved($event)"
            (cancelled)="showTenantForm.set(false)"
          />
        </div>
      </div>
    }

    <!-- New tenancy wizard modal -->
    @if (showWizard()) {
      <div class="modal-backdrop" (click)="showWizard.set(false)">
        <div class="modal" (click)="$event.stopPropagation()">
          <h2>Start new tenancy</h2>
          <app-new-tenancy-wizard
            [propertyId]="property()!.id"
            (saved)="onWizardSaved($event)"
            (cancelled)="showWizard.set(false)"
          />
        </div>
      </div>
    }
  `,
})
export class PropertyDetailPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly propertyService = inject(PropertyService);
  private readonly leaseService = inject(LeaseService);
  private readonly tenantService = inject(TenantService);
  private readonly roles = inject(RoleService);
  private readonly title = inject(Title);

  readonly tabs = TABS;
  readonly loading = signal(true);
  readonly property = signal<PropertyWithOccupancy | null>(null);

  readonly activeTab = signal<TabId>('overview');

  readonly leases = signal<Lease[]>([]);
  readonly leasesLoading = signal(false);

  readonly tenants = signal<Tenant[]>([]);
  readonly tenantsLoading = signal(false);

  readonly showPropertyForm = signal(false);
  readonly showLeaseForm = signal(false);
  readonly showTenantForm = signal(false);
  readonly showWizard = signal(false);

  canManage(): boolean {
    return this.roles.isManagerOrAbove();
  }
  canViewPII(): boolean {
    return this.roles.isManagerOrAbove();
  }

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id')!;
    this.loadProperty(id);
    this.loadLeases(id);
    this.loadTenants(id);
  }

  private loadProperty(id: string): void {
    this.loading.set(true);
    this.propertyService.getProperty(id).subscribe({
      next: (p) => {
        this.property.set(p);
        this.title.setTitle(`${p.address_line1} – DHH`);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  private loadLeases(propertyId: string): void {
    this.leasesLoading.set(true);
    this.leaseService.getLeasesForProperty(propertyId).subscribe({
      next: (leases) => {
        this.leases.set(leases);
        this.leasesLoading.set(false);
      },
      error: () => this.leasesLoading.set(false),
    });
  }

  private loadTenants(propertyId: string): void {
    this.tenantsLoading.set(true);
    // Get all leases for the property, then fetch tenants for each
    this.leaseService.getLeasesForProperty(propertyId).subscribe({
      next: (leases) => {
        if (leases.length === 0) {
          this.tenants.set([]);
          this.tenantsLoading.set(false);
          return;
        }
        const activeLease = leases.find((l) => l.status === 'active') ?? leases[0];
        this.tenantService.getTenantsForLease(activeLease.id).subscribe({
          next: (tenants) => {
            this.tenants.set(tenants);
            this.tenantsLoading.set(false);
          },
          error: () => this.tenantsLoading.set(false),
        });
      },
      error: () => this.tenantsLoading.set(false),
    });
  }

  editProperty(): void {
    this.showPropertyForm.set(true);
  }

  startNewTenancy(): void {
    this.showWizard.set(true);
  }

  onPropertySaved(p: Property): void {
    this.property.set({ ...p, isOccupied: this.property()?.isOccupied ?? false });
    this.showPropertyForm.set(false);
  }

  onLeaseSaved(lease: Lease): void {
    this.leases.update((prev) => [lease, ...prev]);
    this.showLeaseForm.set(false);
  }

  onTenantSaved(tenant: Tenant): void {
    this.tenants.update((prev) => [...prev, tenant]);
    this.showTenantForm.set(false);
  }

  onWizardSaved(result: { lease: Lease; tenant: Tenant }): void {
    this.leases.update((prev) => [result.lease, ...prev]);
    this.tenants.update((prev) => [...prev, result.tenant]);
    this.property.update((p) => (p ? { ...p, isOccupied: true } : p));
    this.showWizard.set(false);
    this.activeTab.set('leases');
  }
}
