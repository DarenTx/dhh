import { inject } from '@angular/core';
import { Router, UrlTree } from '@angular/router';
import { map, Observable } from 'rxjs';
import { first } from 'rxjs/operators';
import { AuthenticationService } from '../auth/authentication.service';
import { UserRole } from './role.service';

function extractRole(session: unknown): UserRole {
  if (!session) return null;
  const token = (session as any)?.access_token;
  if (!token) return null;
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return (payload?.app_metadata?.['role'] as UserRole) ?? null;
  } catch {
    return null;
  }
}

export function managerGuard(): Observable<boolean | UrlTree> {
  const auth = inject(AuthenticationService);
  const router = inject(Router);

  return auth.getSession().pipe(
    first(),
    map((session) => {
      if (!session) return router.createUrlTree(['/login']);
      const role = extractRole(session);
      if (role === 'admin' || role === 'manager') return true;
      return router.createUrlTree(['/']);
    }),
  );
}

export function adminGuard(): Observable<boolean | UrlTree> {
  const auth = inject(AuthenticationService);
  const router = inject(Router);

  return auth.getSession().pipe(
    first(),
    map((session) => {
      if (!session) return router.createUrlTree(['/login']);
      const role = extractRole(session);
      if (role === 'admin') return true;
      return router.createUrlTree(['/']);
    }),
  );
}
