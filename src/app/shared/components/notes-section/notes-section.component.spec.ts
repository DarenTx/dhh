import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { of, Subject } from 'rxjs';
import { NotesSectionComponent } from './notes-section.component';
import { NotesService, Note } from '../../../core/services/notes.service';
import { RoleService } from '../../../core/role/role.service';
import { AuthenticationService } from '../../../core/auth/authentication.service';

const NOTE_STUB: Note = {
  id: 'n1',
  property_id: 'p1',
  tenant_id: null,
  lease_id: null,
  content: 'Test note',
  is_active: true,
  created_by: 'u1',
  created_by_email: 'user@example.com',
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
};

function setup(opts: { notes?: Note[]; canManage?: boolean } = {}) {
  const notes = opts.notes ?? [];
  const canManage = opts.canManage ?? true;

  const mockNotes = {
    getNotes: vi.fn().mockReturnValue(of(notes)),
    createNote: vi.fn().mockReturnValue(of({ ...NOTE_STUB, id: 'n-new', content: 'New note' })),
    deactivateNote: vi.fn().mockReturnValue(of(undefined)),
  };

  const mockRoles = { isManagerOrAbove: vi.fn().mockReturnValue(canManage) };

  const mockAuth = {
    getSession: vi.fn().mockReturnValue(of({ user: { email: 'test@example.com' } })),
  };

  TestBed.configureTestingModule({
    imports: [NotesSectionComponent],
    providers: [
      { provide: NotesService, useValue: mockNotes },
      { provide: RoleService, useValue: mockRoles },
      { provide: AuthenticationService, useValue: mockAuth },
    ],
  });

  const fixture: ComponentFixture<NotesSectionComponent> =
    TestBed.createComponent(NotesSectionComponent);
  fixture.componentRef.setInput('entityType', 'property');
  fixture.componentRef.setInput('entityId', 'p1');
  fixture.detectChanges();

  return { fixture, mockNotes, mockRoles };
}

describe('NotesSectionComponent', () => {
  it('shows loading then notes', () => {
    const { fixture } = setup({ notes: [NOTE_STUB] });
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('Test note');
    expect(el.textContent).toContain('user@example.com');
  });

  it('shows empty state when no notes', () => {
    const { fixture } = setup({ notes: [] });
    expect(fixture.nativeElement.textContent).toContain('No notes yet');
  });

  it('shows deactivate button for manager+', () => {
    const { fixture } = setup({ notes: [NOTE_STUB], canManage: true });
    const btn = fixture.nativeElement.querySelector('.deactivate-btn');
    expect(btn).not.toBeNull();
  });

  it('hides deactivate button for view_only', () => {
    const { fixture } = setup({ notes: [NOTE_STUB], canManage: false });
    const btn = fixture.nativeElement.querySelector('.deactivate-btn');
    expect(btn).toBeNull();
  });

  it('calls createNote and prepends new note on submit', () => {
    const { fixture, mockNotes } = setup({ notes: [] });
    const component = fixture.componentInstance;

    component.newContent = 'New note';
    component.addNote();
    fixture.detectChanges();

    expect(mockNotes.createNote).toHaveBeenCalledWith(
      'property',
      'p1',
      'New note',
      'test@example.com',
    );
    expect(component.notes().some((n) => n.id === 'n-new')).toBe(true);
    expect(component.newContent).toBe('');
  });

  it('does not call createNote when content is blank', () => {
    const { fixture, mockNotes } = setup({ notes: [] });
    fixture.componentInstance.newContent = '   ';
    fixture.componentInstance.addNote();
    expect(mockNotes.createNote).not.toHaveBeenCalled();
  });

  it('calls deactivateNote and removes note from list', () => {
    const { fixture, mockNotes } = setup({ notes: [NOTE_STUB] });
    const component = fixture.componentInstance;

    component.deactivate(NOTE_STUB);
    fixture.detectChanges();

    expect(mockNotes.deactivateNote).toHaveBeenCalledWith('n1');
    expect(component.notes().find((n) => n.id === 'n1')).toBeUndefined();
  });

  it('reloads notes when entityId changes', () => {
    const { fixture, mockNotes } = setup({ notes: [] });
    mockNotes.getNotes.mockClear();

    fixture.componentRef.setInput('entityId', 'p2');
    fixture.detectChanges();

    expect(mockNotes.getNotes).toHaveBeenCalledWith('property', 'p2');
  });
});
