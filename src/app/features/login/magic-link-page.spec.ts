import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { provideRouter } from '@angular/router';
import { MagicLinkPage } from './magic-link-page';
import { AuthenticationService } from '../../core/auth/authentication.service';
import { SUPABASE_CLIENT } from '../../core/auth/supabase.provider';

function mockAuth(sendMagicLinkFn = vi.fn().mockResolvedValue(undefined)) {
  return {
    getSession: vi.fn().mockReturnValue({ subscribe: vi.fn() }),
    sendMagicLink: sendMagicLinkFn,
  };
}

async function createFixture(sendMagicLinkFn = vi.fn().mockResolvedValue(undefined)) {
  const auth = mockAuth(sendMagicLinkFn);

  await TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
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

  const fixture = TestBed.createComponent(MagicLinkPage);
  fixture.detectChanges();
  return { fixture, component: fixture.componentInstance, auth };
}

describe('MagicLinkPage', () => {
  it('creates the component', async () => {
    const { component } = await createFixture();
    expect(component).toBeTruthy();
  });

  describe('form validation', () => {
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
      expect(component.emailErrorMessage).toBe('Internal email addresses are not allowed.');
    });

    it('shows internalEmail error for subdomain of internal domain', async () => {
      const { component } = await createFixture();
      component.emailControl.setValue('user@sub.dahlheritagehomes.com');
      component.emailControl.markAsTouched();
      expect(component.emailErrorMessage).toBe('Internal email addresses are not allowed.');
    });

    it('returns null error message for untouched clean field', async () => {
      const { component } = await createFixture();
      expect(component.emailErrorMessage).toBeNull();
    });

    it('does not call sendMagicLink when form is invalid', async () => {
      const sendFn = vi.fn().mockResolvedValue(undefined);
      const { component } = await createFixture(sendFn);
      await component.onSubmit();
      expect(sendFn).not.toHaveBeenCalled();
    });
  });

  describe('successful submission', () => {
    it('calls sendMagicLink with the email value', async () => {
      const sendFn = vi.fn().mockResolvedValue(undefined);
      const { component } = await createFixture(sendFn);
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
  });

  describe('error handling', () => {
    it('shows rate-limit message for over_email_send_rate_limit code', async () => {
      const err = Object.assign(new Error('rate limited'), { code: 'over_email_send_rate_limit' });
      const { component } = await createFixture(vi.fn().mockRejectedValue(err));
      component.emailControl.setValue('user@gmail.com');
      await component.onSubmit();
      expect(component.serverError()).toBe(
        'Too many attempts. Please wait a moment before trying again.',
      );
    });

    it('shows rate-limit message for 429 HTTP status', async () => {
      const err = Object.assign(new Error('too many'), { status: 429 });
      const { component } = await createFixture(vi.fn().mockRejectedValue(err));
      component.emailControl.setValue('user@gmail.com');
      await component.onSubmit();
      expect(component.serverError()).toBe(
        'Too many attempts. Please wait a moment before trying again.',
      );
    });

    it('shows the server error message for generic errors', async () => {
      const err = new Error('Server error');
      const { component } = await createFixture(vi.fn().mockRejectedValue(err));
      component.emailControl.setValue('user@gmail.com');
      await component.onSubmit();
      expect(component.serverError()).toBe('Server error');
    });

    it('re-enables the submit button on error', async () => {
      const { component } = await createFixture(vi.fn().mockRejectedValue(new Error('err')));
      component.emailControl.setValue('user@gmail.com');
      await component.onSubmit();
      expect(component.submitting()).toBe(false);
    });

    it('sets submitting to true while request is in flight', async () => {
      let resolve!: () => void;
      const promise = new Promise<void>((r) => (resolve = r));
      const { component } = await createFixture(vi.fn().mockReturnValue(promise));
      component.emailControl.setValue('user@gmail.com');
      const submitPromise = component.onSubmit();
      expect(component.submitting()).toBe(true);
      resolve();
      await submitPromise;
    });
  });

  describe('accessibility', () => {
    it('sets aria-invalid when field has an error', async () => {
      const { fixture, component } = await createFixture();
      component.emailControl.setValue('bad');
      component.emailControl.markAsTouched();
      fixture.detectChanges();
      const input: HTMLInputElement = fixture.nativeElement.querySelector('#email');
      expect(input.getAttribute('aria-invalid')).toBe('true');
    });

    it('has aria-describedby pointing to error element', async () => {
      const { fixture } = await createFixture();
      const input: HTMLInputElement = fixture.nativeElement.querySelector('#email');
      expect(input.getAttribute('aria-describedby')).toBe('email-error');
    });

    it('has an associated label for the email input', async () => {
      const { fixture } = await createFixture();
      const label: HTMLLabelElement = fixture.nativeElement.querySelector('label[for="email"]');
      expect(label).toBeTruthy();
    });
  });
});
