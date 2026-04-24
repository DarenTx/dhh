import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { provideRouter } from '@angular/router';
import { AuthenticationService } from './authentication.service';
import { SUPABASE_CLIENT } from './supabase.provider';

function makeSupabaseMock() {
  let authStateCallback: ((event: string, session: unknown) => void) | null = null;

  const mock = {
    auth: {
      onAuthStateChange: vi.fn((cb: (event: string, session: unknown) => void) => {
        authStateCallback = cb;
        return { data: { subscription: { unsubscribe: vi.fn() } } };
      }),
      signInWithOAuth: vi.fn().mockResolvedValue({ error: null }),
      signInWithOtp: vi.fn().mockResolvedValue({ error: null }),
      exchangeCodeForSession: vi.fn().mockResolvedValue({ error: null }),
      signOut: vi.fn().mockResolvedValue({ error: null }),
    },
    _triggerAuthChange: (event: string, session: unknown) => {
      authStateCallback?.(event, session);
    },
  };
  return mock;
}

describe('AuthenticationService', () => {
  let service: AuthenticationService;
  let supabaseMock: ReturnType<typeof makeSupabaseMock>;

  beforeEach(() => {
    supabaseMock = makeSupabaseMock();

    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: 'login', component: class {} }]),
        { provide: SUPABASE_CLIENT, useValue: supabaseMock },
      ],
    });

    service = TestBed.inject(AuthenticationService);
  });

  describe('getSession()', () => {
    it('emits the latest session value to new subscribers', async () => {
      const mockSession = { user: { id: '123' } };
      supabaseMock._triggerAuthChange('SIGNED_IN', mockSession);

      let emitted: unknown;
      service.getSession().subscribe((s) => (emitted = s));
      expect(emitted).toBe(mockSession);
    });

    it('emits null after sign-out', async () => {
      supabaseMock._triggerAuthChange('SIGNED_OUT', null);
      let emitted: unknown = 'unset';
      service.getSession().subscribe((s) => (emitted = s));
      expect(emitted).toBeNull();
    });
  });

  describe('signInWithGoogle()', () => {
    it('calls signInWithOAuth with google provider and callback URL', async () => {
      await service.signInWithGoogle();
      expect(supabaseMock.auth.signInWithOAuth).toHaveBeenCalledWith({
        provider: 'google',
        options: expect.objectContaining({
          redirectTo: expect.stringContaining('/login/callback'),
        }),
      });
    });

    it('throws when Supabase returns an error', async () => {
      supabaseMock.auth.signInWithOAuth.mockResolvedValue({ error: new Error('oauth error') });
      await expect(service.signInWithGoogle()).rejects.toThrow('oauth error');
    });
  });

  describe('sendMagicLink()', () => {
    it('calls signInWithOtp with the email and callback URL', async () => {
      await service.sendMagicLink('test@example.com');
      expect(supabaseMock.auth.signInWithOtp).toHaveBeenCalledWith({
        email: 'test@example.com',
        options: expect.objectContaining({
          emailRedirectTo: expect.stringContaining('/login/callback'),
        }),
      });
    });

    it('throws when Supabase returns an error', async () => {
      supabaseMock.auth.signInWithOtp.mockResolvedValue({ error: new Error('otp error') });
      await expect(service.sendMagicLink('a@b.com')).rejects.toThrow('otp error');
    });
  });

  describe('handleAuthCallback()', () => {
    it('calls exchangeCodeForSession with the code from the URL', async () => {
      Object.defineProperty(window, 'location', {
        value: { search: '?code=abc123' },
        writable: true,
      });
      await service.handleAuthCallback();
      expect(supabaseMock.auth.exchangeCodeForSession).toHaveBeenCalledWith('abc123');
    });

    it('throws when no code is present in the URL', async () => {
      Object.defineProperty(window, 'location', {
        value: { search: '' },
        writable: true,
      });
      await expect(service.handleAuthCallback()).rejects.toThrow('No authorization code');
    });

    it('throws when Supabase returns an error', async () => {
      Object.defineProperty(window, 'location', {
        value: { search: '?code=xyz' },
        writable: true,
      });
      supabaseMock.auth.exchangeCodeForSession.mockResolvedValue({
        error: new Error('pkce error'),
      });
      await expect(service.handleAuthCallback()).rejects.toThrow('pkce error');
    });
  });

  describe('signOut()', () => {
    it('calls supabase signOut and navigates to /login', async () => {
      await service.signOut();
      expect(supabaseMock.auth.signOut).toHaveBeenCalled();
    });
  });
});
