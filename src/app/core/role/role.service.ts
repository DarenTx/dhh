import { inject, Injectable } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { AuthenticationService } from '../auth/authentication.service';

export type UserRole = 'admin' | 'manager' | 'view_only' | null;

@Injectable({ providedIn: 'root' })
export class RoleService {
  private readonly auth = inject(AuthenticationService);

  private readonly role = toSignal(
    this.auth.getSession().pipe(
      map((session) => {
        if (!session?.access_token) return null as UserRole;
        try {
          const payload = JSON.parse(
            atob(session.access_token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')),
          );
          return (payload?.app_metadata?.['role'] as UserRole) ?? null;
        } catch {
          return null as UserRole;
        }
      }),
    ),
    { initialValue: null as UserRole },
  );

  isAdmin(): boolean {
    return this.role() === 'admin';
  }

  isManagerOrAbove(): boolean {
    const role = this.role();
    return role === 'admin' || role === 'manager';
  }

  canViewFinancials(): boolean {
    return this.isManagerOrAbove();
  }
}
