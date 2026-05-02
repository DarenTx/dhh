import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  OnInit,
  output,
  signal,
} from '@angular/core';
import { NgIconComponent } from '@ng-icons/core';
import { InspectionService } from '../../../core/services/inspection.service';
import { Inspection, InspectionRoom, INSPECTION_TYPE_LABELS } from '../inspection.types';
import { PhotoCaptureComponent } from './photo-capture/photo-capture.component';

@Component({
  selector: 'app-inspection-wizard',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgIconComponent, PhotoCaptureComponent],
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      height: 100dvh;
      overflow: hidden;
    }

    /* Top bar */
    .top-bar {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.875rem 1rem;
      background: #fff;
      border-bottom: 1px solid #e2e8f0;
      flex-shrink: 0;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
    }

    .top-bar-title {
      flex: 1;
      min-width: 0;
    }

    .top-bar-title h1 {
      margin: 0;
      font-size: 1rem;
      font-weight: 700;
      color: #2d3748;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .top-bar-title p {
      margin: 0;
      font-size: 0.8125rem;
      color: #718096;
    }

    .icon-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 2.25rem;
      height: 2.25rem;
      border: none;
      background: transparent;
      border-radius: 0.5rem;
      cursor: pointer;
      color: #4a5568;
      flex-shrink: 0;
      &:hover {
        background: #f7fafc;
      }
    }

    .end-btn {
      display: flex;
      align-items: center;
      gap: 0.25rem;
      padding: 0.375rem 0.875rem;
      background: #276749;
      color: #fff;
      border: none;
      border-radius: 0.375rem;
      font-size: 0.875rem;
      font-weight: 600;
      cursor: pointer;
      flex-shrink: 0;
      &:hover {
        opacity: 0.9;
      }
    }

    /* Room chip nav */
    .room-nav {
      display: flex;
      gap: 0.5rem;
      padding: 0.75rem 1rem;
      overflow-x: auto;
      background: #f7fafc;
      border-bottom: 1px solid #e2e8f0;
      flex-shrink: 0;
      scrollbar-width: none;
      -webkit-overflow-scrolling: touch;
      &::-webkit-scrollbar {
        display: none;
      }
    }

    .room-chip {
      display: flex;
      align-items: center;
      gap: 0.25rem;
      padding: 0.375rem 0.75rem;
      border: 1px solid #cbd5e0;
      border-radius: 9999px;
      background: #fff;
      font-size: 0.8125rem;
      font-weight: 500;
      white-space: nowrap;
      cursor: pointer;
      color: #4a5568;
      flex-shrink: 0;
      transition: all 0.12s;

      &.active {
        background: #2b6cb0;
        border-color: #2b6cb0;
        color: #fff;
      }
    }

    .chip-badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 1.125rem;
      height: 1.125rem;
      background: rgba(0, 0, 0, 0.15);
      border-radius: 50%;
      font-size: 0.6875rem;
      font-weight: 700;
    }

    .active .chip-badge {
      background: rgba(255, 255, 255, 0.25);
    }

    /* Scrollable content */
    .content {
      flex: 1;
      overflow-y: auto;
      -webkit-overflow-scrolling: touch;
    }

    .room-header {
      padding: 1rem 1rem 0;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .room-header h2 {
      margin: 0;
      font-size: 1.125rem;
      font-weight: 700;
      color: #2d3748;
    }

    .room-counter {
      font-size: 0.8125rem;
      color: #a0aec0;
    }

    /* Footer nav */
    .footer-nav {
      display: flex;
      justify-content: space-between;
      padding: 0.75rem 1rem;
      background: #fff;
      border-top: 1px solid #e2e8f0;
      flex-shrink: 0;
    }

    .nav-btn {
      display: flex;
      align-items: center;
      gap: 0.375rem;
      padding: 0.5rem 1.25rem;
      border: 1px solid #cbd5e0;
      border-radius: 0.5rem;
      background: #fff;
      font-size: 0.9375rem;
      font-weight: 600;
      color: #4a5568;
      cursor: pointer;
      &:disabled {
        opacity: 0.4;
        cursor: not-allowed;
      }
    }

    .nav-btn.next {
      background: #2b6cb0;
      color: #fff;
      border-color: #2b6cb0;
    }

    /* End confirmation modal */
    .modal-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.45);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 400;
      padding: 1rem;
    }

    .modal {
      background: #fff;
      border-radius: 0.875rem;
      padding: 1.75rem;
      width: 100%;
      max-width: 26rem;
    }

    .modal h2 {
      margin: 0 0 0.75rem;
      font-size: 1.125rem;
      font-weight: 700;
      color: #2d3748;
    }
    .modal p {
      margin: 0 0 1.25rem;
      font-size: 0.9375rem;
      color: #4a5568;
    }

    .modal-actions {
      display: flex;
      gap: 0.625rem;
      justify-content: flex-end;
    }

    .btn-ghost {
      padding: 0.5rem 1rem;
      background: transparent;
      color: #4a5568;
      border: 1px solid #cbd5e0;
      border-radius: 0.375rem;
      font-size: 0.9375rem;
      font-weight: 600;
      cursor: pointer;
    }

    .btn-confirm {
      padding: 0.5rem 1.25rem;
      background: #276749;
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
  `,
  template: `
    <div class="top-bar">
      <button class="icon-btn" (click)="back.emit()" aria-label="Back">
        <ng-icon name="heroChevronLeft" size="22" />
      </button>
      <div class="top-bar-title">
        <h1>{{ inspection().title }}</h1>
        <p>{{ typeLabel() }} · In Progress</p>
      </div>
      <button class="end-btn" (click)="confirmEndModal.set(true)">
        <ng-icon name="heroCheckCircle" size="16" />
        End
      </button>
    </div>

    <div class="room-nav">
      @for (room of rooms(); track room.id; let i = $index) {
        <button
          class="room-chip"
          [class.active]="activeRoomIndex() === i"
          (click)="activeRoomIndex.set(i)"
        >
          {{ room.display_name }}
          @if (roomPhotoCounts()[room.id]) {
            <span class="chip-badge">{{ roomPhotoCounts()[room.id] }}</span>
          }
        </button>
      }
    </div>

    <div class="content">
      @if (activeRoom(); as room) {
        <div class="room-header">
          <h2>{{ room.display_name }}</h2>
          <span class="room-counter">Room {{ activeRoomIndex() + 1 }} of {{ rooms().length }}</span>
        </div>

        <app-photo-capture
          [propertyId]="propertyId()"
          [inspectionId]="inspection().id"
          [roomId]="room.id"
          [roomType]="room.room_type"
          [coverPhotoId]="coverPhotoId()"
          (photoAdded)="onPhotoAdded(room.id)"
          (coverChanged)="coverPhotoId.set($event)"
        />
      }
    </div>

    <div class="footer-nav">
      <button
        class="nav-btn"
        [disabled]="activeRoomIndex() === 0"
        (click)="activeRoomIndex.update((i) => i - 1)"
      >
        <ng-icon name="heroChevronLeft" size="16" />
        Prev
      </button>
      <button
        class="nav-btn next"
        [disabled]="activeRoomIndex() === rooms().length - 1"
        (click)="activeRoomIndex.update((i) => i + 1)"
      >
        Next
        <ng-icon name="heroChevronRight" size="16" />
      </button>
    </div>

    @if (confirmEndModal()) {
      <div class="modal-backdrop" (click)="confirmEndModal.set(false)">
        <div class="modal" (click)="$event.stopPropagation()">
          <h2>End Inspection?</h2>
          <p>
            This will mark the inspection as completed. You can still view it afterwards, and action
            items can always be resolved.
          </p>
          <div class="modal-actions">
            <button class="btn-ghost" (click)="confirmEndModal.set(false)">Cancel</button>
            <button class="btn-confirm" [disabled]="ending()" (click)="endInspection()">
              {{ ending() ? 'Ending…' : 'End Inspection' }}
            </button>
          </div>
        </div>
      </div>
    }
  `,
})
export class InspectionWizardComponent {
  readonly inspection = input.required<Inspection>();
  readonly rooms = input.required<InspectionRoom[]>();
  readonly propertyId = input.required<string>();

  readonly ended = output<void>();
  readonly back = output<void>();

  private readonly inspectionService = inject(InspectionService);

  readonly activeRoomIndex = signal(0);
  readonly coverPhotoId = signal<string | null>(null);
  readonly confirmEndModal = signal(false);
  readonly ending = signal(false);
  readonly roomPhotoCounts = signal<Record<string, number>>({});

  readonly activeRoom = computed(() => this.rooms()[this.activeRoomIndex()] ?? null);
  readonly typeLabel = computed(
    () =>
      INSPECTION_TYPE_LABELS[this.inspection().inspection_type] ??
      this.inspection().inspection_type,
  );

  onPhotoAdded(roomId: string): void {
    this.roomPhotoCounts.update((prev) => ({
      ...prev,
      [roomId]: (prev[roomId] ?? 0) + 1,
    }));
  }

  endInspection(): void {
    this.ending.set(true);
    this.inspectionService.endInspection(this.inspection().id).subscribe({
      next: () => {
        this.ending.set(false);
        this.confirmEndModal.set(false);
        this.ended.emit();
      },
      error: () => {
        this.ending.set(false);
        this.confirmEndModal.set(false);
      },
    });
  }
}
