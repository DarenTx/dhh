import {
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
  OnInit,
  output,
  signal,
} from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { NgIconComponent } from '@ng-icons/core';
import {
  DocumentService,
  DocumentWithProperty,
  UpdateDocumentPayload,
} from '../../../core/services/document.service';
import { PropertyService, Property } from '../../../core/services/property.service';

@Component({
  selector: 'app-document-edit-modal',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, NgIconComponent],
  styles: `
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
      justify-content: flex-end;
      gap: 0.75rem;
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
    .btn-save {
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
    .error-msg {
      color: #e53e3e;
      font-size: 0.875rem;
      margin-top: 0.5rem;
    }
  `,
  template: `
    <div class="modal-header">
      <h2>Edit Document</h2>
      <button class="close-btn" type="button" (click)="cancelled.emit()">
        <ng-icon name="heroXMark" size="20" />
      </button>
    </div>

    <form [formGroup]="form" (ngSubmit)="onSave()">
      <div class="form-field">
        <label for="doc-title">Title</label>
        <input id="doc-title" type="text" formControlName="title" placeholder="Document title" />
        @if (form.controls.title.invalid && form.controls.title.touched) {
          <span class="field-error">Title is required.</span>
        }
      </div>

      <div class="form-field">
        <label for="doc-desc">Description</label>
        <textarea
          id="doc-desc"
          formControlName="description"
          placeholder="Brief description of this document"
        ></textarea>
      </div>

      <div class="form-field">
        <label for="doc-property">Property</label>
        <select id="doc-property" formControlName="property_id">
          <option [value]="null">LLC</option>
          @for (prop of properties(); track prop.id) {
            <option [value]="prop.id">{{ prop.address_line1 }}</option>
          }
        </select>
      </div>

      @if (saveError()) {
        <p class="error-msg">{{ saveError() }}</p>
      }

      <div class="form-actions">
        <button class="btn-cancel" type="button" (click)="cancelled.emit()">Cancel</button>
        <button class="btn-save" type="submit" [disabled]="form.invalid || saving()">
          {{ saving() ? 'Saving…' : 'Save' }}
        </button>
      </div>
    </form>
  `,
})
export class DocumentEditModalComponent implements OnInit {
  readonly document = input.required<DocumentWithProperty>();

  readonly saved = output<void>();
  readonly cancelled = output<void>();

  private readonly documentService = inject(DocumentService);
  private readonly propertyService = inject(PropertyService);

  readonly properties = signal<Property[]>([]);
  readonly saving = signal(false);
  readonly saveError = signal<string | null>(null);

  readonly form = new FormGroup({
    title: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    description: new FormControl<string | null>(null),
    property_id: new FormControl<string | null>(null),
  });

  ngOnInit(): void {
    const doc = this.document();
    this.form.setValue({
      title: doc.title,
      description: doc.description ?? null,
      property_id: doc.property_id ?? null,
    });

    this.propertyService.getProperties().subscribe((props) => this.properties.set(props));
  }

  onSave(): void {
    if (this.form.invalid) return;

    this.saving.set(true);
    this.saveError.set(null);

    const patch: UpdateDocumentPayload = {
      title: this.form.controls.title.value,
      description: this.form.controls.description.value,
      property_id: this.form.controls.property_id.value,
    };

    this.documentService.updateMetadata(this.document().id, patch).subscribe({
      next: () => {
        this.saving.set(false);
        this.saved.emit();
      },
      error: (err: Error) => {
        this.saving.set(false);
        this.saveError.set(err.message ?? 'Failed to save changes.');
      },
    });
  }
}
