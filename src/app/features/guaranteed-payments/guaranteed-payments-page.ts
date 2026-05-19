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
import { from } from 'rxjs';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_CLIENT } from '../../core/auth/supabase.provider';
import {
  GuaranteedPaymentService,
  GuaranteedPayment,
} from '../../core/services/guaranteed-payment.service';
import { GuaranteedPaymentFormComponent } from './guaranteed-payment-form/guaranteed-payment-form.component';
import { RoleService } from '../../core/role/role.service';

interface MonthGroup {
  year: number;
  month: number;
  label: string;
  entries: GuaranteedPayment[];
  totalHours: number;
  open: boolean;
}

@Component({
  selector: 'app-guaranteed-payments-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgIconComponent, GuaranteedPaymentFormComponent],
  styles: `
    .page-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 0.75rem;
      padding: 1.5rem 1.5rem 0;
    }
    h1 {
      margin: 0;
      font-size: 1.5rem;
      font-weight: 700;
      color: #2d3748;
    }

    .accordion {
      padding: 1rem 1.5rem 4rem;
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }
    .month-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: #f7fafc;
      border: 1px solid #e2e8f0;
      border-radius: 0.625rem;
      padding: 0.875rem 1rem;
      cursor: pointer;
      user-select: none;
    }
    .month-header.open {
      border-bottom-left-radius: 0;
      border-bottom-right-radius: 0;
      border-bottom-color: #edf2f7;
    }
    .month-info {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }
    .month-name {
      font-weight: 600;
      color: #2d3748;
      font-size: 0.9375rem;
    }
    .month-count {
      font-size: 0.8125rem;
      color: #718096;
    }
    .month-total {
      font-weight: 600;
      color: #2d3748;
      font-size: 0.9375rem;
    }

    .gp-list {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      padding-top: 0.75rem;
    }
    .gp-row {
      background: #fff;
      border: 1px solid #e2e8f0;
      border-radius: 0.5rem;
      padding: 1rem;
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      cursor: pointer;
      transition:
        border-color 0.12s,
        box-shadow 0.12s;
      gap: 1rem;
      &:hover {
        border-color: #bee3f8;
        box-shadow: 0 1px 4px rgb(0 0 0 / 0.06);
      }
    }
    .gp-left {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }
    .gp-date {
      font-size: 0.8125rem;
      color: #718096;
    }
    .gp-desc {
      font-size: 1rem;
      color: #2d3748;
      font-weight: 600;
    }
    .gp-sub {
      font-size: 0.875rem;
      color: #718096;
    }
    .gp-right {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      flex-shrink: 0;
    }
    .gp-hours {
      font-size: 0.9375rem;
      font-weight: 600;
      color: #2d3748;
    }
    .status-badge {
      display: inline-flex;
      align-items: center;
      padding: 0.125rem 0.5rem;
      border-radius: 9999px;
      font-size: 0.75rem;
      font-weight: 600;
    }
    .status-pending {
      background: #fef3c7;
      color: #92400e;
    }
    .status-approved {
      background: #d1fae5;
      color: #065f46;
    }
    .status-rejected {
      background: #fee2e2;
      color: #991b1b;
    }

    .empty-state {
      padding: 3rem 1.5rem;
      text-align: center;
      color: #a0aec0;
    }
    .loading {
      padding: 2rem 1.5rem;
      color: #718096;
    }

    .btn-add {
      display: flex;
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
      max-width: 520px;
      max-height: 90vh;
      overflow-y: auto;
    }
    .modal h2 {
      margin: 0 0 1.25rem;
      font-size: 1.25rem;
      font-weight: 700;
      color: #2d3748;
    }
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

    @if (loading()) {
      <p class="loading">Loading…</p>
    } @else {
      <div class="accordion">
        @if (months().length === 0) {
          <p class="empty-state">No guaranteed payment entries yet.</p>
        }
        @for (grp of months(); track grp.label) {
          <div>
            <div class="month-header" [class.open]="grp.open" (click)="toggleMonth(grp)">
              <div class="month-info">
                <ng-icon
                  name="heroChevronRight"
                  size="16"
                  [style.transform]="grp.open ? 'rotate(90deg)' : ''"
                  style="transition: transform 0.15s"
                />
                <span class="month-name">{{ grp.label }}</span>
                <span class="month-count">
                  {{ grp.entries.length }} entr{{ grp.entries.length === 1 ? 'y' : 'ies' }}
                </span>
              </div>
              <span class="month-total">{{ grp.totalHours.toFixed(2) }} hrs</span>
            </div>
            @if (grp.open) {
              <div class="gp-list">
                @for (entry of grp.entries; track entry.id) {
                  <div class="gp-row" (click)="openDetail(entry.id)">
                    <div class="gp-left">
                      <span class="gp-date">{{ entry.work_date }}</span>
                      <span class="gp-desc">{{ entry.work_description }}</span>
                      @if (entry.created_by && users().get(entry.created_by)) {
                        <span class="gp-sub">{{ users().get(entry.created_by) }}</span>
                      }
                    </div>
                    <div class="gp-right">
                      <span class="status-badge status-{{ entry.status }}">
                        {{ entry.status }}
                      </span>
                      <span class="gp-hours">{{ entry.hours_billed }} hrs</span>
                    </div>
                  </div>
                }
              </div>
            }
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
  private readonly supabase = inject<SupabaseClient>(SUPABASE_CLIENT);
  private readonly roles = inject(RoleService);
  private readonly router = inject(Router);
  private readonly title = inject(Title);

  readonly loading = signal(true);
  readonly showForm = signal(false);
  private readonly raw = signal<GuaranteedPayment[]>([]);
  private readonly openMonths = signal<Set<string>>(new Set<string>());
  readonly users = signal<Map<string, string>>(new Map());

  readonly months = computed<MonthGroup[]>(() => {
    const entries = this.raw();
    const open = this.openMonths();
    const map = new Map<string, MonthGroup>();
    for (const e of entries) {
      const d = new Date(e.work_date + 'T00:00:00');
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (!map.has(key)) {
        map.set(key, {
          year: d.getFullYear(),
          month: d.getMonth() + 1,
          label: d.toLocaleString('default', { month: 'long', year: 'numeric' }),
          entries: [],
          totalHours: 0,
          open: open.has(key),
        });
      }
      const grp = map.get(key)!;
      grp.entries.push(e);
      grp.totalHours += Number(e.hours_billed);
    }
    return Array.from(map.values()).sort(
      (a, b) => b.year * 100 + b.month - (a.year * 100 + a.month),
    );
  });

  canManage(): boolean {
    return this.roles.isManagerOrAbove();
  }

  ngOnInit(): void {
    this.title.setTitle('Guaranteed Payments – DHH');
    this.loadUsers();
    this.loadEntries();
  }

  private loadEntries(): void {
    this.loading.set(true);
    this.gpService.getAllPaymentsHistory().subscribe({
      next: (rows) => {
        this.raw.set(rows);
        if (rows.length > 0 && this.openMonths().size === 0) {
          const d = new Date(rows[0].work_date + 'T00:00:00');
          const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
          this.openMonths.set(new Set([key]));
        }
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  private loadUsers(): void {
    from(
      this.supabase
        .from('user_roles')
        .select('user_id, first_name, last_name, email')
        .then(({ data }) => {
          const map = new Map<string, string>();
          for (const u of data ?? []) {
            const name = [u.first_name, u.last_name].filter(Boolean).join(' ');
            map.set(u.user_id, name || u.email);
          }
          return map;
        }),
    ).subscribe((m) => this.users.set(m));
  }

  toggleMonth(grp: MonthGroup): void {
    const key = `${grp.year}-${String(grp.month).padStart(2, '0')}`;
    this.openMonths.update((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  openDetail(id: string): void {
    this.router.navigate(['/guaranteed-payments', id]);
  }

  onSaved(): void {
    this.showForm.set(false);
    this.loading.set(true);
    this.raw.set([]);
    this.openMonths.set(new Set());
    this.loadEntries();
  }
}
