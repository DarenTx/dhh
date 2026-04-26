import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { NgIconComponent } from '@ng-icons/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { RoleService } from '../../core/role/role.service';
import { NAV_ITEMS, NavItem } from '../nav-config';
import { ApprovalService } from '../../core/services/approval.service';
import { AuthenticationService } from '../../core/auth/authentication.service';

@Component({
  selector: 'app-sidebar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, RouterLinkActive, NgIconComponent],
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      height: 100%;
      background: #fff;
      border-right: 1px solid #e2e8f0;
      padding: 1.5rem 0;
    }

    .nav-brand {
      padding: 0 1rem 1.25rem;
      border-bottom: 1px solid #e2e8f0;
      margin-bottom: 0.75rem;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.625rem;
    }

    .nav-brand img {
      width: 200px;
      height: 200px;
      object-fit: contain;
    }

    nav {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 0.125rem;
      padding: 0 0.75rem;
    }

    .nav-link {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.625rem 0.75rem;
      border-radius: 0.5rem;
      color: #4a5568;
      text-decoration: none;
      font-size: 0.9375rem;
      font-weight: 500;
      transition:
        background 0.15s,
        color 0.15s;

      &:hover {
        background: #f7fafc;
        color: #2d3748;
      }
    }

    .nav-link.active {
      background: #ebf4ff;
      color: #2b6cb0;
    }

    .badge {
      margin-left: auto;
      min-width: 1.25rem;
      height: 1.25rem;
      padding: 0 0.3125rem;
      background: #e53e3e;
      color: #fff;
      border-radius: 9999px;
      font-size: 0.6875rem;
      font-weight: 700;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .nav-footer {
      padding: 0.75rem;
      border-top: 1px solid #e2e8f0;
      margin-top: 0.75rem;
    }

    .sign-out-btn {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.625rem 0.75rem;
      border-radius: 0.5rem;
      color: #4a5568;
      font-size: 0.9375rem;
      font-weight: 500;
      background: none;
      border: none;
      cursor: pointer;
      width: 100%;
      transition:
        background 0.15s,
        color 0.15s;

      &:hover {
        background: #fff5f5;
        color: #c53030;
      }
    }
  `,
  template: `
    <div class="nav-brand">
      <img src="/dahl-heritage-homes.png" alt="Dahl Heritage Homes logo" />
    </div>
    <nav>
      @for (item of visibleItems(); track item.path) {
        <a
          class="nav-link"
          [routerLink]="item.path"
          routerLinkActive="active"
          [routerLinkActiveOptions]="{ exact: item.path === '/dashboard' }"
        >
          <ng-icon [name]="item.icon" size="20" />
          <span>{{ item.label }}</span>
          @if (item.path === '/approvals' && pendingCount() > 0) {
            <span class="badge">{{ pendingCount() }}</span>
          }
        </a>
      }
    </nav>
    <div class="nav-footer">
      <button class="sign-out-btn" (click)="signOut()">
        <ng-icon name="heroArrowRightOnRectangle" size="20" />
        <span>Sign Out</span>
      </button>
    </div>
  `,
})
export class SidebarComponent {
  private readonly roles = inject(RoleService);
  private readonly approvalService = inject(ApprovalService);
  private readonly auth = inject(AuthenticationService);

  readonly pendingCount = toSignal(
    this.approvalService.getPendingCountForMe().pipe(catchError(() => of(0))),
    { initialValue: 0 },
  );

  visibleItems() {
    return NAV_ITEMS.filter((item: NavItem) => this.isVisible(item));
  }

  signOut(): void {
    this.auth.signOut();
  }

  private isVisible(item: NavItem): boolean {
    if (item.minRole === 'all') return true;
    if (item.minRole === 'manager') return this.roles.isManagerOrAbove();
    if (item.minRole === 'admin') return this.roles.isAdmin();
    return false;
  }
}
