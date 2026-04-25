import {
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
  OnInit,
  output,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { US_STATES } from '../../../shared/constants/us-states';
import {
  CreatePropertyData,
  Property,
  PropertyService,
  UpdatePropertyData,
} from '../../../core/services/property.service';
import { StorageService } from '../../../core/services/storage.service';

const BATHROOM_OPTIONS = ['1', '1.5', '2', '2.5', '3'];

@Component({
  selector: 'app-property-form',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule],
  styles: `
    .form-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1rem;
    }

    @media (max-width: 600px) {
      .form-grid {
        grid-template-columns: 1fr;
      }
    }

    .form-group {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }

    .form-group.full-width {
      grid-column: 1 / -1;
    }

    label {
      font-size: 0.875rem;
      font-weight: 600;
      color: #4a5568;
    }

    input,
    select {
      padding: 0.5rem 0.75rem;
      border: 1px solid #e2e8f0;
      border-radius: 0.375rem;
      font-size: 0.9375rem;
      color: #2d3748;
      font-family: inherit;
      background: #fff;

      &:focus {
        outline: none;
        border-color: #4299e1;
        box-shadow: 0 0 0 2px rgb(66 153 225 / 0.2);
      }
    }

    .error {
      font-size: 0.8125rem;
      color: #e53e3e;
    }

    .photo-row {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .photo-preview {
      width: 100%;
      max-height: 180px;
      object-fit: cover;
      border-radius: 0.375rem;
      border: 1px solid #e2e8f0;
    }

    .actions {
      display: flex;
      justify-content: flex-end;
      gap: 0.75rem;
      margin-top: 1.5rem;
    }

    .btn-cancel {
      padding: 0.5rem 1.25rem;
      background: #fff;
      border: 1px solid #e2e8f0;
      border-radius: 0.375rem;
      font-size: 0.9375rem;
      cursor: pointer;
      color: #4a5568;

      &:hover {
        background: #f7fafc;
      }
    }

    .btn-submit {
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
    <form [formGroup]="form" (ngSubmit)="submit()">
      <div class="form-grid">
        <div class="form-group full-width">
          <label for="addr1">Street address *</label>
          <input id="addr1" formControlName="address_line1" autocomplete="address-line1" />
          @if (form.controls.address_line1.invalid && form.controls.address_line1.touched) {
            <span class="error">Street address is required</span>
          }
        </div>

        <div class="form-group full-width">
          <label for="addr2">Apartment / unit</label>
          <input id="addr2" formControlName="address_line2" autocomplete="address-line2" />
        </div>

        <div class="form-group">
          <label for="city">City</label>
          <input id="city" formControlName="city" autocomplete="address-level2" />
        </div>

        <div class="form-group">
          <label for="state">State</label>
          <select id="state" formControlName="state">
            @for (s of usStates; track s.abbr) {
              <option [value]="s.abbr">{{ s.abbr }} – {{ s.name }}</option>
            }
          </select>
        </div>

        <div class="form-group">
          <label for="zip">ZIP code</label>
          <input id="zip" formControlName="zip" autocomplete="postal-code" />
        </div>

        <div class="form-group">
          <label for="year">Year built</label>
          <input id="year" type="number" formControlName="year_built" min="1800" max="2100" />
        </div>

        <div class="form-group">
          <label for="sqft">Square footage</label>
          <input id="sqft" type="number" formControlName="square_footage" min="1" />
        </div>

        <div class="form-group">
          <label for="beds">Bedrooms</label>
          <input id="beds" type="number" formControlName="bedrooms" min="0" />
        </div>

        <div class="form-group">
          <label for="baths">Bathrooms</label>
          <select id="baths" formControlName="bathrooms">
            <option value="">– select –</option>
            @for (opt of bathroomOptions; track opt) {
              <option [value]="opt">{{ opt }}</option>
            }
          </select>
        </div>

        <div class="form-group full-width photo-row">
          <label for="photo">Cover photo</label>
          <input id="photo" type="file" accept="image/*" (change)="onFileChange($event)" />
          @if (photoPreview()) {
            <img class="photo-preview" [src]="photoPreview()!" alt="Cover photo preview" />
          }
        </div>
      </div>

      @if (serverError()) {
        <p class="error" style="margin-top: 0.75rem">{{ serverError() }}</p>
      }

      <div class="actions">
        <button type="button" class="btn-cancel" (click)="cancelled.emit()">Cancel</button>
        <button type="submit" class="btn-submit" [disabled]="saving()">
          {{ saving() ? 'Saving…' : property() ? 'Save changes' : 'Add property' }}
        </button>
      </div>
    </form>
  `,
})
export class PropertyFormComponent implements OnInit {
  /** Pass an existing property to edit; omit for create mode. */
  readonly property = input<Property | null>(null);
  /** UUID pre-generated by the parent for new properties. */
  readonly newId = input<string | null>(null);

  readonly saved = output<Property>();
  readonly cancelled = output<void>();

  readonly usStates = US_STATES;
  readonly bathroomOptions = BATHROOM_OPTIONS;

  readonly saving = signal(false);
  readonly serverError = signal<string | null>(null);
  readonly photoPreview = signal<string | null>(null);

  private selectedFile: File | null = null;

  private readonly fb = inject(FormBuilder);
  private readonly propertyService = inject(PropertyService);
  private readonly storageService = inject(StorageService);

  readonly form = this.fb.group({
    address_line1: ['', Validators.required],
    address_line2: [''],
    city: [''],
    state: ['OK'],
    zip: [''],
    year_built: [null as number | null],
    square_footage: [null as number | null],
    bedrooms: [null as number | null],
    bathrooms: ['' as string],
    cover_photo_url: [null as string | null],
  });

  ngOnInit(): void {
    const p = this.property();
    if (p) {
      this.form.patchValue({
        address_line1: p.address_line1,
        address_line2: p.address_line2 ?? '',
        city: p.city ?? '',
        state: p.state ?? 'OK',
        zip: p.zip ?? '',
        year_built: p.year_built,
        square_footage: p.square_footage,
        bedrooms: p.bedrooms,
        bathrooms: p.bathrooms != null ? String(p.bathrooms) : '',
        cover_photo_url: p.cover_photo_url,
      });
      if (p.cover_photo_url) {
        // cover_photo_url stores the storage path; preview is handled by parent via signed URL
        this.photoPreview.set(null);
      }
    }
  }

  onFileChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    this.selectedFile = file;
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => this.photoPreview.set(e.target?.result as string);
      reader.readAsDataURL(file);
    } else {
      this.photoPreview.set(null);
    }
  }

  submit(): void {
    if (this.form.invalid || this.saving()) return;
    this.form.markAllAsTouched();
    if (this.form.invalid) return;

    const rawValue = this.form.getRawValue();
    const data: CreatePropertyData = {
      address_line1: rawValue.address_line1!,
      address_line2: rawValue.address_line2 || null,
      city: rawValue.city || null,
      state: rawValue.state || 'OK',
      zip: rawValue.zip || null,
      year_built: rawValue.year_built ?? null,
      square_footage: rawValue.square_footage ?? null,
      bedrooms: rawValue.bedrooms ?? null,
      bathrooms: rawValue.bathrooms ? Number(rawValue.bathrooms) : null,
      cover_photo_url: rawValue.cover_photo_url ?? null,
    };

    this.saving.set(true);
    this.serverError.set(null);

    const existingProperty = this.property();
    if (existingProperty) {
      // Edit mode — optionally upload new photo first
      this.doSave(existingProperty.id, data, true);
    } else {
      const id = this.newId();
      if (!id) {
        this.serverError.set('Internal error: missing property ID.');
        this.saving.set(false);
        return;
      }
      this.doSave(id, data, false);
    }
  }

  private doSave(id: string, data: CreatePropertyData, isEdit: boolean): void {
    const uploadOrSkip$ = this.selectedFile
      ? this.storageService.uploadPropertyCoverPhoto(id, this.selectedFile)
      : null;

    const handleSave = (photoPath: string | null) => {
      const finalData: CreatePropertyData = {
        ...data,
        cover_photo_url: photoPath ?? data.cover_photo_url,
      };

      const save$ = isEdit
        ? this.propertyService.updateProperty(id, finalData as UpdatePropertyData)
        : this.propertyService.createProperty(id, finalData);

      save$.subscribe({
        next: (saved) => {
          this.saving.set(false);
          this.saved.emit(saved);
        },
        error: (err: Error) => {
          this.saving.set(false);
          this.serverError.set(err.message ?? 'An error occurred. Please try again.');
        },
      });
    };

    if (uploadOrSkip$) {
      uploadOrSkip$.subscribe({
        next: (path) => handleSave(path),
        error: (err: Error) => {
          this.saving.set(false);
          this.serverError.set(`Photo upload failed: ${err.message}`);
        },
      });
    } else {
      handleSave(null);
    }
  }
}
