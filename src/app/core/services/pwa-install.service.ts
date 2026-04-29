import { Injectable, signal } from '@angular/core';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISSED_KEY = 'pwa-install-dismissed-until';
const DISMISS_COOLDOWN_DAYS = 7;

@Injectable({ providedIn: 'root' })
export class PwaInstallService {
  private deferredPrompt: BeforeInstallPromptEvent | null = null;

  readonly canPrompt = signal(false);

  constructor() {
    window.addEventListener('beforeinstallprompt', (e: Event) => {
      e.preventDefault();
      this.deferredPrompt = e as BeforeInstallPromptEvent;
      if (!this.isDismissed()) {
        this.canPrompt.set(true);
      }
    });

    window.addEventListener('appinstalled', () => {
      this.deferredPrompt = null;
      this.canPrompt.set(false);
    });
  }

  async prompt(): Promise<void> {
    if (!this.deferredPrompt) return;

    await this.deferredPrompt.prompt();
    const { outcome } = await this.deferredPrompt.userChoice;

    if (outcome === 'dismissed') {
      this.dismiss();
    }

    this.deferredPrompt = null;
    this.canPrompt.set(false);
  }

  dismiss(): void {
    const until = Date.now() + DISMISS_COOLDOWN_DAYS * 24 * 60 * 60 * 1000;
    localStorage.setItem(DISMISSED_KEY, String(until));
    this.canPrompt.set(false);
  }

  private isDismissed(): boolean {
    const until = localStorage.getItem(DISMISSED_KEY);
    if (!until) return false;
    return Date.now() < Number(until);
  }
}
