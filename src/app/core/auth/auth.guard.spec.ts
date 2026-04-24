import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { provideRouter, Router, UrlTree } from '@angular/router';
import { of } from 'rxjs';
import { authGuard } from './auth.guard';
import { AuthenticationService } from './authentication.service';
import { SUPABASE_CLIENT } from './supabase.provider';

describe('authGuard', () => {
  const mockSession = { user: { id: '123' } };

  function setup(session: unknown) {
    const mockAuth = { getSession: vi.fn().mockReturnValue(of(session)) };

    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: AuthenticationService, useValue: mockAuth },
        {
          provide: SUPABASE_CLIENT,
          useValue: {
            auth: {
              onAuthStateChange: vi.fn(() => ({
                data: { subscription: { unsubscribe: vi.fn() } },
              })),
            },
          },
        },
      ],
    });
  }

  it('returns true when a session exists', async () => {
    setup(mockSession);
    const result = await TestBed.runInInjectionContext(() => {
      return new Promise<boolean | UrlTree>((resolve) => {
        authGuard().subscribe((v) => resolve(v));
      });
    });
    expect(result).toBe(true);
  });

  it('returns a UrlTree to /login when no session exists', async () => {
    setup(null);
    const result = await TestBed.runInInjectionContext(() => {
      return new Promise<boolean | UrlTree>((resolve) => {
        authGuard().subscribe((v) => resolve(v));
      });
    });
    const router = TestBed.inject(Router);
    expect(result).toEqual(router.createUrlTree(['/login']));
  });
});
