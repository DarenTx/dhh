import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { NgIconComponent } from '@ng-icons/core';
import { PropertyCardComponent } from './property-card/property-card.component';
import { PropertyFormComponent } from './property-form/property-form.component';
import {
  Property,
  PropertyWithOccupancy,
  PropertyService,
} from '../../core/services/property.service';
import { RoleService } from '../../core/role/role.service';
import { StorageService } from '../../core/services/storage.service';

@Component({
  selector: 'app-properties-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgIconComponent, PropertyCardComponent, PropertyFormComponent],
  styles: `
    .page-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 0.75rem;
      padding: 1.5rem 1.5rem 0;
    }

    h1 {
      margin: 0;
      font-size: 1.5rem;
      font-weight: 700;
      color: #2d3748;
    }

    .header-actions {
      display: flex;
      align-items: center;
      gap: 0.625rem;
    }

    .filter-row {
      display: flex;
      gap: 0.5rem;
      padding: 1rem 1.5rem 0;
    }

    .filter-btn {
      padding: 0.375rem 0.875rem;
      border-radius: 9999px;
      border: 1px solid #e2e8f0;
      background: #fff;
      font-size: 0.875rem;
      font-weight: 500;
      cursor: pointer;
      color: #4a5568;
      transition: all 0.15s;

      &:hover {
        background: #edf2f7;
      }

      &.active {
        background: #2b6cb0;
        color: #fff;
        border-color: #2b6cb0;
      }
    }

    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 1rem;
      padding: 1rem 1.5rem 4rem;
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
      font-size: 0.9375rem;
      font-weight: 500;
      cursor: pointer;
      transition: background 0.15s;

      &:hover {
        background: #2c5282;
      }
    }

    .empty-state {
      grid-column: 1 / -1;
      text-align: center;
      padding: 3rem 1rem;
      color: #a0aec0;
    }

    .loading {
      grid-column: 1 / -1;
      text-align: center;
      padding: 3rem 1rem;
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
      max-width: 600px;
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
      <h1>Properties</h1>
      <div class="header-actions">
        @if (canManage()) {
          <button class="btn-add" (click)="openCreate()">
            <ng-icon name="heroPlus" size="16" />
            Add property
          </button>
        }
      </div>
    </div>

    <div class="filter-row">
      <button class="filter-btn" [class.active]="filter() === 'all'" (click)="filter.set('all')">
        All
      </button>
      <button
        class="filter-btn"
        [class.active]="filter() === 'occupied'"
        (click)="filter.set('occupied')"
      >
        Occupied
      </button>
      <button
        class="filter-btn"
        [class.active]="filter() === 'vacant'"
        (click)="filter.set('vacant')"
      >
        Vacant
      </button>
    </div>

    <div class="grid">
      @if (loading()) {
        <p class="loading">Loading properties…</p>
      } @else if (visible().length === 0) {
        <p class="empty-state">No properties found.</p>
      } @else {
        @for (p of visible(); track p.id) {
          <app-property-card [property]="p" [signedPhotoUrl]="signedUrls()[p.id] || null" />
        }
      }
    </div>

    @if (showForm()) {
      <div class="modal-backdrop" (click)="closeForm()">
        <div class="modal" (click)="$event.stopPropagation()">
          <h2>Add property</h2>
          <app-property-form
            [newId]="pendingId()"
            (saved)="onSaved($event)"
            (cancelled)="closeForm()"
          />
        </div>
      </div>
    }
  `,
})
export class PropertiesPage implements OnInit {
  private readonly propertyService = inject(PropertyService);
  private readonly storageService = inject(StorageService);
  private readonly roles = inject(RoleService);
  private readonly title = inject(Title);
  private readonly route = inject(ActivatedRoute);

  readonly loading = signal(true);
  readonly filter = signal<'all' | 'occupied' | 'vacant'>('all');
  readonly allProperties = signal<PropertyWithOccupancy[]>([]);
  readonly signedUrls = signal<Record<string, string>>({});
  readonly showForm = signal(false);
  readonly pendingId = signal<string | null>(null);

  canManage(): boolean {
    return this.roles.isManagerOrAbove();
  }

  visible(): PropertyWithOccupancy[] {
    const f = this.filter();
    const all = this.allProperties();
    if (f === 'occupied') return all.filter((p) => p.isOccupied);
    if (f === 'vacant') return all.filter((p) => !p.isOccupied);
    return all;
  }

  ngOnInit(): void {
    this.title.setTitle('Properties – DHH');
    const filterParam = this.route.snapshot.queryParamMap.get('filter');
    if (filterParam === 'occupied' || filterParam === 'vacant') {
      this.filter.set(filterParam);
    }
    this.load();
  }

  private load(): void {
    this.loading.set(true);
    this.propertyService.getProperties().subscribe({
      next: (props) => {
        this.allProperties.set(props);
        this.loading.set(false);
        props
          .filter((p) => p.cover_photo_url)
          .forEach((p) => {
            this.storageService
              .getSignedUrl('property-photos', p.cover_photo_url!)
              .subscribe((url) => {
                this.signedUrls.update((prev) => ({ ...prev, [p.id]: url }));
              });
          });
      },
      error: () => this.loading.set(false),
    });
  }

  openCreate(): void {
    this.pendingId.set(crypto.randomUUID());
    this.showForm.set(true);
  }

  closeForm(): void {
    this.showForm.set(false);
    this.pendingId.set(null);
  }

  onSaved(property: Property): void {
    this.allProperties.update((prev) => {
      const idx = prev.findIndex((p) => p.id === property.id);
      const withOccupancy = { ...property, isOccupied: false, latestMarketValue: null };
      if (idx >= 0) {
        const updated = [...prev];
        updated[idx] = { ...prev[idx], ...property };
        return updated;
      }
      return [...prev, withOccupancy].sort((a, b) =>
        a.address_line1.localeCompare(b.address_line1),
      );
    });
    this.closeForm();
  }
}
