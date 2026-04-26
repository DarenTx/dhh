import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { NgIconComponent } from '@ng-icons/core';
import {
  GuaranteedPaymentService,
  GuaranteedPayment,
} from '../../core/services/guaranteed-payment.service';
import { GuaranteedPaymentFormComponent } from './guaranteed-payment-form/guaranteed-payment-form.component';
import { RoleService } from '../../core/role/role.service';

type ViewMode = 'mine' | 'all';

interface GroupedEntry extends GuaranteedPayment {
  creatorEmail?: string;
}

@Component({
  selector: 'app-guaranteed-payments-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgIconComponent, GuaranteedPaymentFormComponent],
  styles: `
    .page-header {
      display: flex; align-items: center; justify-content: space-between;
      flex-wrap: wrap; gap: 0.75rem; padding: 1.5rem 1.5rem 0;
    }
    h1 { margin: 0; font-size: 1.5rem; font-weight: 700; color: #2d3748; }

    .controls { display: flex; align-items: center; gap: 0.75rem; padding: 1rem 1.5rem 0; flex-wrap: wrap; }
    .toggle-group { display: flex; border: 1px solid #e2e8f0; border-radius: 0.5rem; overflow: hidden; }
    .toggle-btn {
      padding: 0.4375rem 1rem; background: #fff; border: none; cursor: pointer;
      font-size: 0.875rem; font-weight: 500; color: #4a5568;
      &.active { background: #ebf4ff; color: #2b6cb0; }
    }

    .nav-row { display: flex; align-items: center; gap: 0.75rem; }
    .nav-btn {
      background: none; border: none; cursor: pointer; color: #4a5568;
      display: flex; align-items: center; padding: 0.25rem;
      &:disabled { opacity: 0.4; cursor: not-allowed; }
    }
    .month-label { font-size: 1rem; font-weight: 600; color: #2d3748; min-width: 8rem; text-align: center; }

    .list { padding: 1rem 1.5rem 4rem; display: flex; flex-direction: column; gap: 0.5rem; }
    .gp-row {
      display: flex; align-items: center; justify-content: space-between;
      padding: 0.875rem 1rem; background: #fff; border: 1px solid #e2e8f0;
      border-radius: 0.5rem; cursor: pointer; transition: background 0.12s;
      &:hover { background: #f7fafc; }
    }
    .gp-left { display: flex; flex-direction: column; gap: 0.125rem; }
    .gp-date { font-size: 0.9375rem; color: #2d3748; font-weight: 500; }
    .gp-desc { font-size: 0.8125rem; color: #718096; }
    .gp-right { display: flex; align-items: center; gap: 0.75rem; }
    .gp-hours { font-size: 0.9375rem; font-weight: 600; color: #2d3748; }
    .status-badge {
      display: inline-flex; align-items: center;
      padding: 0.125rem 0.5rem; border-radius: 9999px;
      font-size: 0.75rem; font-weight: 600;
    }
    .status-pending { background: #fef3c7; color: #92400e; }
    .status-approved { background: #d1fae5; color: #065f46; }
    .status-rejected { background: #fee2e2; color: #991b1b; }

    .monthly-total {
      padding: 0.625rem 0; border-top: 1px solid #e2e8f0; margin-top: 0.25rem;
      font-size: 0.875rem; color: #718096; text-align: right;
    }
    .empty-state { padding: 3rem 1.5rem; text-align: center; color: #a0aec0; }
    .loading { padding: 2rem 1.5rem; color: #718096; }

    .btn-add {
      display: flex; align-items: center; gap: 0.375rem;
      padding: 0.5rem 1rem; background: #2b6cb0; color: #fff; border: none;
      border-radius: 0.375rem; font-size: 0.9375rem; font-weight: 500; cursor: pointer;
    }
    .modal-backdrop {
      position: fixed; inset: 0; background: rgba(0,0,0,0.4); z-index: 100;
      display: flex; align-items: center; justify-content: center; padding: 1rem;
    }
    .modal {
      background: #fff; border-radius: 0.75rem; padding: 1.5rem;
      width: 100%; max-width: 520px; max-height: 90vh; overflow-y: auto;
    }
    .modal h2 { margin: 0 0 1.25rem; font-size: 1.25rem; font-weight: 700; color: #2d3748; }
  `,
  template: `
    <div class="page-header">
      <h1>Guaranteed Payments</h1>
      @if (canManage()) {
        <button class="btn-add" (click)="showForm.set(true)">
          <ng-icon name="heroPlus" size="16" />
          Log entry
        </button>
      }
    </div>

    <div class="controls">
      <div class="toggle-group">
        <button class="toggle-btn" [class.active]="viewMode() === 'mine'" (click)="setMode('mine')">My entries</button>
        <button class="toggle-btn" [class.active]="viewMode() === 'all'" (click)="setMode('all')">All managers</button>
      </div>
      <div class="nav-row">
        <button class="nav-btn" (click)="prevMonth()">
          <ng-icon name="heroChevronLeft" size="16" />
        </button>
        <span class="month-label">{{ monthLabel() }}</span>
        <button class="nav-btn" [disabled]="isCurrentMonth()" (click)="nextMonth()">
          <ng-icon name="heroChevronRight" size="16" />
        </button>
      </div>
    </div>

    @if (loading()) {
      <p class="loading">Loading…</p>
    } @else {
      <div class="list">
        @if (entries().length === 0) {
          <p class="empty-state">No entries for this month.</p>
        } @else {
          @for (entry of entries(); track entry.id) {
            <div class="gp-row" (click)="openDetail(entry.id)">
              <div class="gp-left">
                <span class="gp-date">{{ entry.work_date }}</span>
                <span class="gp-desc">{{ entry.work_description }}</span>
              </div>
              <div class="gp-right">
                <span class="status-badge status-{{ entry.status }}">{{ entry.status }}</span>
                <span class="gp-hours">{{ entry.hours_billed }} hrs</span>
              </div>
            </div>
          }
          <div class="monthly-total">
            Total: <strong>{{ totalHours().toFixed(2) }} hrs</strong>
          </div>
        }
      </div>
    }

    @if (showForm()) {
      <div class="modal-backdrop" (click)="showForm.set(false)">
        <div class="modal" (click)="$event.stopPropagation()">
          <h2>Log GP Entry</h2>
          <app-guaranteed-payment-form (saved)="onSaved()" (cancelled)="showForm.set(false)" />
        </div>
      </div>
    }
  `,
})
export class GuaranteedPaymentsPage implements OnInit {
  private readonly gpService = inject(GuaranteedPaymentService);
  private readonly roles = inject(RoleService);
  private readonly router = inject(Router);
  private readonly title = inject(Title);

  readonly loading = signal(true);
  readonly showForm = signal(false);
  readonly viewMode = signal<ViewMode>('mine');
  private readonly currentDate = signal(new Date());

  private readonly raw = signal<GuaranteedPayment[]>([]);

  readonly monthLabel = computed(() => {
    const d = this.currentDate();
    return d.toLocaleString('default', { month: 'long', year: 'numeric' });
  });

  readonly entries = computed(() => this.raw());

  readonly totalHours = computed(() =>
    this.raw().reduce((sum, e) => sum + Number(e.hours_billed), 0),
  );

  canManage(): boolean {
    return this.roles.isManagerOrAbove();
  }

  isCurrentMonth(): boolean {
    const now = new Date();
    const d = this.currentDate();
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  }

  ngOnInit(): void {
    this.title.setTitle('Guaranteed Payments – DHH');
    this.loadEntries();
  }

  setMode(mode: ViewMode): void {
    this.viewMode.set(mode);
    this.loadEntries();
  }

  prevMonth(): void {
    this.currentDate.update((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1));
    this.loadEntries();
  }

  nextMonth(): void {
    if (this.isCurrentMonth()) return;
    this.currentDate.update((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1));
    this.loadEntries();
  }

  private loadEntries(): void {
    const d = this.currentDate();
    const year = d.getFullYear();
    const month = d.getMonth() + 1;
    this.loading.set(true);
    const obs =
      this.viewMode() === 'all'
        ? this.gpService.getAllPayments(year, month)
        : this.gpService.getMyPayments(year, month);
    obs.subscribe({
      next: (rows) => {
        this.raw.set(rows);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  openDetail(id: string): void {
    this.router.navigate(['/guaranteed-payments', id]);
  }

  onSaved(): void {
    this.showForm.set(false);
    this.loadEntries();
  }
}
