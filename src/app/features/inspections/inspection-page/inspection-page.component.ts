import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { InspectionService } from '../../../core/services/inspection.service';
import { RoleService } from '../../../core/role/role.service';
import { Inspection, InspectionRoom } from '../inspection.types';
import { InspectionWizardComponent } from '../inspection-wizard/inspection-wizard.component';
import { InspectionDetailComponent } from '../inspection-detail/inspection-detail.component';

@Component({
  selector: 'app-inspection-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [InspectionWizardComponent, InspectionDetailComponent],
  styles: `
    :host {
      display: block;
    }
    .loading {
      padding: 4rem;
      text-align: center;
      color: #a0aec0;
      font-size: 0.9375rem;
    }
    .error {
      padding: 2rem;
      color: #c53030;
      font-size: 0.9375rem;
    }
  `,
  template: `
    @if (loading()) {
      <p class="loading">Loading inspection…</p>
    } @else if (error()) {
      <p class="error">{{ error() }}</p>
    } @else if (inspection()) {
      @if (showWizard()) {
        <app-inspection-wizard
          [inspection]="inspection()!"
          [rooms]="rooms()"
          [propertyId]="propertyId"
          (ended)="onEnded()"
          (back)="goBack()"
        />
      } @else {
        <app-inspection-detail
          [inspection]="inspection()!"
          [rooms]="rooms()"
          [propertyId]="propertyId"
          [canManage]="canManage()"
          (back)="goBack()"
          (reopened)="onReopened()"
        />
      }
    }
  `,
})
export class InspectionPageComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly inspectionService = inject(InspectionService);
  private readonly roles = inject(RoleService);

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly inspection = signal<Inspection | null>(null);
  readonly rooms = signal<InspectionRoom[]>([]);

  get propertyId(): string {
    return this.route.snapshot.paramMap.get('propertyId')!;
  }

  get inspectionId(): string {
    return this.route.snapshot.paramMap.get('inspectionId')!;
  }

  readonly showWizard = computed(
    () => this.inspection()?.status === 'in_progress' && this.canManage(),
  );

  canManage(): boolean {
    return this.roles.isManagerOrAbove();
  }

  ngOnInit(): void {
    this.load();
  }

  private load(): void {
    this.loading.set(true);
    this.inspectionService.getInspectionWithRooms(this.inspectionId).subscribe({
      next: ({ inspection, rooms }) => {
        this.inspection.set(inspection);
        this.rooms.set(rooms);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err?.message ?? 'Failed to load inspection.');
        this.loading.set(false);
      },
    });
  }

  goBack(): void {
    this.router.navigate(['/properties', this.propertyId], {
      queryParams: { tab: 'inspections' },
    });
  }

  onEnded(): void {
    this.load();
  }

  onReopened(): void {
    this.load();
  }
}
