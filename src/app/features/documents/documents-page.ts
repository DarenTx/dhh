import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { Title } from '@angular/platform-browser';
import { NgIconComponent } from '@ng-icons/core';
import { DocumentService, DocumentWithProperty } from '../../core/services/document.service';
import { DocumentStorageService } from '../../core/services/document-storage.service';
import { RoleService } from '../../core/role/role.service';
import { DocumentUploadWizardComponent } from './document-upload-wizard/document-upload-wizard.component';
import { DocumentEditModalComponent } from './document-edit-modal/document-edit-modal.component';

@Component({
  selector: 'app-documents-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, NgIconComponent, DocumentUploadWizardComponent, DocumentEditModalComponent],
  styles: `
    .page-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 1.5rem 1.5rem 0;
    }
    h1 {
      font-size: 1.5rem;
      font-weight: 700;
      color: #2d3748;
      margin: 0;
    }
    .btn-add {
      display: inline-flex;
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
      &:hover {
        background: #2c5282;
      }
    }
    .loading {
      color: #718096;
      font-size: 0.9375rem;
      padding: 1rem 1.5rem;
    }
    .empty-state {
      text-align: center;
      color: #a0aec0;
      padding: 3rem 1.5rem;
      font-size: 0.9375rem;
    }
    .content {
      padding: 1rem 1.5rem 4rem;
    }
    .table-wrap {
      overflow-x: auto;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.9375rem;
    }
    thead th {
      text-align: left;
      padding: 0.625rem 0.75rem;
      font-size: 0.8125rem;
      font-weight: 600;
      color: #718096;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      border-bottom: 1px solid #e2e8f0;
      white-space: nowrap;
    }
    tbody tr {
      border-bottom: 1px solid #f0f4f8;
      &:last-child {
        border-bottom: none;
      }
      &:hover {
        background: #f7fafc;
      }
    }
    td {
      padding: 0.75rem;
      color: #2d3748;
      vertical-align: middle;
      white-space: nowrap;
    }
    td:first-child {
      white-space: normal;
    }
    .doc-title {
      font-weight: 600;
    }
    .doc-desc {
      font-size: 0.8125rem;
      color: #718096;
      margin-top: 0.25rem;
    }
    .property-badge {
      display: inline-block;
      padding: 0.125rem 0.5rem;
      border-radius: 9999px;
      font-size: 0.8125rem;
      font-weight: 500;
      background: #ebf8ff;
      color: #2b6cb0;
    }
    .property-llc {
      background: #f0fff4;
      color: #276749;
    }
    .row-actions {
      display: flex;
      gap: 0.5rem;
    }
    .btn-icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 2rem;
      height: 2rem;
      border: 1px solid #e2e8f0;
      border-radius: 0.375rem;
      background: #fff;
      cursor: pointer;
      color: #4a5568;
      &:hover {
        background: #f7fafc;
      }
    }
    .btn-icon-danger {
      color: #e53e3e;
      border-color: #fed7d7;
      &:hover {
        background: #fff5f5;
      }
    }
    .btn-icon-primary {
      color: #2b6cb0;
      border-color: #bee3f8;
      &:hover {
        background: #ebf8ff;
      }
    }
    .modal-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.4);
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

    @media (max-width: 639px) {
      .page-header {
        padding: 1rem 1rem 0;
      }
      .content {
        padding: 0.75rem 1rem 4rem;
      }
      .table-wrap {
        overflow-x: visible;
      }
      table,
      tbody {
        display: block;
        width: 100%;
      }
      thead {
        display: none;
      }
      tbody tr {
        display: grid;
        grid-template-columns: 1fr auto;
        border: 1px solid #e2e8f0;
        border-bottom: 1px solid #e2e8f0;
        border-radius: 0.5rem;
        margin-bottom: 0.625rem;
        padding: 0.75rem;
        background: #fff;
        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
        &:last-child {
          border-bottom: 1px solid #e2e8f0;
        }
        &:hover {
          background: #f7fafc;
        }
      }
      td {
        padding: 0;
        white-space: normal;
        vertical-align: top;
      }
      /* Title — full width */
      td:nth-child(1) {
        grid-column: 1 / -1;
        padding-bottom: 0.5rem;
      }
      /* Property badge — left of row 2 */
      td:nth-child(2) {
        grid-column: 1;
        align-self: center;
        padding-bottom: 0;
      }
      /* Date — right of row 2 */
      td:nth-child(3) {
        grid-column: 2;
        font-size: 0.8125rem;
        color: #718096;
        text-align: right;
        align-self: center;
        white-space: nowrap;
        padding-bottom: 0;
      }
      /* Actions — full width with top divider */
      td:nth-child(4) {
        grid-column: 1 / -1;
        padding-top: 0.625rem;
        margin-top: 0.5rem;
        border-top: 1px solid #f0f4f8;
      }
    }
  `,
  template: `
    <div class="page-header">
      <h1>Documents</h1>
      @if (canManage()) {
        <button class="btn-add" (click)="showWizard.set(true)">
          <ng-icon name="heroPlus" size="16" />
          Add Document
        </button>
      }
    </div>

    @if (loading()) {
      <p class="loading">Loading…</p>
    } @else if (documents().length === 0) {
      <p class="empty-state">No documents uploaded yet.</p>
    } @else {
      <div class="content">
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Title</th>
                <th>Property</th>
                <th>Uploaded</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              @for (doc of documents(); track doc.id) {
                <tr>
                  <td>
                    <div class="doc-title">{{ doc.title }}</div>
                    @if (doc.description) {
                      <div class="doc-desc">{{ doc.description }}</div>
                    }
                  </td>
                  <td>
                    @if (doc.property) {
                      <span class="property-badge">{{ doc.property.address_line1 }}</span>
                    } @else {
                      <span class="property-badge property-llc">LLC</span>
                    }
                  </td>
                  <td>{{ doc.created_at | date: 'MMM d, y' }}</td>
                  <td>
                    <div class="row-actions">
                      <button
                        class="btn-icon btn-icon-primary"
                        title="Download"
                        (click)="onDownload(doc)"
                      >
                        <ng-icon name="heroArrowDownTray" size="16" />
                      </button>
                      @if (canManage()) {
                        <button class="btn-icon" title="Edit" (click)="editingDocument.set(doc)">
                          <ng-icon name="heroPencil" size="16" />
                        </button>
                        <button
                          class="btn-icon btn-icon-danger"
                          title="Delete"
                          (click)="onDelete(doc)"
                        >
                          <ng-icon name="heroTrash" size="16" />
                        </button>
                      }
                    </div>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </div>
    }

    @if (showWizard()) {
      <div class="modal-backdrop" (click)="showWizard.set(false)">
        <div class="modal" (click)="$event.stopPropagation()">
          <app-document-upload-wizard
            (saved)="onWizardSaved()"
            (cancelled)="showWizard.set(false)"
          />
        </div>
      </div>
    }

    @if (editingDocument()) {
      <div class="modal-backdrop" (click)="editingDocument.set(null)">
        <div class="modal" (click)="$event.stopPropagation()">
          <app-document-edit-modal
            [document]="editingDocument()!"
            (saved)="onEditSaved()"
            (cancelled)="editingDocument.set(null)"
          />
        </div>
      </div>
    }
  `,
})
export class DocumentsPage implements OnInit {
  private readonly documentService = inject(DocumentService);
  private readonly storageService = inject(DocumentStorageService);
  private readonly roles = inject(RoleService);
  private readonly titleService = inject(Title);

  readonly loading = signal(true);
  readonly documents = signal<DocumentWithProperty[]>([]);
  readonly showWizard = signal(false);
  readonly editingDocument = signal<DocumentWithProperty | null>(null);

  readonly canManage = computed(() => this.roles.isManagerOrAbove());

  ngOnInit(): void {
    this.titleService.setTitle('Documents — DHH');
    this.loadDocuments();
  }

  private loadDocuments(): void {
    this.loading.set(true);
    this.documentService.getAll().subscribe({
      next: (docs) => {
        this.documents.set(docs);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  onWizardSaved(): void {
    this.showWizard.set(false);
    this.loadDocuments();
  }

  onEditSaved(): void {
    this.editingDocument.set(null);
    this.loadDocuments();
  }

  onDelete(doc: DocumentWithProperty): void {
    const label = doc.title;
    if (!confirm(`Delete "${label}"? This action cannot be undone.`)) return;

    this.documentService.delete(doc.id, doc.created_at, doc.storage_path).subscribe({
      next: () => this.loadDocuments(),
      error: (err: Error) => alert(err.message ?? 'Failed to delete document.'),
    });
  }

  onDownload(doc: DocumentWithProperty): void {
    this.storageService.getSignedUrl(doc.storage_path).subscribe({
      next: (url) => window.open(url, '_blank'),
      error: () => alert('Could not generate download link. Please try again.'),
    });
  }
}
