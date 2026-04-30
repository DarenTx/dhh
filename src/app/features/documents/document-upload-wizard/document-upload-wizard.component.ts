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
import { switchMap, map } from 'rxjs';

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
    .file-selected {
      margin-top: 0.75rem;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      font-size: 0.875rem;
      color: #2d3748;
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
          <span>Analyzing document with AI…</span>
        </div>
      } @else {
        <label
          class="drop-zone"
          [class.dragover]="dragover()"
          (dragover)="onDragOver($event)"
          (dragleave)="dragover.set(false)"
          (drop)="onDrop($event)"
        >
          <input type="file" accept="application/pdf" (change)="onFileChange($event)" />
          <div class="drop-icon">
            <ng-icon name="heroDocumentArrowUp" size="32" />
          </div>
          <p class="drop-label">Drop a PDF here or click to browse</p>
          <p class="drop-hint">PDF only · max 20 MB</p>
          @if (selectedFile()) {
            <div class="file-selected">
              <ng-icon name="heroDocumentText" size="16" />
              {{ selectedFile()!.name }}
            </div>
          }
        </label>

        @if (stepError()) {
          <p class="error-msg">{{ stepError() }}</p>
        }

        <div class="form-actions">
          <button class="btn-cancel" type="button" (click)="onCancel()">Cancel</button>
          <button class="btn-primary" type="button" [disabled]="!selectedFile()" (click)="onNext()">
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
  readonly selectedFile = signal<File | null>(null);
  readonly dragover = signal(false);
  readonly extracting = signal(false);
  readonly saving = signal(false);
  readonly stepError = signal<string | null>(null);
  readonly properties = signal<Property[]>([]);

  private draftPath: string | null = null;

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
    this.setFile(input.files?.[0] ?? null);
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.dragover.set(true);
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.dragover.set(false);
    this.setFile(event.dataTransfer?.files[0] ?? null);
  }

  private setFile(file: File | null): void {
    if (!file) return;
    if (file.type !== 'application/pdf') {
      this.stepError.set('Only PDF files are accepted.');
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      this.stepError.set('File must be under 20 MB.');
      return;
    }
    this.selectedFile.set(file);
    this.stepError.set(null);
  }

  onNext(): void {
    const file = this.selectedFile();
    if (!file) return;

    this.extracting.set(true);
    this.stepError.set(null);

    this.storageService
      .uploadDraft(file)
      .pipe(
        switchMap((draftPath) => {
          this.draftPath = draftPath;
          const propertyOptions: DocumentPropertyOption[] = [
            { id: null, address: 'LLC' },
            ...this.properties().map((p) => ({ id: p.id, address: p.address_line1 })),
          ];
          return this.aiService.extractDocument({
            storage_bucket: 'documents',
            storage_path: draftPath,
            properties: propertyOptions,
          });
        }),
      )
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
  }

  onBack(): void {
    this.step.set(1);
    this.stepError.set(null);
    if (this.draftPath) {
      this.storageService.deleteStorageObject(this.draftPath).subscribe();
      this.draftPath = null;
    }
  }

  onCancel(): void {
    if (this.draftPath) {
      this.storageService.deleteStorageObject(this.draftPath).subscribe();
      this.draftPath = null;
    }
    this.cancelled.emit();
  }

  onSave(): void {
    if (this.form.invalid || !this.draftPath) return;

    this.saving.set(true);
    this.stepError.set(null);

    const draft = this.draftPath;
    const payload = {
      title: this.form.controls.title.value,
      description: this.form.controls.description.value,
      property_id: this.form.controls.property_id.value,
      storage_path: draft,
    };

    this.documentService
      .create(payload)
      .pipe(
        switchMap((doc) =>
          this.storageService
            .finalizeUpload(draft, doc.id)
            .pipe(
              switchMap((permanentPath) =>
                this.documentService
                  .finalizeDocumentPath(doc.id, permanentPath)
                  .pipe(map(() => ({ ...doc, storage_path: permanentPath }))),
              ),
            ),
        ),
      )
      .subscribe({
        next: (doc) => {
          this.draftPath = null;
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
