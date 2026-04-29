import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { PwaInstallService } from '../../../core/services/pwa-install.service';

@Component({
  selector: 'app-pwa-install-banner',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class.visible]': 'canPrompt()',
    role: 'banner',
    'aria-label': 'Install app banner',
  },
  template: `
    @if (canPrompt()) {
      <div class="banner">
        <div class="banner__content">
          <img src="icons/icon-96x96.png" alt="Dahl Heritage Homes icon" class="banner__icon" />
          <div class="banner__text">
            <strong class="banner__title">Install Dahl Heritage Homes</strong>
            <span class="banner__subtitle">Add to your desktop for quick access</span>
          </div>
        </div>
        <div class="banner__actions">
          <button class="banner__btn banner__btn--install" (click)="install()">Install</button>
          <button class="banner__btn banner__btn--dismiss" (click)="dismiss()" aria-label="Dismiss">
            &times;
          </button>
        </div>
      </div>
    }
  `,
  styles: `
    :host {
      display: none;
    }

    :host.visible {
      display: block;
      position: fixed;
      bottom: 1.5rem;
      left: 50%;
      transform: translateX(-50%);
      z-index: 9999;
      width: min(calc(100vw - 2rem), 480px);
      animation: slide-up 0.25s ease-out;
    }

    @keyframes slide-up {
      from {
        opacity: 0;
        transform: translateX(-50%) translateY(1rem);
      }
      to {
        opacity: 1;
        transform: translateX(-50%) translateY(0);
      }
    }

    .banner {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
      background: #fff;
      border: 1px solid #e2e8f0;
      border-radius: 0.75rem;
      padding: 0.875rem 1rem;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
    }

    .banner__content {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      min-width: 0;
    }

    .banner__icon {
      width: 2.5rem;
      height: 2.5rem;
      border-radius: 0.5rem;
      flex-shrink: 0;
    }

    .banner__text {
      display: flex;
      flex-direction: column;
      gap: 0.125rem;
      min-width: 0;
    }

    .banner__title {
      font-size: 0.875rem;
      font-weight: 600;
      color: #1a202c;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .banner__subtitle {
      font-size: 0.75rem;
      color: #718096;
    }

    .banner__actions {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      flex-shrink: 0;
    }

    .banner__btn {
      border: none;
      border-radius: 0.5rem;
      font-size: 0.875rem;
      font-weight: 500;
      cursor: pointer;
      line-height: 1;
      padding: 0.5rem 1rem;
      transition: background 0.15s;
    }

    .banner__btn--install {
      background: #2d6a4f;
      color: #fff;
    }

    .banner__btn--install:hover {
      background: #1b4332;
    }

    .banner__btn--dismiss {
      background: transparent;
      color: #718096;
      font-size: 1.25rem;
      padding: 0.25rem 0.5rem;
    }

    .banner__btn--dismiss:hover {
      color: #1a202c;
    }
  `,
})
export class PwaInstallBannerComponent {
  private readonly pwa = inject(PwaInstallService);

  readonly canPrompt = this.pwa.canPrompt;

  install(): void {
    void this.pwa.prompt();
  }

  dismiss(): void {
    this.pwa.dismiss();
  }
}
