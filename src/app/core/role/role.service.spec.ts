import { TestBed } from '@angular/core/testing';
import { describe, it, expect, vi } from 'vitest';
import { of } from 'rxjs';
import { RoleService, UserRole } from './role.service';
import { AuthenticationService } from '../auth/authentication.service';

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
    providers: [{ provide: AuthenticationService, useValue: mockAuth }],
  });

  return TestBed.inject(RoleService);
}

describe('RoleService', () => {
  describe('isAdmin()', () => {
    it('returns true for admin', () => {
      const service = setup('admin');
      expect(service.isAdmin()).toBe(true);
    });

    it('returns false for manager', () => {
      const service = setup('manager');
      expect(service.isAdmin()).toBe(false);
    });

    it('returns false for view_only', () => {
      const service = setup('view_only');
      expect(service.isAdmin()).toBe(false);
    });

    it('returns false when no session', () => {
      const service = setup(null);
      expect(service.isAdmin()).toBe(false);
    });
  });

  describe('isManagerOrAbove()', () => {
    it('returns true for admin', () => {
      const service = setup('admin');
      expect(service.isManagerOrAbove()).toBe(true);
    });

    it('returns true for manager', () => {
      const service = setup('manager');
      expect(service.isManagerOrAbove()).toBe(true);
    });

    it('returns false for view_only', () => {
      const service = setup('view_only');
      expect(service.isManagerOrAbove()).toBe(false);
    });

    it('returns false when no session', () => {
      const service = setup(null);
      expect(service.isManagerOrAbove()).toBe(false);
    });
  });

  describe('canViewFinancials()', () => {
    it('returns true for admin', () => {
      expect(setup('admin').canViewFinancials()).toBe(true);
    });

    it('returns true for manager', () => {
      expect(setup('manager').canViewFinancials()).toBe(true);
    });

    it('returns false for view_only', () => {
      expect(setup('view_only').canViewFinancials()).toBe(false);
    });

    it('returns false when no session', () => {
      expect(setup(null).canViewFinancials()).toBe(false);
    });
  });
});
