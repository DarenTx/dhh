import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AppUpdateService } from './core/services/app-update.service';
import { PwaInstallService } from './core/services/pwa-install.service';
import { PwaInstallBannerComponent } from './shared/components/pwa-install-banner/pwa-install-banner.component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, PwaInstallBannerComponent],
  template: `
    <router-outlet />
    <app-pwa-install-banner />
  `,
})
export class App {
  private readonly appUpdateService = inject(AppUpdateService);
  private readonly pwaInstallService = inject(PwaInstallService);

  constructor() {
    void this.appUpdateService;
    void this.pwaInstallService;
  }
}
