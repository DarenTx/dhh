import { inject } from '@angular/core';
import { Router, UrlTree } from '@angular/router';
import { map, Observable } from 'rxjs';
import { first } from 'rxjs/operators';
import { AuthenticationService } from './authentication.service';

export function authGuard(): Observable<boolean | UrlTree> {
  const auth = inject(AuthenticationService);
  const router = inject(Router);

  return auth.getSession().pipe(
    first(),
    map((session) => (session ? true : router.createUrlTree(['/login']))),
  );
}
