import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  OnInit,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import { DatePipe, TitleCasePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgIconComponent } from '@ng-icons/core';
import { InspectionService } from '../../../core/services/inspection.service';
import { RoleService } from '../../../core/role/role.service';
import { Lease } from '../../../core/services/lease.service';
import {
  INSPECTION_TYPE_LABELS,
  InspectionType,
  InspectionWithRollup,
  isWithin24h,
} from '../inspection.types';

@Component({
  selector: 'app-inspections-tab',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, TitleCasePipe, FormsModule, NgIconComponent],
  styles: `
    :host {
      display: block;
    }

    .action-bar {
      display: flex;
      justify-content: flex-end;
      padding: 1rem 1.5rem 0.5rem;
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
      font-weight: 600;
      cursor: pointer;
      &:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }
    }

    .inspection-list {
      padding: 0 1.5rem 1.5rem;
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }

    .inspection-card {
      background: #fff;
      border: 1px solid #e2e8f0;
      border-radius: 0.75rem;
      padding: 1rem 1.25rem;
      cursor: pointer;
      transition: box-shadow 0.15s;
      display: flex;
      flex-direction: column;
      gap: 0.5rem;

      &:hover {
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
      }
    }

    .inspection-card-layout {
      display: flex;
      gap: 1rem;
      align-items: flex-start;
    }

    .inspection-cover {
      width: 5.5rem;
      height: 5.5rem;
      object-fit: cover;
      border-radius: 0.625rem;
      border: 1px solid #e2e8f0;
      background: #edf2f7;
      flex-shrink: 0;
    }

    .inspection-card-body {
      min-width: 0;
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .card-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.5rem;
    }

    .card-title {
      font-size: 1rem;
      font-weight: 600;
      color: #2d3748;
      margin: 0;
    }

    .badge {
      display: inline-flex;
      align-items: center;
      font-size: 0.75rem;
      font-weight: 600;
      padding: 0.125rem 0.5rem;
      border-radius: 9999px;

      &.in-progress {
        background: #ebf8ff;
        color: #2b6cb0;
      }
      &.completed {
        background: #f0fff4;
        color: #276749;
      }
    }

    .card-meta {
      font-size: 0.875rem;
      color: #718096;
      display: flex;
      flex-wrap: wrap;
      gap: 0.375rem 1rem;
    }

    .card-stats {
      font-size: 0.8125rem;
      color: #a0aec0;
      display: flex;
      gap: 1rem;

      .stat-warn {
        color: #c53030;
        font-weight: 600;
      }
    }

    .empty-state {
      padding: 3rem 1.5rem;
      text-align: center;
      color: #a0aec0;
      font-size: 0.9375rem;
    }

    /* Modal */
    .modal-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.4);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 300;
      padding: 1rem;
    }

    .modal {
      background: #fff;
      border-radius: 0.875rem;
      padding: 1.75rem;
      width: 100%;
      max-width: 28rem;
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    .modal h2 {
      margin: 0;
      font-size: 1.25rem;
      font-weight: 700;
      color: #2d3748;
    }

    .form-group {
      display: flex;
      flex-direction: column;
      gap: 0.375rem;
    }

    label {
      font-size: 0.875rem;
      font-weight: 600;
      color: #4a5568;
    }

    select,
    input[type='text'] {
      padding: 0.5rem 0.75rem;
      border: 1px solid #cbd5e0;
      border-radius: 0.375rem;
      font-size: 0.9375rem;
      color: #2d3748;
      background: #fff;
      outline: none;
      &:focus {
        border-color: #4299e1;
        box-shadow: 0 0 0 3px rgba(66, 153, 225, 0.2);
      }
    }

    .type-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 0.625rem;
    }

    .type-option {
      border: 1px solid #e2e8f0;
      border-radius: 0.5rem;
      padding: 0.75rem 0.5rem;
      background: #fff;
      cursor: pointer;
      text-align: center;
      transition:
        border-color 0.15s,
        box-shadow 0.15s,
        background 0.15s;

      &.active {
        border-color: #2b6cb0;
        background: #ebf8ff;
        box-shadow: 0 0 0 1px rgba(43, 108, 176, 0.15);
      }
    }

    .type-option-label {
      display: block;
      font-size: 0.875rem;
      font-weight: 600;
      color: #2d3748;
    }

    .modal-actions {
      display: flex;
      gap: 0.625rem;
      justify-content: flex-end;
    }

    .btn-ghost {
      display: flex;
      align-items: center;
      gap: 0.375rem;
      padding: 0.5rem 1rem;
      background: transparent;
      color: #4a5568;
      border: 1px solid #cbd5e0;
      border-radius: 0.375rem;
      font-size: 0.9375rem;
      font-weight: 600;
      cursor: pointer;
    }

    .error-msg {
      color: #c53030;
      font-size: 0.875rem;
    }
  `,
  template: `
    @if (canManage()) {
      <div class="action-bar">
        @if (!activeInspection()) {
          <button class="btn-primary" (click)="openStartModal()">
            <ng-icon name="heroPlus" size="16" />
            Start Inspection
          </button>
        }
      </div>
    }

    @if (loading()) {
      <p class="empty-state">Loading inspections…</p>
    } @else if (inspections().length === 0) {
      <p class="empty-state">No inspections recorded for this property.</p>
    } @else {
      <div class="inspection-list">
        @for (insp of inspections(); track insp.id) {
          <div class="inspection-card" (click)="openInspection(insp)">
            <div class="inspection-card-layout">
              @if (insp.coverPhotoUrl) {
                <img
                  class="inspection-cover"
                  [src]="insp.coverPhotoUrl"
                  [alt]="insp.title + ' cover photo'"
                  loading="lazy"
                />
              }
              <div class="inspection-card-body">
                <div class="card-header">
                  <p class="card-title">{{ insp.title }}</p>
                  <span
                    class="badge"
                    [class.in-progress]="isActive(insp)"
                    [class.completed]="!isActive(insp)"
                  >
                    {{ isActive(insp) ? 'Active' : 'Completed' }}
                  </span>
                </div>
                <div class="card-meta">
                  <span>{{ typeLabel(insp.inspection_type) }}</span>
                  <span>{{ insp.created_at | date: 'mediumDate' }}</span>
                </div>
                <div class="card-stats">
                  <span>{{ insp.photoCount }} photo{{ insp.photoCount === 1 ? '' : 's' }}</span>
                  @if (insp.unresolvedActionableCount > 0) {
                    <span class="stat-warn"
                      >{{ insp.unresolvedActionableCount }} unresolved action item{{
                        insp.unresolvedActionableCount === 1 ? '' : 's'
                      }}</span
                    >
                  }
                </div>
              </div>
            </div>
          </div>
        }
      </div>
    }

    @if (showStartModal()) {
      <div class="modal-backdrop" (click)="closeStartModal()">
        <div class="modal" (click)="$event.stopPropagation()">
          <h2>Start Inspection</h2>

          <div class="form-group">
            <label for="insp-title">Title</label>
            <input
              id="insp-title"
              type="text"
              [(ngModel)]="newTitle"
              placeholder="Auto-generated if blank"
            />
          </div>

          <div class="form-group">
            <label>Type</label>
            <div class="type-grid">
              @for (t of inspectionTypes; track t.value) {
                <button
                  type="button"
                  class="type-option"
                  [class.active]="newType === t.value"
                  (click)="newType = t.value"
                >
                  <span class="type-option-label">{{ t.label }}</span>
                </button>
              }
            </div>
          </div>

          @if (activeLeases().length > 0) {
            <div class="form-group">
              <label for="insp-lease">Link to Lease (optional)</label>
              <select id="insp-lease" [(ngModel)]="newLeaseId">
                <option value="">None</option>
                @for (lease of activeLeases(); track lease.id) {
                  <option [value]="lease.id">
                    {{ lease.status | titlecase }} — started
                    {{ lease.start_date | date: 'mediumDate' }}
                  </option>
                }
              </select>
            </div>
          }

          @if (startError()) {
            <p class="error-msg">{{ startError() }}</p>
          }

          <div class="modal-actions">
            <button class="btn-ghost" (click)="closeStartModal()">Cancel</button>
            <button class="btn-primary" [disabled]="starting()" (click)="startInspection()">
              {{ starting() ? 'Starting…' : 'Start' }}
            </button>
          </div>
        </div>
      </div>
    }
  `,
})
export class InspectionsTabComponent implements OnInit {
  readonly propertyId = input.required<string>();
  readonly bedrooms = input<number | null>(null);
  readonly bathrooms = input<number | null>(null);
  readonly leases = input<Lease[]>([]);

  private readonly inspectionService = inject(InspectionService);
  private readonly roles = inject(RoleService);
  private readonly router = inject(Router);

  readonly loading = signal(true);
  readonly inspections = signal<InspectionWithRollup[]>([]);
  readonly showStartModal = signal(false);
  readonly starting = signal(false);
  readonly startError = signal<string | null>(null);

  newType: InspectionType = 'other';
  newTitle = '';
  newLeaseId = '';

  readonly inspectionTypes: { value: InspectionType; label: string }[] = [
    { value: 'move_in', label: 'Move-In' },
    { value: 'move_out', label: 'Move-Out' },
    { value: 'other', label: 'Other' },
  ];

  readonly activeInspection = computed(
    () => this.inspections().find((i) => isWithin24h(i.created_at)) ?? null,
  );

  readonly activeLeases = computed(() => this.leases().filter((l) => l.status === 'active'));

  canManage(): boolean {
    return this.roles.isManagerOrAbove();
  }

  typeLabel(type: string): string {
    return INSPECTION_TYPE_LABELS[type as InspectionType] ?? type;
  }

  isActive(insp: InspectionWithRollup): boolean {
    return isWithin24h(insp.created_at);
  }

  ngOnInit(): void {
    this.loadInspections();
  }

  private loadInspections(): void {
    this.loading.set(true);
    this.inspectionService.getInspectionsForProperty(this.propertyId()).subscribe({
      next: (list) => {
        this.inspections.set(list);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  private defaultTitle(): string {
    return new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }

  openStartModal(): void {
    this.newType = 'other';
    this.newTitle = this.defaultTitle();
    this.newLeaseId = '';
    this.startError.set(null);
    this.showStartModal.set(true);
  }

  closeStartModal(): void {
    this.showStartModal.set(false);
    this.startError.set(null);
    this.newType = 'other';
    this.newTitle = '';
    this.newLeaseId = '';
  }

  startInspection(): void {
    const title =
      this.newTitle.trim() ||
      `${INSPECTION_TYPE_LABELS[this.newType]} — ${new Date().toLocaleDateString()}`;
    this.starting.set(true);
    this.startError.set(null);
    this.inspectionService
      .createInspection(
        this.propertyId(),
        this.newLeaseId || null,
        title,
        this.newType,
        this.bedrooms(),
        this.bathrooms(),
      )
      .subscribe({
        next: (inspection) => {
          this.starting.set(false);
          this.closeStartModal();
          this.router.navigate(['/properties', this.propertyId(), 'inspections', inspection.id]);
        },
        error: (err) => {
          this.starting.set(false);
          const msg: string = err?.message ?? '';
          if (msg.includes('uq_one_active_inspection')) {
            this.startError.set(
              'There is already an active inspection for this property. Please wait 24 hours or save it before starting a new one.',
            );
          } else {
            this.startError.set(msg || 'Failed to start inspection.');
          }
        },
      });
  }

  openInspection(insp: InspectionWithRollup): void {
    this.router.navigate(['/properties', this.propertyId(), 'inspections', insp.id]);
  }
}
