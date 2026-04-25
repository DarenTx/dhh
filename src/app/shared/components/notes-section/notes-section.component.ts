import { ChangeDetectionStrategy, Component, effect, inject, input, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { map } from 'rxjs/operators';
import { AuthenticationService } from '../../../core/auth/authentication.service';
import { NotesService, NoteEntityType, Note } from '../../../core/services/notes.service';
import { RoleService } from '../../../core/role/role.service';

@Component({
  selector: 'app-notes-section',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule],
  styles: `
    :host {
      display: block;
    }

    .notes-header {
      font-size: 1.125rem;
      font-weight: 600;
      color: #2d3748;
      margin: 0 0 1rem;
    }

    .note-list {
      list-style: none;
      margin: 0 0 1.5rem;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }

    .note-card {
      background: #fff;
      border: 1px solid #e2e8f0;
      border-radius: 0.5rem;
      padding: 0.875rem 1rem;
    }

    .note-meta {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.5rem;
      margin-bottom: 0.375rem;
    }

    .note-author {
      font-size: 0.8125rem;
      font-weight: 600;
      color: #4a5568;
    }

    .note-time {
      font-size: 0.75rem;
      color: #a0aec0;
      white-space: nowrap;
    }

    .note-content {
      font-size: 0.9375rem;
      color: #2d3748;
      white-space: pre-wrap;
      word-break: break-word;
    }

    .deactivate-btn {
      background: none;
      border: none;
      cursor: pointer;
      font-size: 0.75rem;
      color: #a0aec0;
      padding: 0;
      line-height: 1;

      &:hover {
        color: #e53e3e;
      }
    }

    .empty-state {
      color: #a0aec0;
      font-size: 0.9375rem;
      margin: 0 0 1.5rem;
    }

    .add-note {
      display: flex;
      flex-direction: column;
      gap: 0.625rem;
    }

    .add-note textarea {
      width: 100%;
      min-height: 5rem;
      padding: 0.625rem 0.75rem;
      border: 1px solid #e2e8f0;
      border-radius: 0.375rem;
      font-size: 0.9375rem;
      font-family: inherit;
      resize: vertical;
      color: #2d3748;
      box-sizing: border-box;

      &:focus {
        outline: none;
        border-color: #4299e1;
        box-shadow: 0 0 0 2px rgb(66 153 225 / 0.2);
      }
    }

    .add-note-actions {
      display: flex;
      justify-content: flex-end;
    }

    .submit-btn {
      padding: 0.5rem 1.25rem;
      background: #2b6cb0;
      color: #fff;
      border: none;
      border-radius: 0.375rem;
      font-size: 0.9375rem;
      font-weight: 500;
      cursor: pointer;
      transition: background 0.15s;

      &:hover:not(:disabled) {
        background: #2c5282;
      }

      &:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
    }
  `,
  template: `
    <h3 class="notes-header">Notes</h3>

    @if (loading()) {
      <p class="empty-state">Loading…</p>
    } @else if (notes().length === 0) {
      <p class="empty-state">No notes yet.</p>
    } @else {
      <ul class="note-list">
        @for (note of notes(); track note.id) {
          <li class="note-card">
            <div class="note-meta">
              <span class="note-author">{{ note.created_by_email ?? 'Unknown' }}</span>
              <span class="note-time">{{ formatDate(note.created_at) }}</span>
              @if (canManage()) {
                <button
                  class="deactivate-btn"
                  title="Remove note"
                  (click)="deactivate(note)"
                  [disabled]="saving()"
                >
                  ✕
                </button>
              }
            </div>
            <p class="note-content">{{ note.content }}</p>
          </li>
        }
      </ul>
    }

    <div class="add-note">
      <textarea placeholder="Add a note…" [(ngModel)]="newContent" [disabled]="saving()"></textarea>
      <div class="add-note-actions">
        <button class="submit-btn" (click)="addNote()" [disabled]="saving() || !newContent.trim()">
          {{ saving() ? 'Saving…' : 'Add Note' }}
        </button>
      </div>
    </div>
  `,
})
export class NotesSectionComponent {
  readonly entityType = input.required<NoteEntityType>();
  readonly entityId = input.required<string>();

  private readonly notesService = inject(NotesService);
  private readonly roles = inject(RoleService);
  private readonly auth = inject(AuthenticationService);

  private readonly session = toSignal(this.auth.getSession(), { initialValue: null });

  readonly notes = signal<Note[]>([]);
  readonly loading = signal(false);
  readonly saving = signal(false);
  newContent = '';

  canManage(): boolean {
    return this.roles.isManagerOrAbove();
  }

  constructor() {
    effect(() => {
      const id = this.entityId();
      if (!id) return;
      this.loadNotes();
    });
  }

  private loadNotes(): void {
    this.loading.set(true);
    this.notesService.getNotes(this.entityType(), this.entityId()).subscribe({
      next: (notes) => {
        this.notes.set(notes);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  addNote(): void {
    const content = this.newContent.trim();
    if (!content || this.saving()) return;

    const email = this.session()?.user?.email ?? 'Unknown';
    this.saving.set(true);
    this.notesService.createNote(this.entityType(), this.entityId(), content, email).subscribe({
      next: (note) => {
        this.notes.update((prev) => [note, ...prev]);
        this.newContent = '';
        this.saving.set(false);
      },
      error: () => this.saving.set(false),
    });
  }

  deactivate(note: Note): void {
    if (this.saving()) return;
    this.saving.set(true);
    this.notesService.deactivateNote(note.id).subscribe({
      next: () => {
        this.notes.update((prev) => prev.filter((n) => n.id !== note.id));
        this.saving.set(false);
      },
      error: () => this.saving.set(false),
    });
  }

  formatDate(iso: string): string {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(new Date(iso));
  }
}
