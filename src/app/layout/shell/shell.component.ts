import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { BottomNavComponent } from '../bottom-nav/bottom-nav.component';
import { SidebarComponent } from '../sidebar/sidebar.component';

@Component({
  selector: 'app-shell',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, SidebarComponent, BottomNavComponent],
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      height: 100dvh;
      overflow: hidden;
    }

    .sidebar {
      display: none;
    }

    .content {
      flex: 1;
      min-height: 0;
      overflow-y: auto;
    }

    .bottom-nav {
      flex-shrink: 0;
      height: var(--nav-bottom-height, 4rem);
      z-index: var(--z-nav, 40);
    }

    @media (min-width: 768px) {
      :host {
        flex-direction: row;
      }

      .sidebar {
        display: flex;
        flex-direction: column;
        flex-shrink: 0;
        width: var(--nav-sidebar-width, 16rem);
        overflow-y: auto;
      }

      .bottom-nav {
        display: none;
      }
    }
  `,
  template: `
    <app-sidebar class="sidebar" />
    <main class="content">
      <router-outlet />
    </main>
    <app-bottom-nav class="bottom-nav" />
  `,
})
export class ShellComponent {}
