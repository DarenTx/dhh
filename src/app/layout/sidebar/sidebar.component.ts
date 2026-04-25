import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { NgIconComponent } from '@ng-icons/core';
import { RoleService } from '../../core/role/role.service';
import { NAV_ITEMS, NavItem } from '../nav-config';

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
      padding: 0 1.25rem 1.5rem;
      font-size: 1.125rem;
      font-weight: 700;
      color: #2d3748;
      border-bottom: 1px solid #e2e8f0;
      margin-bottom: 0.75rem;
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
  `,
  template: `
    <div class="nav-brand">DHH</div>
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
        </a>
      }
    </nav>
  `,
})
export class SidebarComponent {
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
