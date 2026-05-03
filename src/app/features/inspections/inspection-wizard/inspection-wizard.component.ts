import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { forkJoin } from 'rxjs';
import { NgIconComponent } from '@ng-icons/core';
import { InspectionPhotoService } from '../../../core/services/inspection-photo.service';
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

    .top-bar-cover {
      width: 3rem;
      height: 3rem;
      border-radius: 0.625rem;
      object-fit: cover;
      background: #edf2f7;
      border: 1px solid #e2e8f0;
      flex-shrink: 0;
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

    .close-btn {
      display: flex;
      align-items: center;
      gap: 0.25rem;
      padding: 0.375rem 0.875rem;
      background: #fff;
      color: #4a5568;
      border: 1px solid #cbd5e0;
      border-radius: 0.375rem;
      font-size: 0.875rem;
      font-weight: 600;
      cursor: pointer;
      flex-shrink: 0;
      &:hover {
        background: #f7fafc;
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
  `,
  template: `
    <div class="top-bar">
      <button class="icon-btn" (click)="back.emit()" aria-label="Back">
        <ng-icon name="heroChevronLeft" size="22" />
      </button>
      @if (coverUrl()) {
        <img class="top-bar-cover" [src]="coverUrl()!" alt="Inspection cover photo" />
      }
      <div class="top-bar-title">
        <h1>{{ propertyAddress() || inspection().title }}</h1>
        <p>{{ inspection().title }} · {{ typeLabel() }}</p>
      </div>
      <button class="close-btn" (click)="back.emit()">
        <ng-icon name="heroXMark" size="16" />
        Close
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
          @if ((roomPhotoCounts()[room.id] ?? 0) > 0) {
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
  `,
})
export class InspectionWizardComponent {
  readonly inspection = input.required<Inspection>();
  readonly rooms = input.required<InspectionRoom[]>();
  readonly propertyId = input.required<string>();
  readonly propertyAddress = input<string>('');

  readonly back = output<void>();

  private readonly photoService = inject(InspectionPhotoService);

  readonly activeRoomIndex = signal(0);
  readonly coverPhotoId = signal<string | null>(null);
  readonly coverUrl = signal<string | null>(null);
  readonly roomPhotoCounts = signal<Partial<Record<string, number>>>({});

  private readonly _loadPhotoCountsEffect = effect(() => {
    const rooms = this.rooms();
    const activeCoverId = this.coverPhotoId() ?? this.inspection().cover_photo_id;
    if (rooms.length === 0) {
      this.roomPhotoCounts.set({});
      this.coverUrl.set(null);
      return;
    }
    this.loadRoomPhotoData(rooms, activeCoverId);
  });

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

  private loadRoomPhotoData(rooms: InspectionRoom[], activeCoverId: string | null): void {
    const requests = rooms.map((room) => this.photoService.getPhotosForRoom(room.id));
    forkJoin(requests).subscribe({
      next: (photoGroups) => {
        const counts: Record<string, number> = {};
        for (let i = 0; i < rooms.length; i++) {
          counts[rooms[i].id] = photoGroups[i]?.length ?? 0;
        }
        this.roomPhotoCounts.set(counts);

        if (!activeCoverId) {
          this.coverUrl.set(null);
          return;
        }

        const coverPhoto = photoGroups.flat().find((photo) => photo.id === activeCoverId);
        if (!coverPhoto?.storage_path) {
          this.coverUrl.set(null);
          return;
        }

        this.photoService.getSignedUrl(coverPhoto.storage_path).subscribe({
          next: (url) => this.coverUrl.set(url),
          error: () => this.coverUrl.set(null),
        });
      },
      error: () => {
        const counts: Record<string, number> = {};
        for (const room of rooms) {
          counts[room.id] = this.roomPhotoCounts()[room.id] ?? 0;
        }
        this.roomPhotoCounts.set(counts);
        this.coverUrl.set(null);
      },
    });
  }
}
