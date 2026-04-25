import { inject } from '@angular/core';
import { Router, UrlTree } from '@angular/router';
import { from, map, Observable, of, switchMap } from 'rxjs';
import { first } from 'rxjs/operators';
import { AuthenticationService } from './authentication.service';

export function authGuard(): Observable<boolean | UrlTree> {
  const auth = inject(AuthenticationService);
  const router = inject(Router);

  return auth.getSession().pipe(
    first(),
    switchMap((session) => {
      if (!session) {
        return of(router.createUrlTree(['/login']));
      }
      let isActive = true;
      try {
        const payload = JSON.parse(
          atob(session.access_token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')),
        );
        isActive = payload?.app_metadata?.['is_active'] !== false;
      } catch {
        // default to active if JWT decode fails
      }
      if (!isActive) {
        return from(auth.signOutSilent()).pipe(
          map(() =>
            router.createUrlTree(['/login'], {
              queryParams: { error: 'account_deactivated' },
            }),
          ),
        );
      }
      return of(true as const);
    }),
  );
}
