import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { DecimalPipe, CurrencyPipe, DatePipe, TitleCasePipe } from '@angular/common';
import { NgIconComponent } from '@ng-icons/core';
import { forkJoin, of } from 'rxjs';
import {
  Property,
  PropertyWithOccupancy,
  PropertyService,
} from '../../../core/services/property.service';
import { Lease, LeaseService } from '../../../core/services/lease.service';
import { Tenant, TenantService } from '../../../core/services/tenant.service';
import { RoleService } from '../../../core/role/role.service';
import { ExpenseService, ExpenseWithCategory } from '../../../core/services/expense.service';
import { NotesSectionComponent } from '../../../shared/components/notes-section/notes-section.component';
import { DocumentService, DocumentWithProperty } from '../../../core/services/document.service';
import { DocumentUploadWizardComponent } from '../../documents/document-upload-wizard/document-upload-wizard.component';
import { DocumentEditModalComponent } from '../../documents/document-edit-modal/document-edit-modal.component';
import { PropertyFormComponent } from '../property-form/property-form.component';
import { LeaseFormComponent } from '../lease-form/lease-form.component';
import { LeaseTenantFormComponent } from '../lease-tenant-form/lease-tenant-form.component';
import { NewTenancyWizardComponent } from '../new-tenancy-wizard/new-tenancy-wizard.component';
import { MarketValueFormComponent } from '../market-value-form/market-value-form.component';
import {
  PropertyMarketValue,
  PropertyMarketValueService,
} from '../../../core/services/property-market-value.service';
import { StorageService } from '../../../core/services/storage.service';

type TabId = 'overview' | 'leases' | 'notes' | 'expenses' | 'market-values' | 'documents';

const TABS: { id: TabId; label: string; managerOnly?: boolean }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'leases', label: 'Leases' },
  { id: 'expenses', label: 'Expenses', managerOnly: true },
  { id: 'documents', label: 'Documents' },
  { id: 'notes', label: 'Notes' },
  { id: 'market-values', label: 'Market Values' },
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
    DocumentUploadWizardComponent,
    DocumentEditModalComponent,
    PropertyFormComponent,
    LeaseFormComponent,
    LeaseTenantFormComponent,
    NewTenancyWizardComponent,
    MarketValueFormComponent,
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

    .header-main {
      display: flex;
      align-items: flex-start;
      gap: 1rem;
      min-width: 0;
      flex: 1;
    }

    .header-photo {
      width: 200px;
      height: 148px;
      object-fit: cover;
      border-radius: 0.875rem;
      border: 1px solid #e2e8f0;
      background: #edf2f7;
      display: block;
      flex-shrink: 0;
    }

    .header-photo-button {
      padding: 0;
      border: none;
      background: none;
      cursor: zoom-in;
      border-radius: 0.875rem;
      flex-shrink: 0;
    }

    .header-photo-button:focus-visible {
      outline: 2px solid #2b6cb0;
      outline-offset: 3px;
    }

    .header-photo-button:hover .header-photo {
      box-shadow: 0 6px 18px rgb(0 0 0 / 0.14);
    }

    .header-photo-placeholder {
      width: 200px;
      height: 148px;
      border-radius: 0.875rem;
      border: 1px solid #e2e8f0;
      background: linear-gradient(135deg, #f7fafc, #edf2f7);
      color: #a0aec0;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .header-copy {
      min-width: 0;
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

    .overview-row {
      display: flex;
      gap: 1rem;
      align-items: flex-start;
      margin-bottom: 1.25rem;
      flex-wrap: wrap;
    }

    .overview-summary {
      background: #fff;
      border: 1px solid #e2e8f0;
      border-radius: 0.75rem;
      padding: 1.25rem;
      display: grid;
      gap: 0.875rem;
      flex: 1 1 280px;
      min-width: 0;
    }

    .hero-stat-label {
      margin: 0 0 0.25rem;
      font-size: 0.75rem;
      font-weight: 600;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      color: #718096;
    }

    .hero-stat-value {
      margin: 0;
      font-size: 1.125rem;
      font-weight: 700;
      color: #2d3748;
    }

    .hero-stat-meta {
      margin: 0.2rem 0 0;
      font-size: 0.8125rem;
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
      overflow-y: hidden;
      scrollbar-width: none;
      -ms-overflow-style: none;
    }

    .tab-bar::-webkit-scrollbar {
      display: none;
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

    .doc-link {
      display: inline-flex;
      align-items: center;
      gap: 0.375rem;
      margin-top: 0.75rem;
      font-size: 0.875rem;
      color: #2b6cb0;
      text-decoration: none;
      font-weight: 500;
    }

    .doc-link:hover {
      text-decoration: underline;
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

    .image-preview-modal {
      background: rgb(17 24 39 / 0.94);
      border-radius: 1rem;
      padding: 1rem;
      width: min(96vw, 1080px);
      max-height: 90vh;
      display: grid;
      gap: 0.75rem;
    }

    .image-preview-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
      color: #fff;
    }

    .image-preview-title {
      margin: 0;
      font-size: 0.9375rem;
      font-weight: 600;
      color: #fff;
    }

    .image-preview-close {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 2.5rem;
      height: 2.5rem;
      border-radius: 9999px;
      border: 1px solid rgb(255 255 255 / 0.18);
      background: rgb(255 255 255 / 0.08);
      color: #fff;
      cursor: pointer;
    }

    .image-preview-close:hover {
      background: rgb(255 255 255 / 0.14);
    }

    .image-preview-body {
      overflow: auto;
      display: flex;
      justify-content: center;
    }

    .image-preview-photo {
      max-width: 100%;
      max-height: calc(90vh - 92px);
      object-fit: contain;
      border-radius: 0.75rem;
      background: #111827;
    }

    .overview-card-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.5rem;
      margin-bottom: 0.25rem;
    }

    .overview-tenants {
      margin-top: 0.75rem;
      display: flex;
      flex-direction: column;
      gap: 0.375rem;
    }

    .overview-tenant-row {
      display: flex;
      flex-direction: column;
      gap: 0.125rem;
      font-size: 0.9375rem;
      color: #2d3748;
    }

    .overview-tenant-meta {
      font-size: 0.8125rem;
      color: #718096;
    }

    .btn-ghost {
      display: flex;
      align-items: center;
      gap: 0.25rem;
      padding: 0.25rem 0.6rem;
      background: none;
      border: 1px solid #e2e8f0;
      border-radius: 0.375rem;
      font-size: 0.8125rem;
      font-weight: 500;
      color: #4a5568;
      cursor: pointer;

      &:hover {
        background: #f7fafc;
      }
    }

    @media (max-width: 820px) {
      .header-main {
        width: 100%;
      }
    }

    @media (max-width: 560px) {
      .header-main {
        flex-direction: column;
      }

      .header-photo,
      .header-photo-placeholder {
        width: 100%;
        height: auto;
        aspect-ratio: 16 / 9;
      }
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
        <div class="header-main">
          @if (coverPhotoUrl()) {
            <button
              type="button"
              class="header-photo-button"
              (click)="openImagePreview()"
              [attr.aria-label]="'Open larger image for ' + property()!.address_line1"
            >
              <img
                class="header-photo"
                [src]="coverPhotoUrl()!"
                [alt]="property()!.address_line1"
              />
            </button>
          } @else {
            <div class="header-photo-placeholder">
              <ng-icon name="heroBuildingOffice2" size="40" />
            </div>
          }

          <div class="header-copy">
            <h1>{{ property()!.address_line1 }}</h1>
            <p class="sub">{{ property()!.city }}, {{ property()!.state }} {{ property()!.zip }}</p>
            <div
              style="margin-top:0.5rem;display:flex;align-items:center;gap:0.5rem;flex-wrap:wrap;"
            >
              @if (property()!.isOccupied) {
                <span class="badge badge-occupied">Occupied</span>
              } @else {
                <span class="badge badge-vacant">Vacant</span>
              }
              @if (canManage()) {
                <button
                  class="btn-primary"
                  style="padding:0.3rem 0.75rem;font-size:0.875rem"
                  (click)="editProperty()"
                >
                  <ng-icon name="heroPencilSquare" size="15" />
                  Edit Property
                </button>
              }
            </div>
          </div>
        </div>
      </div>

      <!-- Tab bar -->
      <div class="tab-bar">
        @for (tab of visibleTabs(); track tab.id) {
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
            <div class="overview-row">
              <!-- Active lease -->
              @if (leasesLoading() || tenantsLoading()) {
                <div class="lease-card" style="flex:1 1 280px;margin-bottom:0">
                  <p class="loading" style="margin:0">Loading…</p>
                </div>
              } @else if (activeLease()) {
                <div class="lease-card" style="flex:1 1 280px;margin-bottom:0">
                  <h3>Lease — {{ activeLease()!.status | titlecase }}</h3>
                  <div class="lease-meta">
                    <span>Start: {{ activeLease()!.start_date | date: 'mediumDate' }}</span>
                    @if (activeLease()!.end_date) {
                      <span>End: {{ activeLease()!.end_date | date: 'mediumDate' }}</span>
                    }
                    <span>Rent: {{ activeLease()!.monthly_rent | currency }}</span>
                    <span>Deposit: {{ activeLease()!.security_deposit | currency }}</span>
                  </div>

                  <div style="margin-top:0.75rem">
                    <p
                      style="font-size:0.75rem;font-weight:600;color:#718096;text-transform:uppercase;letter-spacing:0.04em;margin:0 0 0.375rem"
                    >
                      Tenants
                    </p>
                    @if (activeLeaseTenants().length === 0) {
                      <p style="font-size:0.875rem;color:#a0aec0;margin:0">None</p>
                    } @else {
                      <div style="display:flex;flex-direction:column;gap:0.125rem">
                        @for (t of activeLeaseTenants(); track t.id) {
                          <span style="font-size:0.9375rem;color:#2d3748"
                            >{{ t.first_name }} {{ t.last_name }}</span
                          >
                        }
                      </div>
                    }
                  </div>

                  <div
                    style="display:flex;align-items:center;justify-content:space-between;gap:1rem;flex-wrap:wrap;margin-top:0.75rem"
                  >
                    @if (leaseDocumentLinks()[activeLease()!.id]) {
                      <a
                        class="doc-link"
                        [href]="leaseDocumentLinks()[activeLease()!.id]"
                        target="_blank"
                        rel="noopener"
                      >
                        <ng-icon name="heroDocument" size="14" />
                        View lease document
                      </a>
                    } @else {
                      <span></span>
                    }

                    @if (canManage()) {
                      <div style="display:flex;gap:0.5rem;flex-wrap:wrap">
                        <button
                          class="btn-primary"
                          style="padding:0.375rem 0.75rem;font-size:0.8125rem"
                          (click)="editLease(activeLease()!)"
                        >
                          <ng-icon name="heroPencilSquare" size="14" />
                          Edit Lease
                        </button>
                        <button
                          class="btn-ghost"
                          style="padding:0.375rem 0.75rem;font-size:0.8125rem"
                          (click)="editTenants(activeLease()!)"
                        >
                          <ng-icon name="heroUsers" size="14" />
                          Edit Tenants
                        </button>
                      </div>
                    }
                  </div>
                </div>
              } @else {
                <div class="lease-card" style="flex:1 1 280px;margin-bottom:0">
                  <p style="margin:0;color:#a0aec0;font-size:0.9375rem">No active lease</p>
                  @if (canManage()) {
                    <button
                      class="btn-primary"
                      style="margin-top:0.5rem"
                      (click)="startNewTenancy()"
                    >
                      <ng-icon name="heroPlus" size="16" />
                      Start New Tenancy
                    </button>
                  }
                </div>
              }

              <!-- Card 2: Property profile -->
              <section class="overview-summary">
                <div>
                  <p class="hero-stat-label">Latest market value</p>
                  <p class="hero-stat-value">
                    @if (property()!.latestMarketValue) {
                      {{
                        property()!.latestMarketValue!.market_value
                          | currency: 'USD' : 'symbol' : '1.0-0'
                      }}
                    } @else {
                      No estimate yet
                    }
                  </p>
                  @if (property()!.latestMarketValue) {
                    <p class="hero-stat-meta">
                      {{ property()!.latestMarketValue!.source | titlecase }} on
                      {{ property()!.latestMarketValue!.value_date | date: 'mediumDate' }}
                    </p>
                  }
                </div>

                <div>
                  <p class="hero-stat-label">Property profile</p>
                  <p class="hero-stat-value">
                    {{ property()!.bedrooms ?? '—' }} bd · {{ property()!.bathrooms ?? '—' }} ba ·
                    @if (property()!.square_footage) {
                      {{ property()!.square_footage | number }} sq ft
                    } @else {
                      — sq ft
                    }
                  </p>
                </div>

                @if (property()!.year_built) {
                  <div>
                    <p class="hero-stat-label">Year built</p>
                    <p class="hero-stat-value">{{ property()!.year_built }}</p>
                  </div>
                }
              </section>
            </div>
          }

          @case ('leases') {
            @if (canManage()) {
              <div class="action-bar">
                <button class="btn-primary" (click)="addLease()">
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

                  <!-- Tenants for this lease -->
                  <div style="margin-top:0.75rem">
                    <p
                      style="font-size:0.75rem;font-weight:600;color:#718096;text-transform:uppercase;letter-spacing:0.04em;margin:0 0 0.375rem"
                    >
                      Tenants
                    </p>
                    @if (tenantsLoading()) {
                      <p style="font-size:0.875rem;color:#a0aec0;margin:0">Loading…</p>
                    } @else if ((leaseTenants()[lease.id]?.length ?? 0) === 0) {
                      <p style="font-size:0.875rem;color:#a0aec0;margin:0">None</p>
                    } @else {
                      <div style="display:flex;flex-direction:column;gap:0.125rem">
                        @for (t of leaseTenants()[lease.id]; track t.id) {
                          <span style="font-size:0.9375rem;color:#2d3748"
                            >{{ t.first_name }} {{ t.last_name }}</span
                          >
                        }
                      </div>
                    }
                  </div>

                  <div
                    style="display:flex;align-items:center;justify-content:space-between;gap:1rem;flex-wrap:wrap;margin-top:0.75rem"
                  >
                    @if (leaseDocumentLinks()[lease.id]) {
                      <a
                        class="doc-link"
                        [href]="leaseDocumentLinks()[lease.id]"
                        target="_blank"
                        rel="noopener"
                      >
                        <ng-icon name="heroDocument" size="14" />
                        View lease document
                      </a>
                    } @else {
                      <span></span>
                    }

                    @if (canManage()) {
                      <div style="display:flex;gap:0.5rem;flex-wrap:wrap">
                        <button
                          class="btn-primary"
                          style="padding:0.375rem 0.75rem;font-size:0.8125rem"
                          (click)="editLease(lease)"
                        >
                          <ng-icon name="heroPencilSquare" size="14" />
                          Edit Lease
                        </button>
                        <button
                          class="btn-ghost"
                          style="padding:0.375rem 0.75rem;font-size:0.8125rem"
                          (click)="editTenants(lease)"
                        >
                          <ng-icon name="heroUsers" size="14" />
                          Edit Tenants
                        </button>
                      </div>
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

          @case ('expenses') {
            @if (expensesLoading()) {
              <p class="loading">Loading expenses…</p>
            } @else {
              <div style="margin-bottom:1rem">
                <p style="margin:0 0 0.25rem;font-size:0.8125rem;color:#a0aec0">
                  YTD total ({{ currentYear }})
                </p>
                <p style="margin:0;font-size:1.5rem;font-weight:700;color:#2d3748">
                  {{ ytdTotal() | currency }}
                </p>
              </div>

              @if (topCategories().length > 0) {
                <div style="margin-bottom:1rem">
                  <p style="margin:0 0 0.5rem;font-size:0.8125rem;color:#a0aec0">Top categories</p>
                  @for (cat of topCategories(); track cat.name) {
                    <div
                      style="display:flex;justify-content:space-between;padding:0.375rem 0;border-bottom:1px solid #f7fafc;font-size:0.9375rem"
                    >
                      <span style="color:#4a5568">{{ cat.name }}</span>
                      <span style="font-weight:600;color:#2d3748">{{ cat.total | currency }}</span>
                    </div>
                  }
                </div>
              } @else {
                <p class="empty">No expenses recorded for this property this year.</p>
              }

              <a
                [routerLink]="['/expenses']"
                [queryParams]="{ property: property()!.id }"
                style="display:inline-flex;align-items:center;gap:0.375rem;font-size:0.875rem;color:#2b6cb0;text-decoration:none"
              >
                <ng-icon name="heroCreditCard" size="14" />
                View all expenses
              </a>
            }
          }

          @case ('market-values') {
            @if (canManage()) {
              <div class="action-bar">
                <button class="btn-primary" (click)="addMarketValue()">
                  <ng-icon name="heroPlus" size="16" />
                  Add value
                </button>
              </div>
            }
            @if (marketValuesLoading()) {
              <p class="loading">Loading market values…</p>
            } @else if (marketValues().length === 0) {
              <p class="empty">No market values on record.</p>
            } @else {
              @for (mv of marketValues(); track mv.id) {
                <div
                  class="lease-card"
                  style="display:flex;align-items:center;justify-content:space-between;gap:1rem;"
                >
                  <div>
                    <p style="margin:0;font-size:1rem;font-weight:600;color:#2d3748">
                      {{ mv.market_value | currency: 'USD' : 'symbol' : '1.0-0' }}
                    </p>
                    <p style="margin:0;font-size:0.875rem;color:#718096">
                      {{ mv.source | titlecase }} · {{ mv.value_date | date: 'mediumDate' }}
                    </p>
                    @if (mv.notes) {
                      <p style="margin:0.25rem 0 0;font-size:0.8125rem;color:#a0aec0">
                        {{ mv.notes }}
                      </p>
                    }
                  </div>
                  @if (canManage()) {
                    <button
                      class="btn-primary"
                      style="padding:0.375rem 0.75rem;font-size:0.8125rem;flex-shrink:0"
                      (click)="editMarketValue(mv)"
                    >
                      <ng-icon name="heroPencilSquare" size="14" />
                      Edit
                    </button>
                  }
                </div>
              }
            }
          }

          @case ('documents') {
            @if (canManage()) {
              <div class="action-bar">
                <button class="btn-primary" (click)="showDocumentWizard.set(true)">
                  <ng-icon name="heroPlus" size="16" />
                  Add Document
                </button>
              </div>
            }
            @if (propertyDocsLoading()) {
              <p class="loading">Loading documents…</p>
            } @else if (propertyDocs().length === 0) {
              <p class="empty">No documents uploaded for this property.</p>
            } @else {
              @for (doc of propertyDocs(); track doc.id) {
                <div
                  class="lease-card"
                  style="display:flex;align-items:center;justify-content:space-between;gap:1rem;"
                >
                  <div>
                    <p style="margin:0;font-size:1rem;font-weight:600;color:#2d3748">
                      {{ doc.title }}
                    </p>
                    @if (doc.description) {
                      <p style="margin:0;font-size:0.875rem;color:#718096">{{ doc.description }}</p>
                    }
                    <p style="margin:0.125rem 0 0;font-size:0.8125rem;color:#a0aec0">
                      {{ doc.created_at | date: 'mediumDate' }}
                    </p>
                  </div>
                  @if (canManage()) {
                    <div style="display:flex;gap:0.5rem;flex-shrink:0">
                      <button
                        class="btn-primary"
                        style="padding:0.375rem 0.75rem;font-size:0.8125rem"
                        (click)="editingPropertyDoc.set(doc)"
                      >
                        <ng-icon name="heroPencilSquare" size="14" />
                        Edit
                      </button>
                      <button
                        class="btn-primary"
                        style="padding:0.375rem 0.75rem;font-size:0.8125rem;background:#fc8181;border-color:#fc8181"
                        (click)="onDeletePropertyDoc(doc)"
                      >
                        <ng-icon name="heroTrash" size="14" />
                        Delete
                      </button>
                    </div>
                  }
                </div>
              }
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
      <div class="modal-backdrop" (click)="closeLeaseForm()">
        <div class="modal" (click)="$event.stopPropagation()">
          <h2>{{ editingLease() ? 'Edit lease' : 'Add lease' }}</h2>
          <app-lease-form
            [lease]="editingLease()"
            [propertyId]="property()!.id"
            (saved)="onLeaseSaved($event)"
            (cancelled)="closeLeaseForm()"
          />
        </div>
      </div>
    }

    <!-- Manage lease tenants modal -->
    @if (showLeaseTenantForm() && editingLeaseTenants()) {
      <div class="modal-backdrop" (click)="closeLeaseTenantForm()">
        <div class="modal" (click)="$event.stopPropagation()">
          <h2>Manage tenants — {{ editingLeaseTenants()!.status | titlecase }} lease</h2>
          <app-lease-tenant-form
            [lease]="editingLeaseTenants()!"
            (done)="closeLeaseTenantForm()"
            (changed)="onLeaseTenantChanged(editingLeaseTenants()!, $event)"
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

    <!-- Market value form modal -->
    @if (showMarketValueForm()) {
      <div class="modal-backdrop" (click)="showMarketValueForm.set(false)">
        <div class="modal" (click)="$event.stopPropagation()">
          <h2>{{ editingMarketValue() ? 'Edit market value' : 'Add market value' }}</h2>
          <app-market-value-form
            [propertyId]="property()!.id"
            [marketValue]="editingMarketValue()"
            (saved)="onMarketValueSaved($event)"
            (cancelled)="showMarketValueForm.set(false)"
          />
        </div>
      </div>
    }

    <!-- Document upload wizard modal -->
    @if (showDocumentWizard()) {
      <div class="modal-backdrop" (click)="showDocumentWizard.set(false)">
        <div class="modal" (click)="$event.stopPropagation()">
          <app-document-upload-wizard
            (saved)="onPropertyDocSaved()"
            (cancelled)="showDocumentWizard.set(false)"
          />
        </div>
      </div>
    }

    <!-- Document edit modal -->
    @if (editingPropertyDoc()) {
      <div class="modal-backdrop" (click)="editingPropertyDoc.set(null)">
        <div class="modal" (click)="$event.stopPropagation()">
          <app-document-edit-modal
            [document]="editingPropertyDoc()!"
            (saved)="onPropertyDocEditSaved()"
            (cancelled)="editingPropertyDoc.set(null)"
          />
        </div>
      </div>
    }

    @if (showImagePreview() && coverPhotoUrl()) {
      <div class="modal-backdrop" (click)="closeImagePreview()">
        <div class="image-preview-modal" (click)="$event.stopPropagation()">
          <div class="image-preview-header">
            <p class="image-preview-title">{{ property()!.address_line1 }}</p>
            <button
              type="button"
              class="image-preview-close"
              (click)="closeImagePreview()"
              aria-label="Close image preview"
            >
              <ng-icon name="heroXMark" size="18" />
            </button>
          </div>

          <div class="image-preview-body">
            <img
              class="image-preview-photo"
              [src]="coverPhotoUrl()!"
              [alt]="property()!.address_line1"
            />
          </div>
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
  private readonly expenseService = inject(ExpenseService);
  private readonly marketValueService = inject(PropertyMarketValueService);
  private readonly storage = inject(StorageService);
  private readonly roles = inject(RoleService);
  private readonly title = inject(Title);

  readonly tabs = TABS;
  readonly loading = signal(true);
  readonly property = signal<PropertyWithOccupancy | null>(null);

  readonly activeTab = signal<TabId>('overview');

  readonly leases = signal<Lease[]>([]);
  readonly leasesLoading = signal(false);
  readonly leaseDocumentLinks = signal<Record<string, string>>({});

  readonly leaseTenants = signal<Record<string, Tenant[]>>({});
  readonly tenantsLoading = signal(false);

  readonly activeLeaseTenants = computed(() =>
    this.activeLease() ? (this.leaseTenants()[this.activeLease()!.id] ?? []) : [],
  );

  readonly propertyExpenses = signal<ExpenseWithCategory[]>([]);
  readonly expensesLoading = signal(false);
  readonly currentYear = new Date().getFullYear();
  readonly coverPhotoUrl = signal<string | null>(null);

  readonly ytdTotal = computed(() =>
    this.propertyExpenses()
      .filter((e) => e.status !== 'rejected')
      .reduce((sum, e) => sum + e.amount, 0),
  );

  readonly topCategories = computed(() => {
    const totals = new Map<string, number>();
    for (const e of this.propertyExpenses().filter((e) => e.status !== 'rejected')) {
      const name = e.irs_expense_categories?.name ?? 'Other';
      totals.set(name, (totals.get(name) ?? 0) + e.amount);
    }
    return [...totals.entries()]
      .map(([name, total]) => ({ name, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 3);
  });

  readonly activeLease = computed(() => this.leases().find((l) => l.status === 'active') ?? null);

  readonly showPropertyForm = signal(false);
  readonly showLeaseForm = signal(false);
  readonly showLeaseTenantForm = signal(false);
  readonly editingLeaseTenants = signal<Lease | null>(null);
  readonly showWizard = signal(false);
  readonly showMarketValueForm = signal(false);
  readonly showImagePreview = signal(false);
  readonly editingLease = signal<Lease | null>(null);
  readonly editingMarketValue = signal<PropertyMarketValue | null>(null);

  readonly marketValues = signal<PropertyMarketValue[]>([]);
  readonly marketValuesLoading = signal(false);

  readonly propertyDocs = signal<DocumentWithProperty[]>([]);
  readonly propertyDocsLoading = signal(false);
  readonly showDocumentWizard = signal(false);
  readonly editingPropertyDoc = signal<DocumentWithProperty | null>(null);

  private readonly documentService = inject(DocumentService);

  canManage(): boolean {
    return this.roles.isManagerOrAbove();
  }
  canViewPII(): boolean {
    return this.roles.isManagerOrAbove();
  }

  visibleTabs() {
    return TABS.filter((t) => !t.managerOnly || this.canManage());
  }

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id')!;
    this.loadProperty(id);
    this.loadLeases(id);
    this.loadMarketValues(id);
    this.loadPropertyDocs(id);
    if (this.canManage()) {
      this.loadExpenses(id);
    }
  }

  private loadPropertyDocs(propertyId: string): void {
    this.propertyDocsLoading.set(true);
    this.documentService.getByProperty(propertyId).subscribe({
      next: (docs) => {
        this.propertyDocs.set(docs);
        this.propertyDocsLoading.set(false);
      },
      error: () => this.propertyDocsLoading.set(false),
    });
  }

  onPropertyDocSaved(): void {
    this.showDocumentWizard.set(false);
    const id = this.route.snapshot.paramMap.get('id')!;
    this.loadPropertyDocs(id);
  }

  onPropertyDocEditSaved(): void {
    this.editingPropertyDoc.set(null);
    const id = this.route.snapshot.paramMap.get('id')!;
    this.loadPropertyDocs(id);
  }

  onDeletePropertyDoc(doc: DocumentWithProperty): void {
    if (!confirm(`Delete "${doc.title}"? This action cannot be undone.`)) return;
    this.documentService.delete(doc.id, doc.created_at, doc.storage_path).subscribe({
      next: () => {
        const id = this.route.snapshot.paramMap.get('id')!;
        this.loadPropertyDocs(id);
      },
      error: (err: Error) => alert(err.message ?? 'Failed to delete document.'),
    });
  }

  private loadProperty(id: string): void {
    this.loading.set(true);
    this.propertyService.getProperty(id).subscribe({
      next: (p) => {
        this.property.set(p);
        this.title.setTitle(`${p.address_line1} – DHH`);
        this.loadCoverPhoto(p.cover_photo_url);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  private loadCoverPhoto(path: string | null): void {
    if (!path) {
      this.coverPhotoUrl.set(null);
      return;
    }

    this.storage.getSignedUrl('property-photos', path).subscribe({
      next: (url) => this.coverPhotoUrl.set(url),
      error: () => this.coverPhotoUrl.set(null),
    });
  }

  private loadLeases(propertyId: string): void {
    this.leasesLoading.set(true);
    this.leaseService.getLeasesForProperty(propertyId).subscribe({
      next: (leases) => {
        this.leases.set(leases);
        this.loadLeaseDocumentLinks(leases);
        this.leasesLoading.set(false);
        this.loadAllLeaseTenants(leases);
      },
      error: () => this.leasesLoading.set(false),
    });
  }

  private loadAllLeaseTenants(leases: Lease[]): void {
    if (leases.length === 0) {
      this.leaseTenants.set({});
      return;
    }
    this.tenantsLoading.set(true);
    const observables = Object.fromEntries(
      leases.map((lease) => [lease.id, this.tenantService.getTenantsForLease(lease.id)]),
    );
    forkJoin(observables).subscribe({
      next: (result) => {
        this.leaseTenants.set(result as Record<string, Tenant[]>);
        this.tenantsLoading.set(false);
      },
      error: () => this.tenantsLoading.set(false),
    });
  }

  private loadLeaseDocumentLinks(leases: Lease[]): void {
    const leasesWithDocs = leases.filter((lease) => !!lease.document_url);
    if (leasesWithDocs.length === 0) {
      this.leaseDocumentLinks.set({});
      return;
    }

    forkJoin(
      leasesWithDocs.map((lease) => {
        const documentPath = lease.document_url!;
        if (/^https?:\/\//i.test(documentPath)) {
          return of({ id: lease.id, url: documentPath });
        }

        return this.storage.getSignedUrl('lease-documents', documentPath).pipe();
      }),
    ).subscribe({
      next: (results) => {
        const links: Record<string, string> = {};
        results.forEach((result, index) => {
          if (typeof result === 'string') {
            links[leasesWithDocs[index].id] = result;
          } else {
            links[result.id] = result.url;
          }
        });
        this.leaseDocumentLinks.set(links);
      },
      error: () => this.leaseDocumentLinks.set({}),
    });
  }

  editProperty(): void {
    this.showPropertyForm.set(true);
  }

  addLease(): void {
    this.editingLease.set(null);
    this.showLeaseForm.set(true);
  }

  editLease(lease: Lease): void {
    this.editingLease.set(lease);
    this.showLeaseForm.set(true);
  }

  closeLeaseForm(): void {
    this.showLeaseForm.set(false);
    this.editingLease.set(null);
  }

  editTenants(lease: Lease): void {
    this.editingLeaseTenants.set(lease);
    this.showLeaseTenantForm.set(true);
  }

  closeLeaseTenantForm(): void {
    this.showLeaseTenantForm.set(false);
    this.editingLeaseTenants.set(null);
  }

  onLeaseTenantChanged(lease: Lease, tenants: Tenant[]): void {
    this.leaseTenants.update((prev) => ({ ...prev, [lease.id]: tenants }));
  }

  openImagePreview(): void {
    if (this.coverPhotoUrl()) {
      this.showImagePreview.set(true);
    }
  }

  closeImagePreview(): void {
    this.showImagePreview.set(false);
  }

  startNewTenancy(): void {
    this.showWizard.set(true);
  }

  onPropertySaved(p: Property): void {
    this.property.set({
      ...p,
      isOccupied: this.property()?.isOccupied ?? false,
      latestMarketValue: this.property()?.latestMarketValue ?? null,
    });
    this.loadCoverPhoto(p.cover_photo_url);
    this.showPropertyForm.set(false);
  }

  onLeaseSaved(lease: Lease): void {
    this.leases.update((prev) => {
      const idx = prev.findIndex((item) => item.id === lease.id);
      if (idx >= 0) {
        const updated = [...prev];
        updated[idx] = lease;
        return updated;
      }

      return [lease, ...prev];
    });
    this.loadLeaseDocumentLinks(this.leases());
    this.closeLeaseForm();
  }

  onWizardSaved(result: { lease: Lease; tenants: Tenant[] }): void {
    this.leases.update((prev) => [result.lease, ...prev]);
    this.leaseTenants.update((prev) => ({ ...prev, [result.lease.id]: result.tenants }));
    this.property.update((p) => (p ? { ...p, isOccupied: true } : p));
    this.showWizard.set(false);
    this.activeTab.set('leases');
  }

  private loadExpenses(propertyId: string): void {
    this.expensesLoading.set(true);
    this.expenseService.getExpensesForProperty(propertyId, this.currentYear).subscribe({
      next: (expenses) => {
        this.propertyExpenses.set(expenses);
        this.expensesLoading.set(false);
      },
      error: () => this.expensesLoading.set(false),
    });
  }

  private loadMarketValues(propertyId: string): void {
    this.marketValuesLoading.set(true);
    this.marketValueService.getForProperty(propertyId).subscribe({
      next: (values) => {
        this.marketValues.set(values);
        this.marketValuesLoading.set(false);
      },
      error: () => this.marketValuesLoading.set(false),
    });
  }

  addMarketValue(): void {
    this.editingMarketValue.set(null);
    this.showMarketValueForm.set(true);
  }

  editMarketValue(mv: PropertyMarketValue): void {
    this.editingMarketValue.set(mv);
    this.showMarketValueForm.set(true);
  }

  onMarketValueSaved(mv: PropertyMarketValue): void {
    const existing = this.marketValues();
    const idx = existing.findIndex((v) => v.id === mv.id);
    if (idx >= 0) {
      const updated = [...existing];
      updated[idx] = mv;
      this.marketValues.set(updated.sort((a, b) => b.value_date.localeCompare(a.value_date)));
    } else {
      this.marketValues.update((prev) =>
        [mv, ...prev].sort((a, b) => b.value_date.localeCompare(a.value_date)),
      );
    }
    // Update the latestMarketValue on the property signal
    const sorted = this.marketValues();
    if (sorted.length > 0) {
      this.property.update((p) => (p ? { ...p, latestMarketValue: sorted[0] } : p));
    }
    this.showMarketValueForm.set(false);
  }
}
