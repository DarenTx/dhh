import { TestBed } from '@angular/core/testing';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { provideRouter, Router } from '@angular/router';
import { provideLocationMocks } from '@angular/common/testing';
import { AuthCallbackPage } from './auth-callback-page';
import { AuthenticationService } from '../../core/auth/authentication.service';
import { SUPABASE_CLIENT } from '../../core/auth/supabase.provider';
import { Component } from '@angular/core';

@Component({ template: '' })
class StubComponent {}

function mockAuth(handleFn = vi.fn().mockResolvedValue(undefined)) {
  return { handleAuthCallback: handleFn };
}

async function createFixture(handleFn = vi.fn().mockResolvedValue(undefined)) {
  const auth = mockAuth(handleFn);

  await TestBed.configureTestingModule({
    providers: [
      provideRouter([
        { path: '', component: StubComponent },
        { path: 'dashboard', component: StubComponent },
        { path: 'login', component: StubComponent },
      ]),
      provideLocationMocks(),
      { provide: AuthenticationService, useValue: auth },
      {
        provide: SUPABASE_CLIENT,
        useValue: {
          auth: {
            onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
          },
        },
      },
    ],
  }).compileComponents();

  const fixture = TestBed.createComponent(AuthCallbackPage);
  return { fixture, component: fixture.componentInstance, auth };
}

describe('AuthCallbackPage', () => {
  beforeEach(() => sessionStorage.clear());

  it('creates the component', async () => {
    const { component } = await createFixture();
    expect(component).toBeTruthy();
  });

  it('renders a loading indicator immediately', async () => {
    const { fixture } = await createFixture();
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('.spinner')).toBeTruthy();
  });

  it('navigates to the stored destination on success', async () => {
    sessionStorage.setItem('auth_redirect_destination', '/dashboard');
    const { fixture } = await createFixture();
    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigate');
    fixture.detectChanges();
    await fixture.whenStable();
    expect(navigateSpy).toHaveBeenCalledWith(['/dashboard']);
  });

  it('navigates to / when no destination stored', async () => {
    const { fixture } = await createFixture();
    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigate');
    fixture.detectChanges();
    await fixture.whenStable();
    expect(navigateSpy).toHaveBeenCalledWith(['/']);
  });

  it('redirects to /login?error=... on callback failure', async () => {
    const { fixture } = await createFixture(vi.fn().mockRejectedValue(new Error('PKCE failed')));
    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigate');
    fixture.detectChanges();
    await fixture.whenStable();
    expect(navigateSpy).toHaveBeenCalledWith(
      ['/login'],
      expect.objectContaining({
        queryParams: expect.objectContaining({ error: expect.any(String) }),
      }),
    );
    const callArgs = navigateSpy.mock.calls[0];
    const queryParams = (callArgs[1] as { queryParams: { error: string } }).queryParams;
    expect(decodeURIComponent(queryParams.error)).toContain('PKCE failed');
  });

  it('URL-encodes the error message in the redirect', async () => {
    const { fixture } = await createFixture(vi.fn().mockRejectedValue(new Error('bad & evil=1')));
    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigate');
    fixture.detectChanges();
    await fixture.whenStable();
    const callArgs = navigateSpy.mock.calls[0];
    const queryParams = (callArgs[1] as { queryParams: { error: string } }).queryParams;
    // The stored value should be URL-encoded (no spaces)
    expect(queryParams.error).not.toContain(' ');
  });
});
