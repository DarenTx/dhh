import { TestBed } from '@angular/core/testing';
import { Title } from '@angular/platform-browser';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DocumentsPage } from './documents-page';
import { DocumentService } from '../../core/services/document.service';
import { DocumentStorageService } from '../../core/services/document-storage.service';
import { RoleService } from '../../core/role/role.service';

describe('DocumentsPage', () => {
  let component: DocumentsPage;
  let storageService: { getSignedUrl: ReturnType<typeof vi.fn> };
  let documentService: { getAll: ReturnType<typeof vi.fn>; delete: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    storageService = {
      getSignedUrl: vi.fn().mockReturnValue(of('https://example.com/view')),
    };
    documentService = {
      getAll: vi.fn().mockReturnValue(of([])),
      delete: vi.fn().mockReturnValue(of(void 0)),
    };

    await TestBed.configureTestingModule({
      imports: [DocumentsPage],
      providers: [
        { provide: DocumentService, useValue: documentService },
        { provide: DocumentStorageService, useValue: storageService },
        { provide: RoleService, useValue: { isManagerOrAbove: () => true } },
        { provide: Title, useValue: { setTitle: vi.fn() } },
      ],
    }).compileComponents();

    component = TestBed.createComponent(DocumentsPage).componentInstance;
  });

  it('opens a signed URL in a new tab when viewing a document', () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    const doc = { id: '1', title: 'Lease', storage_path: 'documents/1/lease.pdf' } as any;

    component.onView(doc);

    expect(storageService.getSignedUrl).toHaveBeenCalledWith(doc.storage_path);
    expect(openSpy).toHaveBeenCalledWith(
      'https://example.com/view',
      '_blank',
      'noopener,noreferrer',
    );
  });
});
