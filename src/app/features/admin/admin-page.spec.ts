import { TestBed } from '@angular/core/testing';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { provideRouter } from '@angular/router';
import { provideLocationMocks } from '@angular/common/testing';
import { of } from 'rxjs';
import { AdminPage } from './admin-page';
import { AdminService, UserRecord, UserRole } from '../../core/services/admin.service';
import { AuthenticationService } from '../../core/auth/authentication.service';
import { SUPABASE_CLIENT } from '../../core/auth/supabase.provider';

const mockUser: UserRecord = {
  user_id: 'user-1',
  email: 'user@dahlheritagehomes.com',
  role: 'view_only',
  is_active: true,
  created_at: '2024-01-01T00:00:00Z',
};

function makeAdminService(users: UserRecord[] = [mockUser]) {
  return {
    getUsers: vi.fn().mockReturnValue(of(users)),
    inviteUser: vi.fn().mockReturnValue(of(undefined)),
    deactivateUser: vi.fn().mockReturnValue(of(undefined)),
    reactivateUser: vi.fn().mockReturnValue(of(undefined)),
  };
}

async function createFixture(users: UserRecord[] = [mockUser], sessionUserId = 'current-user') {
  const adminService = makeAdminService(users);
  const mockAuth = {
    getSession: vi.fn().mockReturnValue(of({ user: { id: sessionUserId } })),
  };

  await TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      provideLocationMocks(),
      { provide: AdminService, useValue: adminService },
      { provide: AuthenticationService, useValue: mockAuth },
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

  const fixture = TestBed.createComponent(AdminPage);
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  return { fixture, component: fixture.componentInstance, adminService };
}

describe('AdminPage', () => {
  it('creates without error', async () => {
    const { component } = await createFixture();
    expect(component).toBeTruthy();
  });

  it('loads users on init', async () => {
    const { component, adminService } = await createFixture();
    expect(adminService.getUsers).toHaveBeenCalled();
    expect(component.users()).toHaveLength(1);
    expect(component.users()[0].email).toBe('user@dahlheritagehomes.com');
  });

  it('sets currentUserId from the active session', async () => {
    const { component } = await createFixture([mockUser], 'my-uid');
    expect(component.currentUserId()).toBe('my-uid');
  });

  it('marks form touched and skips submit when invite form is invalid', async () => {
    const { component, adminService } = await createFixture();
    component.inviteForm.setValue({ email: '', role: 'view_only' as UserRole });
    component.invite();
    expect(adminService.inviteUser).not.toHaveBeenCalled();
    expect(component.inviteForm.touched).toBe(true);
  });

  it('calls inviteUser and reloads users on valid invite', async () => {
    const { component, adminService } = await createFixture();
    component.inviteForm.setValue({
      email: 'new@dahlheritagehomes.com',
      role: 'manager' as UserRole,
    });
    component.invite();
    expect(adminService.inviteUser).toHaveBeenCalledWith('new@dahlheritagehomes.com', 'manager');
  });

  it('calls deactivateUser and reloads users', async () => {
    const { component, adminService } = await createFixture();
    component.deactivate(mockUser);
    expect(adminService.deactivateUser).toHaveBeenCalledWith('user-1');
    expect(adminService.getUsers).toHaveBeenCalledTimes(2); // once on init, once after deactivate
  });

  it('calls reactivateUser and reloads users', async () => {
    const inactiveUser = { ...mockUser, is_active: false };
    const { component, adminService } = await createFixture([inactiveUser]);
    component.reactivate(inactiveUser);
    expect(adminService.reactivateUser).toHaveBeenCalledWith('user-1');
    expect(adminService.getUsers).toHaveBeenCalledTimes(2);
  });
});
