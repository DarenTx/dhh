import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { NgIconComponent } from '@ng-icons/core';
import { PropertyWithOccupancy } from '../../../core/services/property.service';

@Component({
  selector: 'app-property-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, NgIconComponent, DecimalPipe],
  styles: `
    .card {
      background: #fff;
      border: 1px solid #e2e8f0;
      border-radius: 0.75rem;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      text-decoration: none;
      color: inherit;
      transition:
        box-shadow 0.15s,
        transform 0.15s;

      &:hover {
        box-shadow: 0 4px 12px rgb(0 0 0 / 0.08);
        transform: translateY(-1px);
      }
    }

    .photo {
      width: 100%;
      aspect-ratio: 16 / 9;
      object-fit: cover;
      background: #f0f4f8;
      display: block;
    }

    .photo-placeholder {
      width: 100%;
      aspect-ratio: 16 / 9;
      background: #f0f4f8;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #cbd5e0;
    }

    .body {
      padding: 1rem;
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 0.375rem;
    }

    .address {
      font-weight: 600;
      font-size: 1rem;
      color: #2d3748;
      margin: 0;
    }

    .city-state {
      font-size: 0.875rem;
      color: #718096;
      margin: 0;
    }

    .badge-row {
      display: flex;
      flex-wrap: wrap;
      gap: 0.375rem;
      margin-top: 0.25rem;
    }

    .badge {
      font-size: 0.75rem;
      font-weight: 600;
      padding: 0.2rem 0.5rem;
      border-radius: 9999px;
    }

    .badge-occupied {
      background: #c6f6d5;
      color: #276749;
    }

    .badge-vacant {
      background: #fed7d7;
      color: #9b2c2c;
    }

    .specs {
      font-size: 0.8125rem;
      color: #718096;
      margin: 0;
    }
  `,
  template: `
    <a class="card" [routerLink]="['/properties', property().id]">
      @if (signedPhotoUrl()) {
        <img class="photo" [src]="signedPhotoUrl()!" [alt]="property().address_line1" />
      } @else {
        <div class="photo-placeholder">
          <ng-icon name="heroBuildingOffice2" size="40" />
        </div>
      }

      <div class="body">
        <p class="address">{{ property().address_line1 }}</p>
        <p class="city-state">{{ property().city }}, {{ property().state }} {{ property().zip }}</p>

        <div class="badge-row">
          @if (property().isOccupied) {
            <span class="badge badge-occupied">Occupied</span>
          } @else {
            <span class="badge badge-vacant">Vacant</span>
          }
        </div>

        @if (property().bedrooms || property().bathrooms || property().square_footage) {
          <p class="specs">
            @if (property().bedrooms) {
              {{ property().bedrooms }} bd
            }
            @if (property().bathrooms) {
              · {{ property().bathrooms }} ba
            }
            @if (property().square_footage) {
              · {{ property().square_footage | number }} sq ft
            }
          </p>
        }
      </div>
    </a>
  `,
})
export class PropertyCardComponent {
  readonly property = input.required<PropertyWithOccupancy>();
  readonly signedPhotoUrl = input<string | null>(null);
}
