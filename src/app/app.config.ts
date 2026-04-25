import { ApplicationConfig, provideBrowserGlobalErrorListeners, isDevMode } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideIcons } from '@ng-icons/core';
import {
  heroHome,
  heroBuildingOffice2,
  heroCreditCard,
  heroClock,
  heroCheckCircle,
  heroCog6Tooth,
  heroUserGroup,
  heroUsers,
  heroClipboardDocumentList,
} from '@ng-icons/heroicons/outline';

import { routes } from './app.routes';
import { provideServiceWorker } from '@angular/service-worker';
import { provideSupabase } from './core/auth/supabase.provider';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideSupabase(),
    provideIcons({
      heroHome,
      heroBuildingOffice2,
      heroCreditCard,
      heroClock,
      heroCheckCircle,
      heroCog6Tooth,
      heroUserGroup,
      heroUsers,
      heroClipboardDocumentList,
    }),
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000',
    }),
  ],
};
