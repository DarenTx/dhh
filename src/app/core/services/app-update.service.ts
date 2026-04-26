import { ApplicationRef, inject, Injectable } from '@angular/core';
import { SwUpdate, VersionReadyEvent } from '@angular/service-worker';
import { concat, interval } from 'rxjs';
import { filter, first } from 'rxjs/operators';

@Injectable({ providedIn: 'root' })
export class AppUpdateService {
  private readonly appRef = inject(ApplicationRef);
  private readonly updates = inject(SwUpdate);

  constructor() {
    if (!this.updates.isEnabled) {
      return;
    }

    this.updates.versionUpdates
      .pipe(filter((event): event is VersionReadyEvent => event.type === 'VERSION_READY'))
      .subscribe(() => {
        document.location.reload();
      });

    const appIsStable$ = this.appRef.isStable.pipe(first((isStable) => isStable === true));
    const everyHour$ = interval(60 * 60 * 1000);

    concat(appIsStable$, everyHour$).subscribe(async () => {
      try {
        await this.updates.checkForUpdate();
      } catch (error) {
        console.error('Failed to check for app updates.', error);
      }
    });
  }
}
