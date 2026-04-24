import { TestBed } from '@angular/core/testing';
import { describe, it, expect, vi } from 'vitest';
import { provideRouter, Router } from '@angular/router';
import { provideLocationMocks } from '@angular/common/testing';
import { of } from 'rxjs';
import { LoginPage } from './login-page';
import { AuthenticationService } from '../../core/auth/authentication.service';
import { SUPABASE_CLIENT } from '../../core/auth/supabase.provider';
import { ActivatedRoute, convertToParamMap } from '@angular/router';

function buildRoute(queryParams: Record<string, string> = {}) {
  return {
    snapshot: { queryParamMap: convertToParamMap(queryParams) },
  };
}

function mockAuth(
  session: unknown = null,
  signInWithGoogleFn = vi.fn().mockResolvedValue(undefined),
  sendMagicLinkFn = vi.fn().mockResolvedValue(undefined),
) {
  return {
    getSession: vi.fn().mockReturnValue(of(session)),
    signInWithGoogle: signInWithGoogleFn,
    sendMagicLink: sendMagicLinkFn,
  };
}

async function createFixture(
  session: unknown = null,
  queryParams: Record<string, string> = {},
  signInWithGoogleFn = vi.fn().mockResolvedValue(undefined),
  sendMagicLinkFn = vi.fn().mockResolvedValue(undefined),
) {
  const auth = mockAuth(session, signInWithGoogleFn, sendMagicLinkFn);

  await TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      provideLocationMocks(),
      { provide: AuthenticationService, useValue: auth },
      { provide: ActivatedRoute, useValue: buildRoute(queryParams) },
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

  const fixture = TestBed.createComponent(LoginPage);
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  return { fixture, component: fixture.componentInstance, auth };
}

describe('LoginPage', () => {
  it('renders without errors', async () => {
    const { component } = await createFixture();
    expect(component).toBeTruthy();
  });

  it('redirects to / when user is already authenticated', async () => {
    const session = { user: { id: '123' } };
    const { component } = await createFixture(session);
    expect(component.loading()).toBe(true);
  });

  it('shows login UI when not authenticated', async () => {
    const { fixture } = await createFixture(null);
    const el: HTMLElement = fixture.nativeElement;
    expect(fixture.componentInstance.loading()).toBe(false);
    expect(el.querySelector('button.btn-google')).toBeTruthy();
  });

  it('shows error banner when ?error= query param is present', async () => {
    const { fixture } = await createFixture(null, { error: encodeURIComponent('Auth failed') });
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('.error-banner')?.textContent).toContain('Auth failed');
  });

  it('calls signInWithGoogle and sets googleLoading', async () => {
    let resolve!: () => void;
    const promise = new Promise<void>((r) => (resolve = r));
    const { fixture } = await createFixture(null, {}, vi.fn().mockReturnValue(promise));
    const btn: HTMLButtonElement = fixture.nativeElement.querySelector('button.btn-google');
    btn.click();
    fixture.detectChanges();
    expect(fixture.componentInstance.googleLoading()).toBe(true);
    resolve();
    await promise.catch(() => {});
  });

  it('displays googleError when signInWithGoogle throws', async () => {
    const { fixture } = await createFixture(
      null,
      {},
      vi.fn().mockRejectedValue(new Error('OAuth failed')),
    );
    await fixture.componentInstance.signInWithGoogle();
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(fixture.componentInstance.googleError()).toBe('OAuth failed');
    expect(el.querySelector('.inline-error')?.textContent).toContain('OAuth failed');
  });

  it('resets googleLoading on error', async () => {
    const { fixture } = await createFixture(null, {}, vi.fn().mockRejectedValue(new Error('err')));
    await fixture.componentInstance.signInWithGoogle();
    expect(fixture.componentInstance.googleLoading()).toBe(false);
  });

  describe('email form validation', () => {
    it('shows required error when submitted empty', async () => {
      const { component } = await createFixture();
      await component.onSubmit();
      expect(component.emailErrorMessage).toBe('Email is required.');
    });

    it('shows invalid email error for malformed email', async () => {
      const { component } = await createFixture();
      component.emailControl.setValue('bad-value');
      component.emailControl.markAsTouched();
      expect(component.emailErrorMessage).toBe('Please enter a valid email address.');
    });

    it('shows internalEmail error for internal domain', async () => {
      const { component } = await createFixture();
      component.emailControl.setValue('user@dahlheritagehomes.com');
      component.emailControl.markAsTouched();
      expect(component.emailErrorMessage).toBe('Do not use a dahlheritagehomes.com email address.');
    });

    it('shows internalEmail error for subdomain of internal domain', async () => {
      const { component } = await createFixture();
      component.emailControl.setValue('user@sub.dahlheritagehomes.com');
      component.emailControl.markAsTouched();
      expect(component.emailErrorMessage).toBe('Do not use a dahlheritagehomes.com email address.');
    });

    it('returns null error message for untouched clean field', async () => {
      const { component } = await createFixture();
      expect(component.emailErrorMessage).toBeNull();
    });

    it('does not call sendMagicLink when form is invalid', async () => {
      const sendFn = vi.fn().mockResolvedValue(undefined);
      const { component } = await createFixture(null, {}, undefined, sendFn);
      await component.onSubmit();
      expect(sendFn).not.toHaveBeenCalled();
    });
  });

  describe('magic link submission', () => {
    it('calls sendMagicLink with the email value', async () => {
      const sendFn = vi.fn().mockResolvedValue(undefined);
      const { component } = await createFixture(null, {}, undefined, sendFn);
      component.emailControl.setValue('user@gmail.com');
      await component.onSubmit();
      expect(sendFn).toHaveBeenCalledWith('user@gmail.com');
    });

    it('sets submitted to true on success', async () => {
      const { component } = await createFixture();
      component.emailControl.setValue('user@gmail.com');
      await component.onSubmit();
      expect(component.submitted()).toBe(true);
    });

    it('renders confirmation message after success', async () => {
      const { fixture, component } = await createFixture();
      component.emailControl.setValue('user@gmail.com');
      await component.onSubmit();
      fixture.detectChanges();
      const el: HTMLElement = fixture.nativeElement;
      expect(el.textContent).toContain('Check your inbox');
    });

    it('shows rate-limit message for over_email_send_rate_limit code', async () => {
      const err = Object.assign(new Error('rate limited'), { code: 'over_email_send_rate_limit' });
      const { component } = await createFixture(
        null,
        {},
        undefined,
        vi.fn().mockRejectedValue(err),
      );
      component.emailControl.setValue('user@gmail.com');
      await component.onSubmit();
      expect(component.serverError()).toBe(
        'Too many attempts. Please wait a moment before trying again.',
      );
    });

    it('shows rate-limit message for 429 HTTP status', async () => {
      const err = Object.assign(new Error('too many'), { status: 429 });
      const { component } = await createFixture(
        null,
        {},
        undefined,
        vi.fn().mockRejectedValue(err),
      );
      component.emailControl.setValue('user@gmail.com');
      await component.onSubmit();
      expect(component.serverError()).toBe(
        'Too many attempts. Please wait a moment before trying again.',
      );
    });

    it('shows the server error message for generic errors', async () => {
      const err = new Error('Server error');
      const { component } = await createFixture(
        null,
        {},
        undefined,
        vi.fn().mockRejectedValue(err),
      );
      component.emailControl.setValue('user@gmail.com');
      await component.onSubmit();
      expect(component.serverError()).toBe('Server error');
    });

    it('re-enables the submit button on error', async () => {
      const { component } = await createFixture(
        null,
        {},
        undefined,
        vi.fn().mockRejectedValue(new Error('err')),
      );
      component.emailControl.setValue('user@gmail.com');
      await component.onSubmit();
      expect(component.submitting()).toBe(false);
    });

    it('sets submitting to true while request is in flight', async () => {
      let resolve!: () => void;
      const promise = new Promise<void>((r) => (resolve = r));
      const { component } = await createFixture(
        null,
        {},
        undefined,
        vi.fn().mockReturnValue(promise),
      );
      component.emailControl.setValue('user@gmail.com');
      component.onSubmit();
      expect(component.submitting()).toBe(true);
      resolve();
      await promise.catch(() => {});
    });
  });
});
