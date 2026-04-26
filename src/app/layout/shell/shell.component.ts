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

    .main-area {
      flex: 1;
      min-height: 0;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    .top-bar {
      flex-shrink: 0;
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0 1.5rem;
      height: 5rem;
      background: #fdf8f2;
      border-bottom: 3px solid #8a9a6e;
      font-family: 'Playfair Display', Georgia, 'Times New Roman', serif;
      font-size: 1.375rem;
      font-weight: 600;
      color: #2c3d2e;
      letter-spacing: 0.01em;
    }

    .top-bar-text {
      display: flex;
      flex-direction: column;
      gap: 0.1rem;
    }

    .top-bar-tagline {
      font-size: 0.9375rem;
      font-weight: 400;
      color: #6b7c6e;
      letter-spacing: 0.04em;
      font-style: italic;
    }

    .top-bar-logo {
      height: 2.5rem;
      width: 2.5rem;
      object-fit: contain;
    }

    @media (min-width: 768px) {
      .top-bar {
        display: none;
      }
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
    <div class="main-area">
      <div class="top-bar">
        <img class="top-bar-logo" src="/dahl-heritage-homes.png" alt="Dahl Heritage Homes logo" />
        <div class="top-bar-text">
          <span>Dahl Heritage Homes</span>
          <span class="top-bar-tagline">Preserving Heritage and Creating Homes.</span>
        </div>
      </div>
      <main class="content">
        <router-outlet />
      </main>
    </div>
    <app-bottom-nav class="bottom-nav" />
  `,
})
export class ShellComponent {}
