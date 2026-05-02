import {
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
  OnInit,
  output,
  signal,
  computed,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { NgIconComponent } from '@ng-icons/core';
import { InspectionPhotoService } from '../../../../core/services/inspection-photo.service';
import { InspectionStorageService } from '../../../../core/services/inspection-storage.service';
import { InspectionService } from '../../../../core/services/inspection.service';
import { RoleService } from '../../../../core/role/role.service';
import { AuthenticationService } from '../../../../core/auth/authentication.service';
import { InspectionPhoto, InspectionTag, isWithin24h } from '../../inspection.types';

@Component({
  selector: 'app-photo-capture',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, NgIconComponent],
  styles: `
    :host {
      display: block;
      padding: 1rem;
    }

    .capture-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      width: 100%;
      padding: 0.875rem;
      background: #2b6cb0;
      color: #fff;
      border: none;
      border-radius: 0.75rem;
      font-size: 1rem;
      font-weight: 600;
      cursor: pointer;
      margin-bottom: 1.25rem;
      &:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
    }

    .uploading-bar {
      text-align: center;
      color: #718096;
      font-size: 0.875rem;
      margin-bottom: 1rem;
    }

    .photo-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(min(100%, 280px), 1fr));
      gap: 1rem;
    }

    .photo-card {
      background: #fff;
      border: 1px solid #e2e8f0;
      border-radius: 0.75rem;
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }

    .photo-img {
      width: 100%;
      aspect-ratio: 4/3;
      object-fit: cover;
      background: #edf2f7;
    }

    .photo-img-placeholder {
      width: 100%;
      aspect-ratio: 4/3;
      background: #edf2f7;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #a0aec0;
      font-size: 0.875rem;
    }

    .photo-body {
      padding: 0.75rem;
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .photo-actions {
      display: flex;
      gap: 0.5rem;
      align-items: center;
      flex-wrap: wrap;
    }

    .action-btn {
      display: flex;
      align-items: center;
      gap: 0.25rem;
      padding: 0.25rem 0.625rem;
      border: 1px solid #cbd5e0;
      border-radius: 0.375rem;
      background: #fff;
      font-size: 0.8125rem;
      font-weight: 500;
      color: #4a5568;
      cursor: pointer;

      &.active {
        background: #ebf8ff;
        border-color: #63b3ed;
        color: #2b6cb0;
      }

      &.danger {
        color: #c53030;
        border-color: #fed7d7;

        &:hover {
          background: #fff5f5;
        }
      }
    }

    textarea {
      resize: none;
      border: 1px solid #cbd5e0;
      border-radius: 0.375rem;
      padding: 0.5rem 0.625rem;
      font-size: 0.875rem;
      color: #2d3748;
      width: 100%;
      box-sizing: border-box;
      outline: none;
      rows: 2;
      &:focus {
        border-color: #4299e1;
      }
    }

    .tag-chips {
      display: flex;
      flex-wrap: wrap;
      gap: 0.25rem;
    }

    .tag-chip {
      padding: 0.125rem 0.5rem;
      border-radius: 9999px;
      font-size: 0.75rem;
      font-weight: 500;
      cursor: pointer;
      border: 1px solid #cbd5e0;
      background: #f7fafc;
      color: #4a5568;

      &.selected {
        background: #ebf8ff;
        border-color: #63b3ed;
        color: #2b6cb0;
      }
    }

    .empty-state {
      text-align: center;
      color: #a0aec0;
      font-size: 0.9375rem;
      padding: 2rem 0;
    }
  `,
  template: `
    <input
      #fileInput
      type="file"
      accept="image/*"
      capture="environment"
      style="display:none"
      (change)="onFileSelected($event)"
    />

    <button class="capture-btn" [disabled]="uploading()" (click)="fileInput.click()">
      <ng-icon name="heroCamera" size="20" />
      {{ uploading() ? 'Uploading…' : 'Take Photo' }}
    </button>

    @if (uploading()) {
      <p class="uploading-bar">Processing and uploading photo…</p>
    }

    @if (loading()) {
      <p class="empty-state">Loading photos…</p>
    } @else if (photos().length === 0) {
      <p class="empty-state">No photos for this room yet. Tap above to add one.</p>
    } @else {
      <div class="photo-grid">
        @for (photo of photos(); track photo.id) {
          <div class="photo-card">
            @if (photo.signedUrl) {
              <img
                class="photo-img"
                [src]="photo.signedUrl"
                [alt]="photo.file_name"
                loading="lazy"
              />
            } @else {
              <div class="photo-img-placeholder">Loading…</div>
            }

            <div class="photo-body">
              <div class="photo-actions">
                <button
                  class="action-btn"
                  [class.active]="isCover(photo)"
                  (click)="setCover(photo)"
                  title="Set as cover photo"
                >
                  <ng-icon name="heroStar" size="13" />
                  Cover
                </button>

                <button
                  class="action-btn"
                  [class.active]="photo.is_actionable"
                  (click)="toggleActionable(photo)"
                >
                  <ng-icon name="heroFlag" size="13" />
                  Action Item
                </button>

                @if (photo.is_actionable) {
                  <button
                    class="action-btn"
                    [class.active]="photo.is_resolved"
                    (click)="toggleResolved(photo)"
                  >
                    <ng-icon name="heroCheckCircle" size="13" />
                    {{ photo.is_resolved ? 'Resolved' : 'Mark Resolved' }}
                  </button>
                }

                @if (canDelete(photo)) {
                  <button class="action-btn danger" (click)="deletePhoto(photo)">
                    <ng-icon name="heroTrash" size="13" />
                    Delete
                  </button>
                }
              </div>

              <textarea
                rows="2"
                placeholder="Description (optional)…"
                [value]="photo.description ?? ''"
                (input)="onDescriptionInput(photo, $event)"
                (blur)="flushDescription(photo)"
              ></textarea>

              @if (availableTags().length > 0) {
                <div class="tag-chips">
                  @for (tag of availableTags(); track tag.id) {
                    <span
                      class="tag-chip"
                      [class.selected]="isTagSelected(photo, tag)"
                      (click)="toggleTag(photo, tag)"
                      >{{ tag.name }}</span
                    >
                  }
                </div>
              }
            </div>
          </div>
        }
      </div>
    }
  `,
})
export class PhotoCaptureComponent implements OnInit {
  readonly propertyId = input.required<string>();
  readonly inspectionId = input.required<string>();
  readonly roomId = input.required<string>();
  readonly roomType = input.required<string>();
  readonly coverPhotoId = input<string | null>(null);

  readonly photoAdded = output<void>();
  readonly coverChanged = output<string>();

  private readonly photoService = inject(InspectionPhotoService);
  private readonly storageService = inject(InspectionStorageService);
  private readonly inspectionService = inject(InspectionService);
  private readonly roles = inject(RoleService);
  private readonly authService = inject(AuthenticationService);

  readonly currentUserId = toSignal(
    this.authService.getSession().pipe(map((s) => s?.user?.id ?? null)),
    { initialValue: null as string | null },
  );

  readonly loading = signal(true);
  readonly uploading = signal(false);
  readonly photos = signal<InspectionPhoto[]>([]);
  readonly availableTags = signal<InspectionTag[]>([]);

  private readonly descriptionTimers = new Map<string, ReturnType<typeof setTimeout>>();

  ngOnInit(): void {
    this.loadPhotos();
    this.loadTags();
  }

  private loadPhotos(): void {
    this.loading.set(true);
    this.photoService.getPhotosForRoom(this.roomId()).subscribe({
      next: (photos) => {
        this.loading.set(false);
        if (photos.length === 0) {
          this.photos.set([]);
          return;
        }
        const paths = photos.map((p) => p.storage_path);
        this.photoService.getSignedUrls(paths).subscribe({
          next: (urls) => {
            this.photos.set(photos.map((p, i) => ({ ...p, signedUrl: urls[i] })));
          },
          error: () => this.photos.set(photos),
        });
      },
      error: () => this.loading.set(false),
    });
  }

  private loadTags(): void {
    this.photoService.getTagsForRoomType(this.roomType()).subscribe({
      next: (tags) => this.availableTags.set(tags),
    });
  }

  onFileSelected(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    // Reset input so the same file can be re-selected if needed
    (event.target as HTMLInputElement).value = '';

    const userId = this.currentUserId();
    if (!userId) return;

    this.uploading.set(true);
    this.storageService
      .uploadPhoto(this.propertyId(), this.inspectionId(), this.roomType(), file)
      .subscribe({
        next: ({ storagePath, fileName }) => {
          this.photoService
            .addPhoto({
              inspection_id: this.inspectionId(),
              room_id: this.roomId(),
              storage_path: storagePath,
              file_name: fileName,
              uploaded_by: userId,
            })
            .subscribe({
              next: (photo) => {
                this.uploading.set(false);
                this.photoService.getSignedUrl(storagePath).subscribe({
                  next: (url) => {
                    this.photos.update((prev) => [...prev, { ...photo, signedUrl: url }]);
                    this.photoAdded.emit();
                  },
                  error: () => {
                    this.photos.update((prev) => [...prev, photo]);
                    this.photoAdded.emit();
                  },
                });
              },
              error: () => this.uploading.set(false),
            });
        },
        error: () => this.uploading.set(false),
      });
  }

  isCover(photo: InspectionPhoto): boolean {
    return photo.id === this.coverPhotoId();
  }

  setCover(photo: InspectionPhoto): void {
    this.inspectionService.setCoverPhoto(this.inspectionId(), photo.id).subscribe({
      next: () => this.coverChanged.emit(photo.id),
    });
  }

  toggleActionable(photo: InspectionPhoto): void {
    const is_actionable = !photo.is_actionable;
    const patch = is_actionable ? { is_actionable } : { is_actionable, is_resolved: false };
    this.photoService.updatePhoto(photo.id, patch).subscribe({
      next: () => this.updatePhotoInList(photo.id, patch),
    });
  }

  toggleResolved(photo: InspectionPhoto): void {
    const is_resolved = !photo.is_resolved;
    this.photoService.updatePhoto(photo.id, { is_resolved }).subscribe({
      next: () => this.updatePhotoInList(photo.id, { is_resolved }),
    });
  }

  onDescriptionInput(photo: InspectionPhoto, event: Event): void {
    const description = (event.target as HTMLTextAreaElement).value;
    // Debounce 800ms
    clearTimeout(this.descriptionTimers.get(photo.id));
    const timer = setTimeout(() => {
      this.photoService.updatePhoto(photo.id, { description }).subscribe({
        next: () => this.updatePhotoInList(photo.id, { description }),
      });
    }, 800);
    this.descriptionTimers.set(photo.id, timer);
  }

  flushDescription(photo: InspectionPhoto): void {
    const timer = this.descriptionTimers.get(photo.id);
    if (!timer) return;
    clearTimeout(timer);
    this.descriptionTimers.delete(photo.id);
    const textarea = document.querySelector(
      `textarea[data-photo-id="${photo.id}"]`,
    ) as HTMLTextAreaElement | null;
    // Just let the debounce fire — blur ensures it was already dispatched
  }

  isTagSelected(photo: InspectionPhoto, tag: InspectionTag): boolean {
    return (photo.tags ?? []).some((t) => t.id === tag.id);
  }

  toggleTag(photo: InspectionPhoto, tag: InspectionTag): void {
    const current = (photo.tags ?? []).map((t) => t.id);
    const newIds = current.includes(tag.id)
      ? current.filter((id) => id !== tag.id)
      : [...current, tag.id];

    this.photoService.setTags(photo.id, newIds).subscribe({
      next: () => {
        const allTags = this.availableTags();
        const newTags = allTags.filter((t) => newIds.includes(t.id));
        this.updatePhotoInList(photo.id, { tags: newTags });
      },
    });
  }

  canDelete(photo: InspectionPhoto): boolean {
    return this.roles.isManagerOrAbove() && isWithin24h(photo.created_at);
  }

  deletePhoto(photo: InspectionPhoto): void {
    this.photoService
      .deletePhoto(photo.id, photo.storage_path, (path) => this.storageService.deletePhoto(path))
      .subscribe({
        next: () => {
          this.photos.update((prev) => prev.filter((p) => p.id !== photo.id));
          this.photoAdded.emit();
        },
      });
  }

  private updatePhotoInList(id: string, patch: Partial<InspectionPhoto>): void {
    this.photos.update((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  }
}
