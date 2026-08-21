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
import { DatePipe } from '@angular/common';
import { NgIconComponent } from '@ng-icons/core';
import { InspectionService } from '../../../core/services/inspection.service';
import { InspectionPhotoService } from '../../../core/services/inspection-photo.service';
import { InspectionStorageService } from '../../../core/services/inspection-storage.service';
import {
  Inspection,
  InspectionPhoto,
  InspectionRoom,
  INSPECTION_TYPE_LABELS,
  isWithin48h,
} from '../inspection.types';

@Component({
  selector: 'app-inspection-detail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, NgIconComponent],
  styles: `
    :host {
      display: block;
    }

    .top-bar {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.875rem 1rem;
      border-bottom: 1px solid #e2e8f0;
      background: #fff;
    }

    .top-bar h1 {
      flex: 1;
      margin: 0;
      font-size: 1.0625rem;
      font-weight: 700;
      color: #2d3748;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
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

    .edit-btn {
      display: flex;
      align-items: center;
      gap: 0.25rem;
      padding: 0.375rem 0.875rem;
      background: #2b6cb0;
      color: #fff;
      border: none;
      border-radius: 0.375rem;
      font-size: 0.875rem;
      font-weight: 600;
      cursor: pointer;
      flex-shrink: 0;
      &:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }
    }

    .body {
      padding: 1rem;
      max-width: 800px;
      margin: 0 auto;
    }

    /* Cover photo hero */
    .cover-hero {
      width: 100%;
      max-height: 280px;
      object-fit: cover;
      border-radius: 0.75rem;
      margin-bottom: 1rem;
      background: #edf2f7;
      cursor: pointer;
    }

    .lightbox-overlay {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.92);
      z-index: 9999;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: zoom-out;
    }

    .lightbox-img {
      max-width: 95vw;
      max-height: 95vh;
      object-fit: contain;
      border-radius: 0.5rem;
      cursor: default;
    }

    .lightbox-close {
      position: fixed;
      top: 1rem;
      right: 1rem;
      width: 2.5rem;
      height: 2.5rem;
      border-radius: 50%;
      border: none;
      background: rgba(255, 255, 255, 0.15);
      color: #fff;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      &:hover {
        background: rgba(255, 255, 255, 0.25);
      }
    }

    .meta-card {
      background: #fff;
      border: 1px solid #e2e8f0;
      border-radius: 0.75rem;
      padding: 1rem 1.25rem;
      margin-bottom: 1rem;
    }

    .meta-card h2 {
      margin: 0 0 0.75rem;
      font-size: 1rem;
      font-weight: 700;
      color: #2d3748;
    }

    .meta-grid {
      display: grid;
      grid-template-columns: auto 1fr;
      gap: 0.375rem 1rem;
      font-size: 0.9375rem;
    }
    .meta-label {
      color: #718096;
      font-weight: 500;
    }
    .meta-value {
      color: #2d3748;
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

    /* Room accordion */
    .room-section {
      margin-bottom: 1rem;
    }

    .room-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0.75rem 1rem;
      background: #f7fafc;
      border: 1px solid #e2e8f0;
      border-radius: 0.75rem;
      cursor: pointer;
      font-size: 0.9375rem;
      font-weight: 600;
      color: #2d3748;
    }

    .room-body {
      border: 1px solid #e2e8f0;
      border-top: none;
      border-radius: 0 0 0.75rem 0.75rem;
      padding: 0.875rem;
    }

    .photo-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(min(100%, 200px), 1fr));
      gap: 0.75rem;
    }

    .photo-cell {
      position: relative;
    }

    .photo-thumb {
      width: 100%;
      aspect-ratio: 4/3;
      object-fit: cover;
      border-radius: 0.5rem;
      background: #edf2f7;
      cursor: pointer;
    }

    .photo-meta {
      padding: 0.375rem 0.25rem 0;
      font-size: 0.8125rem;
      color: #718096;
    }

    .photo-flag-badge {
      display: inline-flex;
      align-items: center;
      gap: 0.2rem;
      font-size: 0.75rem;
      font-weight: 600;
      padding: 0.1rem 0.375rem;
      border-radius: 9999px;
      background: #fff5f5;
      color: #c53030;
    }

    .empty-state {
      color: #a0aec0;
      font-size: 0.875rem;
      text-align: center;
      padding: 1rem 0;
    }
    .loading-state {
      color: #a0aec0;
      font-size: 0.875rem;
      text-align: center;
      padding: 2rem;
    }
  `,
  template: `
    <div class="top-bar">
      <button class="icon-btn" (click)="back.emit()" aria-label="Back">
        <ng-icon name="heroChevronLeft" size="22" />
      </button>
      <h1>{{ inspection().title }}</h1>
      @if (canManage() && canReopen()) {
        <button class="edit-btn" [disabled]="reopening()" (click)="reopenInspection()">
          <ng-icon name="heroPencilSquare" size="14" />
          {{ reopening() ? 'Reopening…' : 'Edit' }}
        </button>
      }
    </div>

    <div class="body">
      @if (coverUrl()) {
        <img
          class="cover-hero"
          [src]="coverUrl()!"
          alt="Cover photo"
          (click)="openLightbox(coverUrl()!)"
        />
      }

      <div class="meta-card">
        <div class="meta-grid">
          <span class="meta-label">Type</span>
          <span class="meta-value">{{ typeLabel() }}</span>
          <span class="meta-label">Date</span>
          <span class="meta-value">{{ inspection().created_at | date: 'mediumDate' }}</span>
        </div>
      </div>

      @if (loadingPhotos()) {
        <p class="loading-state">Loading photos…</p>
      } @else {
        <!-- Rooms accordion — skip rooms with no photos -->
        @for (room of roomsWithPhotos(); track room.id) {
          <div class="room-section">
            <div class="room-header" (click)="toggleRoom(room.id)">
              <span>{{ room.display_name }}</span>
              <span style="display:flex;align-items:center;gap:0.5rem">
                <span style="font-size:0.8125rem;font-weight:400;color:#a0aec0">
                  {{ (photosByRoom()[room.id] ?? []).length }} photo{{
                    (photosByRoom()[room.id] ?? []).length === 1 ? '' : 's'
                  }}
                </span>
                <ng-icon
                  [name]="expandedRoom() === room.id ? 'heroChevronUp' : 'heroChevronDown'"
                  size="16"
                />
              </span>
            </div>

            @if (expandedRoom() === room.id) {
              <div class="room-body">
                @if ((photosByRoom()[room.id] ?? []).length === 0) {
                  <p class="empty-state">No photos for this room.</p>
                } @else {
                  <div class="photo-grid">
                    @for (photo of photosByRoom()[room.id]; track photo.id) {
                      <div class="photo-cell">
                        <img
                          class="photo-thumb"
                          [src]="photo.signedUrl ?? ''"
                          [alt]="photo.description || photo.file_name"
                          loading="lazy"
                          (click)="openLightbox(photo.signedUrl ?? '')"
                        />
                        <div class="photo-meta">
                          @if (photo.description) {
                            <p style="margin:0 0 0.2rem;color:#4a5568">{{ photo.description }}</p>
                          }
                          @if (photo.is_flagged) {
                            <span class="photo-flag-badge">
                              <ng-icon name="heroFlag" size="10" />
                              Flagged
                            </span>
                          }
                        </div>
                      </div>
                    }
                  </div>
                }
              </div>
            }
          </div>
        }
      }
    </div>

    @if (lightboxUrl()) {
      <div class="lightbox-overlay" (click)="closeLightbox()">
        <button class="lightbox-close" aria-label="Close photo" (click)="closeLightbox()">
          <ng-icon name="heroXMark" size="20" />
        </button>
        <img
          class="lightbox-img"
          [src]="lightboxUrl()!"
          alt="Enlarged photo"
          (click)="$event.stopPropagation()"
        />
      </div>
    }
  `,
})
export class InspectionDetailComponent implements OnInit {
  readonly inspection = input.required<Inspection>();
  readonly rooms = input.required<InspectionRoom[]>();
  readonly propertyId = input.required<string>();
  readonly canManage = input.required<boolean>();

  readonly back = output<void>();
  readonly reopened = output<void>();

  private readonly inspectionService = inject(InspectionService);
  private readonly photoService = inject(InspectionPhotoService);
  private readonly storageService = inject(InspectionStorageService);

  readonly loadingPhotos = signal(true);
  readonly allPhotos = signal<InspectionPhoto[]>([]);
  readonly expandedRoom = signal<string | null>(null);
  readonly photosByRoom = signal<Partial<Record<string, InspectionPhoto[]>>>({});
  readonly coverUrl = signal<string | null>(null);
  readonly reopening = signal(false);
  readonly lightboxUrl = signal<string | null>(null);

  readonly typeLabel = computed(
    () =>
      INSPECTION_TYPE_LABELS[this.inspection().inspection_type] ??
      this.inspection().inspection_type,
  );

  readonly roomsWithPhotos = computed(() =>
    this.rooms().filter((r) => (this.photosByRoom()[r.id] ?? []).length > 0),
  );

  canReopen(): boolean {
    return isWithin48h(this.inspection().created_at);
  }

  roomNameForPhoto(photo: InspectionPhoto): string {
    const room = this.rooms().find((r) => r.id === photo.room_id);
    return room?.display_name ?? '';
  }

  toggleRoom(roomId: string): void {
    this.expandedRoom.set(this.expandedRoom() === roomId ? null : roomId);
  }

  openLightbox(url: string): void {
    if (url) this.lightboxUrl.set(url);
  }

  closeLightbox(): void {
    this.lightboxUrl.set(null);
  }

  ngOnInit(): void {
    this.loadAllPhotos();
  }

  private loadAllPhotos(): void {
    const roomIds = this.rooms().map((r) => r.id);
    if (roomIds.length === 0) {
      this.loadingPhotos.set(false);
      return;
    }

    let completed = 0;
    const all: InspectionPhoto[] = [];
    const byRoom: Record<string, InspectionPhoto[]> = {};

    const finish = () => {
      const coverId = this.inspection().cover_photo_id;
      const coverPhoto = all.find((p) => p.id === coverId);
      if (coverPhoto?.storage_path) {
        this.storageService.getSignedUrl(coverPhoto.storage_path).subscribe({
          next: (url) => this.coverUrl.set(url),
        });
      }
      this.allPhotos.set(all);
      this.photosByRoom.set(byRoom);
      this.loadingPhotos.set(false);

      // Expand first room that has photos by default
      const firstWithPhotos = this.rooms().find((r) => (byRoom[r.id] ?? []).length > 0);
      if (firstWithPhotos) this.expandedRoom.set(firstWithPhotos.id);
    };

    for (const room of this.rooms()) {
      this.photoService.getPhotosForRoom(room.id).subscribe({
        next: (photos) => {
          if (photos.length === 0) {
            byRoom[room.id] = [];
            completed++;
            if (completed === roomIds.length) finish();
            return;
          }
          const paths = photos.map((p) => p.storage_path);
          this.photoService.getSignedUrls(paths).subscribe({
            next: (urls) => {
              const withUrls = photos.map((p, i) => ({ ...p, signedUrl: urls[i] }));
              byRoom[room.id] = withUrls;
              all.push(...withUrls);
              completed++;
              if (completed === roomIds.length) finish();
            },
            error: () => {
              byRoom[room.id] = photos;
              all.push(...photos);
              completed++;
              if (completed === roomIds.length) finish();
            },
          });
        },
        error: () => {
          byRoom[room.id] = [];
          completed++;
          if (completed === roomIds.length) finish();
        },
      });
    }
  }

  reopenInspection(): void {
    this.reopened.emit();
  }
}
