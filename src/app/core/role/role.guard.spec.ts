import { TestBed } from '@angular/core/testing';
import { describe, it, expect, vi } from 'vitest';
import { provideRouter, Router, UrlTree } from '@angular/router';
import { of } from 'rxjs';
import { managerGuard, adminGuard } from './role.guard';
import { AuthenticationService } from '../auth/authentication.service';
import { UserRole } from './role.service';

function makeJwt(appMetadata: Record<string, unknown>): string {
  const payload = btoa(JSON.stringify({ sub: '123', app_metadata: appMetadata }));
  return `header.${payload}.sig`;
}

function makeSession(role: UserRole | null) {
  if (!role) return null;
  return { access_token: makeJwt({ role }), user: { id: '123' } };
}

function setup(role: UserRole | null) {
  const mockAuth = {
    getSession: vi.fn().mockReturnValue(of(makeSession(role))),
  };

  TestBed.configureTestingModule({
    providers: [provideRouter([]), { provide: AuthenticationService, useValue: mockAuth }],
  });
}

async function runGuard(guardFn: () => ReturnType<typeof managerGuard>) {
  return new Promise<boolean | UrlTree>((resolve) => {
    TestBed.runInInjectionContext(() => guardFn()).subscribe((v) => resolve(v));
  });
}

describe('managerGuard', () => {
  it('returns true for admin', async () => {
    setup('admin');
    expect(await runGuard(managerGuard)).toBe(true);
  });

  it('returns true for manager', async () => {
    setup('manager');
    expect(await runGuard(managerGuard)).toBe(true);
  });

  it('redirects view_only to /', async () => {
    setup('view_only');
    const router = TestBed.inject(Router);
    expect(await runGuard(managerGuard)).toEqual(router.createUrlTree(['/']));
  });

  it('redirects unauthenticated to /login', async () => {
    setup(null);
    const router = TestBed.inject(Router);
    expect(await runGuard(managerGuard)).toEqual(router.createUrlTree(['/login']));
  });
});

describe('adminGuard', () => {
  it('returns true for admin', async () => {
    setup('admin');
    expect(await runGuard(adminGuard)).toBe(true);
  });

  it('redirects manager to /', async () => {
    setup('manager');
    const router = TestBed.inject(Router);
    expect(await runGuard(adminGuard)).toEqual(router.createUrlTree(['/']));
  });

  it('redirects view_only to /', async () => {
    setup('view_only');
    const router = TestBed.inject(Router);
    expect(await runGuard(adminGuard)).toEqual(router.createUrlTree(['/']));
  });

  it('redirects unauthenticated to /login', async () => {
    setup(null);
    const router = TestBed.inject(Router);
    expect(await runGuard(adminGuard)).toEqual(router.createUrlTree(['/login']));
  });
});
