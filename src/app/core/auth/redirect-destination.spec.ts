import { describe, it, expect, beforeEach, vi } from 'vitest';
import { storeRedirectDestination, consumeRedirectDestination } from './redirect-destination';

function makeSessionStorageMock() {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
  };
}

describe('redirect-destination', () => {
  let sessionStorageMock: ReturnType<typeof makeSessionStorageMock>;

  beforeEach(() => {
    sessionStorageMock = makeSessionStorageMock();
    vi.stubGlobal('sessionStorage', sessionStorageMock);
  });

  describe('storeRedirectDestination', () => {
    it('stores a valid path', () => {
      storeRedirectDestination('/dashboard');
      expect(sessionStorage.getItem('auth_redirect_destination')).toBe('/dashboard');
    });

    it('defaults to / for empty string', () => {
      storeRedirectDestination('');
      expect(sessionStorage.getItem('auth_redirect_destination')).toBe('/');
    });

    it('defaults to / for paths that do not start with /', () => {
      storeRedirectDestination('dashboard');
      expect(sessionStorage.getItem('auth_redirect_destination')).toBe('/');
    });

    it('defaults to / for /login paths', () => {
      storeRedirectDestination('/login');
      expect(sessionStorage.getItem('auth_redirect_destination')).toBe('/');
    });

    it('defaults to / for /login/magic-link paths', () => {
      storeRedirectDestination('/login/magic-link');
      expect(sessionStorage.getItem('auth_redirect_destination')).toBe('/');
    });

    it('defaults to / for http:// paths (open redirect protection)', () => {
      storeRedirectDestination('http://evil.com');
      expect(sessionStorage.getItem('auth_redirect_destination')).toBe('/');
    });

    it('defaults to / for // paths (open redirect protection)', () => {
      storeRedirectDestination('//evil.com');
      expect(sessionStorage.getItem('auth_redirect_destination')).toBe('/');
    });

    it('defaults to / for paths containing ..', () => {
      storeRedirectDestination('/../../etc/passwd');
      expect(sessionStorage.getItem('auth_redirect_destination')).toBe('/');
    });
  });

  describe('consumeRedirectDestination', () => {
    it('returns stored valid path', () => {
      sessionStorage.setItem('auth_redirect_destination', '/dashboard');
      expect(consumeRedirectDestination()).toBe('/dashboard');
    });

    it('removes the key from sessionStorage after reading', () => {
      sessionStorage.setItem('auth_redirect_destination', '/dashboard');
      consumeRedirectDestination();
      expect(sessionStorage.getItem('auth_redirect_destination')).toBeNull();
    });

    it('returns / when key is absent', () => {
      expect(consumeRedirectDestination()).toBe('/');
    });

    it('returns / and clears key for invalid stored value', () => {
      sessionStorage.setItem('auth_redirect_destination', 'http://evil.com');
      expect(consumeRedirectDestination()).toBe('/');
      expect(sessionStorage.getItem('auth_redirect_destination')).toBeNull();
    });

    it('returns / for stored /login path', () => {
      sessionStorage.setItem('auth_redirect_destination', '/login');
      expect(consumeRedirectDestination()).toBe('/');
    });
  });
});
