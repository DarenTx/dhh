import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { NgIconComponent } from '@ng-icons/core';
import { RoleService } from '../../core/role/role.service';
import { NAV_ITEMS, NavItem } from '../nav-config';

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

    .nav-link.active {
      color: #2b6cb0;
    }

    .label {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      max-width: 100%;
    }
  `,
  template: `
    @for (item of visibleItems(); track item.path) {
      <a
        class="nav-link"
        [routerLink]="item.path"
        routerLinkActive="active"
        [routerLinkActiveOptions]="{ exact: item.path === '/dashboard' }"
      >
        <ng-icon [name]="item.icon" size="20" />
        <span class="label">{{ item.label }}</span>
      </a>
    }
  `,
})
export class BottomNavComponent {
  private readonly roles = inject(RoleService);

  visibleItems() {
    return NAV_ITEMS.filter((item: NavItem) => this.isVisible(item));
  }

  private isVisible(item: NavItem): boolean {
    if (item.minRole === 'all') return true;
    if (item.minRole === 'manager') return this.roles.isManagerOrAbove();
    if (item.minRole === 'admin') return this.roles.isAdmin();
    return false;
  }
}
