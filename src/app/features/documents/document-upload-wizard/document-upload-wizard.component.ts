import { ChangeDetectionStrategy, Component, inject, OnInit, output, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { NgIconComponent } from '@ng-icons/core';
import { DocumentService, Document } from '../../../core/services/document.service';
import { DocumentStorageService } from '../../../core/services/document-storage.service';
import {
  AiExtractionService,
  DocumentPropertyOption,
} from '../../../core/services/ai-extraction.service';
import { PropertyService, Property } from '../../../core/services/property.service';
import { switchMap, map, forkJoin } from 'rxjs';

type WizardStep = 1 | 2;

@Component({
  selector: 'app-document-upload-wizard',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, NgIconComponent],
  styles: `
    .wizard-steps {
      display: flex;
      align-items: center;
      gap: 0;
      margin-bottom: 1.5rem;
    }
    .step-indicator {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 0.875rem;
      color: #a0aec0;
      &.active {
        color: #2b6cb0;
        font-weight: 600;
      }
      &.done {
        color: #38a169;
      }
    }
    .step-num {
      width: 1.5rem;
      height: 1.5rem;
      border-radius: 50%;
      border: 2px solid currentColor;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.75rem;
      font-weight: 700;
      flex-shrink: 0;
    }
    .step-sep {
      flex: 1;
      height: 2px;
      background: #e2e8f0;
      margin: 0 0.5rem;
    }
    .modal-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 1.25rem;
    }
    h2 {
      margin: 0;
      font-size: 1.25rem;
      font-weight: 700;
      color: #2d3748;
    }
    .close-btn {
      background: none;
      border: none;
      cursor: pointer;
      color: #718096;
      padding: 0.25rem;
      display: flex;
      align-items: center;
      &:hover {
        color: #2d3748;
      }
    }
    .drop-zone {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      border: 2px dashed #cbd5e0;
      border-radius: 0.5rem;
      padding: 2rem;
      text-align: center;
      cursor: pointer;
      transition:
        border-color 0.15s,
        background 0.15s;
      &:hover,
      &.dragover {
        border-color: #63b3ed;
        background: #ebf8ff;
      }
    }
    .drop-zone input[type='file'] {
      display: none;
    }
    .drop-icon {
      color: #a0aec0;
      margin-bottom: 0.5rem;
      display: flex;
    }
    .drop-label {
      font-size: 0.9375rem;
      color: #4a5568;
      margin: 0;
    }
    .drop-hint {
      font-size: 0.8125rem;
      color: #a0aec0;
      margin: 0.375rem 0 0;
    }
    .file-list {
      margin-top: 0.75rem;
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
      align-self: stretch;
      text-align: left;
    }
    .file-list-item {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 0.875rem;
      color: #2d3748;
      padding: 0.125rem 0;
    }
    .form-field {
      display: flex;
      flex-direction: column;
      gap: 0.375rem;
      margin-bottom: 1rem;
    }
    label {
      font-size: 0.875rem;
      font-weight: 600;
      color: #4a5568;
    }
    input,
    textarea,
    select {
      border: 1px solid #e2e8f0;
      border-radius: 0.375rem;
      padding: 0.5rem 0.75rem;
      font-size: 0.9375rem;
      color: #2d3748;
      background: #fff;
      width: 100%;
      box-sizing: border-box;
      &:focus {
        outline: none;
        border-color: #63b3ed;
        box-shadow: 0 0 0 3px rgba(66, 153, 225, 0.2);
      }
    }
    textarea {
      resize: vertical;
      min-height: 80px;
    }
    .field-error {
      font-size: 0.8125rem;
      color: #e53e3e;
    }
    .form-actions {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-top: 1.5rem;
    }
    .btn-cancel {
      padding: 0.5rem 1.25rem;
      border: 1px solid #e2e8f0;
      border-radius: 0.375rem;
      background: #fff;
      color: #4a5568;
      font-size: 0.9375rem;
      cursor: pointer;
      &:hover {
        background: #f7fafc;
      }
    }
    .btn-primary {
      padding: 0.5rem 1.25rem;
      border: none;
      border-radius: 0.375rem;
      background: #2b6cb0;
      color: #fff;
      font-size: 0.9375rem;
      font-weight: 500;
      cursor: pointer;
      &:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }
      &:hover:not(:disabled) {
        background: #2c5282;
      }
    }
    .loading-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 1rem;
      padding: 2rem 0;
      color: #718096;
    }
    .spinner {
      width: 2rem;
      height: 2rem;
      border: 3px solid #e2e8f0;
      border-top-color: #2b6cb0;
      border-radius: 50%;
      animation: spin 0.75s linear infinite;
    }
    @keyframes spin {
      to {
        transform: rotate(360deg);
      }
    }
    .error-msg {
      color: #e53e3e;
      font-size: 0.875rem;
      margin-top: 0.5rem;
    }
  `,
  template: `
    <div class="modal-header">
      <h2>Add Document</h2>
      <button class="close-btn" type="button" (click)="onCancel()">
        <ng-icon name="heroXMark" size="20" />
      </button>
    </div>

    <div class="wizard-steps">
      <div class="step-indicator" [class.active]="step() === 1" [class.done]="step() > 1">
        <span class="step-num">
          @if (step() > 1) {
            <ng-icon name="heroCheck" size="12" />
          } @else {
            1
          }
        </span>
        Upload
      </div>
      <div class="step-sep"></div>
      <div class="step-indicator" [class.active]="step() === 2">
        <span class="step-num">2</span>
        Review &amp; Save
      </div>
    </div>

    @if (step() === 1) {
      @if (extracting()) {
        <div class="loading-state">
          <div class="spinner"></div>
          <span>{{
            selectedFiles()[0]?.type === 'application/pdf'
              ? 'Analyzing document with AI…'
              : 'Uploading files…'
          }}</span>
        </div>
      } @else {
        <label
          class="drop-zone"
          [class.dragover]="dragover()"
          (dragover)="onDragOver($event)"
          (dragleave)="dragover.set(false)"
          (drop)="onDrop($event)"
        >
          <input
            type="file"
            accept="application/pdf,image/jpeg,image/png,image/gif"
            multiple
            (change)="onFileChange($event)"
          />
          <div class="drop-icon">
            <ng-icon name="heroDocumentArrowUp" size="32" />
          </div>
          <p class="drop-label">Drop files here or click to browse</p>
          <p class="drop-hint">
            PDF (single) or images: PNG, JPG, GIF (multiple) &middot; max 20 MB each
          </p>
          @if (selectedFiles().length) {
            <div class="file-list">
              @for (f of selectedFiles(); track f.name) {
                <div class="file-list-item">
                  <ng-icon name="heroDocumentText" size="16" />
                  {{ f.name }}
                </div>
              }
            </div>
          }
        </label>

        @if (stepError()) {
          <p class="error-msg">{{ stepError() }}</p>
        }

        <div class="form-actions">
          <button class="btn-cancel" type="button" (click)="onCancel()">Cancel</button>
          <button
            class="btn-primary"
            type="button"
            [disabled]="!selectedFiles().length"
            (click)="onNext()"
          >
            Next: Review Details
          </button>
        </div>
      }
    }

    @if (step() === 2) {
      <form [formGroup]="form" (ngSubmit)="onSave()">
        <div class="form-field">
          <label for="wiz-title">Title</label>
          <input id="wiz-title" type="text" formControlName="title" placeholder="Document title" />
          @if (form.controls.title.invalid && form.controls.title.touched) {
            <span class="field-error">Title is required.</span>
          }
        </div>

        <div class="form-field">
          <label for="wiz-desc">Description</label>
          <textarea
            id="wiz-desc"
            formControlName="description"
            placeholder="Brief description of this document"
          ></textarea>
        </div>

        <div class="form-field">
          <label for="wiz-property">Property</label>
          <select id="wiz-property" formControlName="property_id">
            <option [value]="null">LLC</option>
            @for (prop of properties(); track prop.id) {
              <option [value]="prop.id">{{ prop.address_line1 }}</option>
            }
          </select>
        </div>

        @if (stepError()) {
          <p class="error-msg">{{ stepError() }}</p>
        }

        <div class="form-actions">
          <button class="btn-cancel" type="button" (click)="onBack()">Back</button>
          <button class="btn-primary" type="submit" [disabled]="form.invalid || saving()">
            {{ saving() ? 'Saving…' : 'Save Document' }}
          </button>
        </div>
      </form>
    }
  `,
})
export class DocumentUploadWizardComponent implements OnInit {
  readonly saved = output<Document>();
  readonly cancelled = output<void>();

  private readonly documentService = inject(DocumentService);
  private readonly storageService = inject(DocumentStorageService);
  private readonly aiService = inject(AiExtractionService);
  private readonly propertyService = inject(PropertyService);

  readonly step = signal<WizardStep>(1);
  readonly selectedFiles = signal<File[]>([]);
  readonly dragover = signal(false);
  readonly extracting = signal(false);
  readonly saving = signal(false);
  readonly stepError = signal<string | null>(null);
  readonly properties = signal<Property[]>([]);

  private draftPaths: string[] = [];

  readonly form = new FormGroup({
    title: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    description: new FormControl<string | null>(null),
    property_id: new FormControl<string | null>(null),
  });

  ngOnInit(): void {
    this.propertyService.getProperties().subscribe((props) => this.properties.set(props));
  }

  onFileChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.setFiles(Array.from(input.files ?? []));
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.dragover.set(true);
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.dragover.set(false);
    this.setFiles(Array.from(event.dataTransfer?.files ?? []));
  }

  private setFiles(files: File[]): void {
    if (!files.length) return;
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/gif'];
    const invalid = files.find((f) => !allowedTypes.includes(f.type));
    if (invalid) {
      this.stepError.set(
        `"${invalid.name}" is not an accepted file type. Only PDF, PNG, JPG, and GIF are allowed.`,
      );
      return;
    }
    const hasPdf = files.some((f) => f.type === 'application/pdf');
    if (hasPdf && files.length > 1) {
      this.stepError.set('PDF documents must be uploaded one at a time.');
      return;
    }
    const oversized = files.find((f) => f.size > 20 * 1024 * 1024);
    if (oversized) {
      this.stepError.set(`"${oversized.name}" exceeds the 20 MB limit.`);
      return;
    }
    this.selectedFiles.set(files);
    this.stepError.set(null);
  }

  onNext(): void {
    const files = this.selectedFiles();
    if (!files.length) return;

    this.extracting.set(true);
    this.stepError.set(null);

    const isPdf = files[0].type === 'application/pdf';

    // Upload all selected files as drafts first
    forkJoin(files.map((f) => this.storageService.uploadDraft(f))).subscribe({
      next: (paths) => {
        this.draftPaths = paths;

        if (isPdf) {
          // AI extraction from the single PDF draft
          const propertyOptions: DocumentPropertyOption[] = [
            { id: null, address: 'LLC' },
            ...this.properties().map((p) => ({ id: p.id, address: p.address_line1 })),
          ];
          this.aiService
            .extractDocument({
              storage_bucket: 'documents',
              storage_path: paths[0],
              properties: propertyOptions,
            })
            .subscribe({
              next: (result) => {
                this.extracting.set(false);
                const fields = result.extracted_fields;
                this.form.setValue({
                  title: fields.title ?? '',
                  description: fields.description ?? null,
                  property_id: fields.property_id ?? null,
                });
                this.step.set(2);
              },
              error: (err: Error) => {
                this.extracting.set(false);
                this.stepError.set(err.message ?? 'AI extraction failed. Please try again.');
              },
            });
        } else {
          // Images: skip AI extraction, go straight to step 2
          this.extracting.set(false);
          this.form.setValue({ title: '', description: null, property_id: null });
          this.step.set(2);
        }
      },
      error: (err: Error) => {
        this.extracting.set(false);
        this.stepError.set(err.message ?? 'Upload failed. Please try again.');
      },
    });
  }

  onBack(): void {
    this.step.set(1);
    this.stepError.set(null);
    this.draftPaths.forEach((p) => this.storageService.deleteStorageObject(p).subscribe());
    this.draftPaths = [];
  }

  onCancel(): void {
    this.draftPaths.forEach((p) => this.storageService.deleteStorageObject(p).subscribe());
    this.draftPaths = [];
    this.cancelled.emit();
  }

  onSave(): void {
    if (this.form.invalid || !this.draftPaths.length) return;

    this.saving.set(true);
    this.stepError.set(null);

    const drafts = this.draftPaths;
    const files = this.selectedFiles();
    const payload = {
      title: this.form.controls.title.value,
      description: this.form.controls.description.value,
      property_id: this.form.controls.property_id.value,
      storage_path: drafts[0], // temporary; overwritten after finalize
    };

    this.documentService
      .create(payload)
      .pipe(
        switchMap((doc) =>
          forkJoin(
            drafts.map((draft, i) =>
              this.storageService.finalizeUpload(draft, doc.id, files[i].name),
            ),
          ).pipe(
            switchMap((permanentPaths) =>
              this.documentService.finalizeDocumentPath(doc.id, permanentPaths[0]).pipe(
                switchMap(() => this.documentService.addFiles(doc.id, permanentPaths, files)),
                map(() => ({ ...doc, storage_path: permanentPaths[0] })),
              ),
            ),
          ),
        ),
      )
      .subscribe({
        next: (doc) => {
          this.draftPaths = [];
          this.saving.set(false);
          this.saved.emit(doc);
        },
        error: (err: Error) => {
          this.saving.set(false);
          this.stepError.set(err.message ?? 'Failed to save document.');
        },
      });
  }
}
