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
import { InspectionStorageService } from '../../../core/services/inspection-storage.service';
import { RoleService } from '../../../core/role/role.service';
import { Lease } from '../../../core/services/lease.service';
import { INSPECTION_TYPE_LABELS, InspectionType, InspectionWithRollup } from '../inspection.types';

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
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
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

    .btn-card-actions {
      display: flex;
      gap: 0.375rem;
      margin-top: 0.25rem;
    }

    .btn-icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 0.375rem;
      min-width: 2rem;
      height: 2rem;
      padding: 0 0.625rem;
      font-size: 0.8125rem;
      border: 1px solid #e2e8f0;
      border-radius: 0.375rem;
      background: #fff;
      cursor: pointer;
      color: #4a5568;
      &:hover {
        background: #f7fafc;
      }
    }

    .btn-icon-primary {
      color: #2b6cb0;
      border-color: #bee3f8;
      &:hover {
        background: #ebf8ff;
      }
    }

    .btn-icon-danger {
      color: #e53e3e;
      border-color: #fed7d7;
      &:hover {
        background: #fff5f5;
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
      background: #edf2f7;
      color: #4a5568;
      border: none;
      border-radius: 0.375rem;
      font-size: 0.9375rem;
      font-weight: 500;
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
        <button class="btn-primary" (click)="openStartModal()">
          <ng-icon name="heroPlus" size="16" />
          Start Inspection
        </button>
      </div>
    }

    @if (loading()) {
      <p class="empty-state">Loading inspections…</p>
    } @else if (inspections().length === 0) {
      <p class="empty-state">No inspections recorded for this property.</p>
    } @else {
      <div class="inspection-list">
        @for (insp of inspections(); track insp.id) {
          <div class="inspection-card">
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
                </div>
                <div class="card-meta">
                  <span>{{ typeLabel(insp.inspection_type) }}</span>
                  <span>{{ insp.created_at | date: 'mediumDate' }}</span>
                </div>
                <div class="card-stats">
                  <span>{{ insp.photoCount }} photo{{ insp.photoCount === 1 ? '' : 's' }}</span>
                </div>
                <div class="btn-card-actions">
                  @if (canManage()) {
                    <button
                      class="btn-icon btn-icon-primary"
                      title="Edit"
                      (click)="editInspection(insp)"
                    >
                      <ng-icon name="heroPencilSquare" size="15" />
                      Edit
                    </button>
                    <button
                      class="btn-icon btn-icon-danger"
                      title="Delete"
                      [disabled]="deleting() === insp.id"
                      (click)="deleteInspection(insp)"
                    >
                      <ng-icon name="heroTrash" size="15" />
                      Delete
                    </button>
                  }
                  <button class="btn-icon" title="View" (click)="viewInspection(insp)">
                    <ng-icon name="heroEye" size="15" />
                    View
                  </button>
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
  private readonly storageService = inject(InspectionStorageService);
  private readonly roles = inject(RoleService);
  private readonly router = inject(Router);

  readonly loading = signal(true);
  readonly inspections = signal<InspectionWithRollup[]>([]);
  readonly deleting = signal<string | null>(null);
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

  readonly activeLeases = computed(() => this.leases().filter((l) => l.status === 'active'));

  canManage(): boolean {
    return this.roles.isManagerOrAbove();
  }

  typeLabel(type: string): string {
    return INSPECTION_TYPE_LABELS[type as InspectionType] ?? type;
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
          this.startError.set(err?.message || 'Failed to start inspection.');
        },
      });
  }

  editInspection(insp: InspectionWithRollup): void {
    this.router.navigate(['/properties', this.propertyId(), 'inspections', insp.id], {
      queryParams: { mode: 'edit' },
    });
  }

  viewInspection(insp: InspectionWithRollup): void {
    this.router.navigate(['/properties', this.propertyId(), 'inspections', insp.id]);
  }

  deleteInspection(insp: InspectionWithRollup): void {
    if (
      !confirm(
        `Delete "${insp.title}"? This will permanently remove the inspection and all its photos. This cannot be undone.`,
      )
    )
      return;
    this.deleting.set(insp.id);
    this.inspectionService
      .hardDeleteInspection(insp.id, (paths) => this.storageService.deletePhotos(paths))
      .subscribe({
        next: () => {
          this.deleting.set(null);
          this.inspections.update((prev) => prev.filter((i) => i.id !== insp.id));
        },
        error: () => this.deleting.set(null),
      });
  }
}
