import { ChangeDetectionStrategy, Component, HostListener, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { NgIconComponent } from '@ng-icons/core';
import { RoleService } from '../../core/role/role.service';
import { NAV_ITEMS, NavItem } from '../nav-config';
import { AuthenticationService } from '../../core/auth/authentication.service';

@Component({
  selector: 'app-bottom-nav',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, RouterLinkActive, NgIconComponent],
  styles: `
    :host {
      display: flex;
      align-items: stretch;
      background: #fff;
      border-top: 1px solid #e2e8f0;
      height: 100%;
      position: relative;
    }

    .nav-link {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 0.25rem;
      padding: 0.375rem 0.25rem;
      color: #718096;
      text-decoration: none;
      font-size: 0.6875rem;
      font-weight: 500;
      transition: color 0.15s;
      min-width: 0;
    }

    .nav-link.active,
    .nav-link.more-open {
      color: #2b6cb0;
    }

    .label {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      max-width: 100%;
    }

    .more-btn {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 0.25rem;
      padding: 0.375rem 0.25rem;
      color: #718096;
      font-size: 0.6875rem;
      font-weight: 500;
      background: none;
      border: none;
      cursor: pointer;
      transition: color 0.15s;
      min-width: 0;
    }

    .more-btn.more-open {
      color: #2b6cb0;
    }

    .overflow-panel {
      position: absolute;
      bottom: 100%;
      right: 0;
      min-width: 14rem;
      background: #fff;
      border: 1px solid #e2e8f0;
      border-radius: 0.75rem 0.75rem 0 0;
      box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.12);
      padding: 0.5rem 0;
      z-index: 50;
    }

    .overflow-link {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.75rem 1.25rem;
      color: #4a5568;
      text-decoration: none;
      font-size: 0.9375rem;
      font-weight: 500;
      transition:
        background 0.12s,
        color 0.12s;
    }

    .overflow-link:hover {
      background: #f7fafc;
      color: #2d3748;
    }

    .overflow-link.active {
      background: #ebf4ff;
      color: #2b6cb0;
    }

    .overflow-divider {
      height: 1px;
      background: #e2e8f0;
      margin: 0.25rem 0;
    }

    .overflow-sign-out {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.75rem 1.25rem;
      color: #c53030;
      font-size: 0.9375rem;
      font-weight: 500;
      background: none;
      border: none;
      cursor: pointer;
      width: 100%;
      transition: background 0.12s;

      &:hover {
        background: #fff5f5;
      }
    }

    .icon-wrap {
      position: relative;
      display: inline-flex;
    }

    .badge {
      position: absolute;
      top: -0.3125rem;
      right: -0.4375rem;
      min-width: 1rem;
      height: 1rem;
      padding: 0 0.1875rem;
      background: #e53e3e;
      color: #fff;
      border-radius: 9999px;
      font-size: 0.625rem;
      font-weight: 700;
      display: flex;
      align-items: center;
      justify-content: center;
    }
  `,
  template: `
    @for (item of pinnedItems(); track item.path) {
      <a
        class="nav-link"
        [routerLink]="item.path"
        routerLinkActive="active"
        [routerLinkActiveOptions]="{ exact: item.path === '/dashboard' }"
      >
        <span class="icon-wrap">
          <ng-icon [name]="item.icon" size="20" />
        </span>
        <span class="label">{{ item.label }}</span>
      </a>
    }

    @if (overflowItems().length > 0) {
      <button
        class="more-btn"
        [class.more-open]="menuOpen()"
        (click)="toggleMenu($event)"
        aria-label="More navigation options"
        [attr.aria-expanded]="menuOpen()"
      >
        <ng-icon name="heroEllipsisHorizontal" size="20" />
        <span class="label">More</span>
      </button>

      @if (menuOpen()) {
        <div class="overflow-panel" role="menu">
          @for (item of overflowItems(); track item.path) {
            <a
              class="overflow-link"
              [routerLink]="item.path"
              routerLinkActive="active"
              role="menuitem"
              (click)="menuOpen.set(false)"
            >
              <span class="icon-wrap" style="position:relative;display:inline-flex">
                <ng-icon [name]="item.icon" size="20" />
              </span>
              {{ item.label }}
            </a>
          }
          <div class="overflow-divider"></div>
          <button class="overflow-sign-out" role="menuitem" (click)="signOut()">
            <ng-icon name="heroArrowRightOnRectangle" size="20" />
            Sign Out
          </button>
        </div>
      }
    }
  `,
})
export class BottomNavComponent {
  private readonly roles = inject(RoleService);
  private readonly auth = inject(AuthenticationService);

  readonly menuOpen = signal(false);

  pinnedItems(): NavItem[] {
    return NAV_ITEMS.filter((item) => item.bottomNav && this.isVisible(item));
  }

  overflowItems(): NavItem[] {
    return NAV_ITEMS.filter((item) => !item.bottomNav && this.isVisible(item));
  }

  signOut(): void {
    this.menuOpen.set(false);
    this.auth.signOut();
  }

  toggleMenu(event: Event): void {
    event.stopPropagation();
    this.menuOpen.update((v) => !v);
  }

  @HostListener('document:click')
  closeMenu(): void {
    this.menuOpen.set(false);
  }

  private isVisible(item: NavItem): boolean {
    if (item.minRole === 'all') return true;
    if (item.minRole === 'manager') return this.roles.isManagerOrAbove();
    if (item.minRole === 'admin') return this.roles.isAdmin();
    return false;
  }
}
