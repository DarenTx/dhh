import { TestBed } from '@angular/core/testing';
import { describe, it, expect, vi } from 'vitest';
import { provideRouter } from '@angular/router';
import { provideLocationMocks } from '@angular/common/testing';
import { of } from 'rxjs';
import { provideIcons } from '@ng-icons/core';
import {
  heroHome,
  heroBuildingOffice2,
  heroCreditCard,
  heroClock,
  heroCheckCircle,
  heroCog6Tooth,
  heroUserGroup,
  heroClipboardDocumentList,
} from '@ng-icons/heroicons/outline';
import { ShellComponent } from './shell.component';
import { SidebarComponent } from '../sidebar/sidebar.component';
import { AuthenticationService } from '../../core/auth/authentication.service';
import { SUPABASE_CLIENT } from '../../core/auth/supabase.provider';

function makeJwt(appMetadata: Record<string, unknown>): string {
  const payload = btoa(JSON.stringify({ sub: '123', app_metadata: appMetadata }));
  return `header.${payload}.sig`;
}

function makeSession(role: 'admin' | 'manager' | 'view_only' | null) {
  if (!role) return null;
  return { access_token: makeJwt({ role }), user: { id: '123', app_metadata: { role } } };
}

async function createFixture(role: 'admin' | 'manager' | 'view_only' | null = null) {
  const mockAuth = {
    getSession: vi.fn().mockReturnValue(of(makeSession(role))),
  };

  await TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      provideLocationMocks(),
      { provide: AuthenticationService, useValue: mockAuth },
      {
        provide: SUPABASE_CLIENT,
        useValue: {
          auth: {
            onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
            getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
          },
        },
      },
      provideIcons({
        heroHome,
        heroBuildingOffice2,
        heroCreditCard,
        heroClock,
        heroCheckCircle,
        heroCog6Tooth,
        heroUserGroup,
        heroClipboardDocumentList,
      }),
    ],
  }).compileComponents();

  const fixture = TestBed.createComponent(ShellComponent);
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  return { fixture, component: fixture.componentInstance };
}

describe('ShellComponent', () => {
  it('creates without error', async () => {
    const { component } = await createFixture();
    expect(component).toBeTruthy();
  });

  it('renders the sidebar element', async () => {
    const { fixture } = await createFixture('admin');
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('.sidebar')).toBeTruthy();
  });

  it('renders the bottom-nav element', async () => {
    const { fixture } = await createFixture('admin');
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('.bottom-nav')).toBeTruthy();
  });
});

describe('SidebarComponent nav items by role', () => {
  async function createSidebarFixture(role: 'admin' | 'manager' | 'view_only') {
    const mockAuth = {
      getSession: vi.fn().mockReturnValue(of(makeSession(role))),
    };

    await TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideLocationMocks(),
        { provide: AuthenticationService, useValue: mockAuth },
        {
          provide: SUPABASE_CLIENT,
          useValue: {
            auth: {
              onAuthStateChange: vi.fn(() => ({
                data: { subscription: { unsubscribe: vi.fn() } },
              })),
              getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
            },
          },
        },
        provideIcons({
          heroHome,
          heroBuildingOffice2,
          heroCreditCard,
          heroClock,
          heroCheckCircle,
          heroCog6Tooth,
          heroUserGroup,
          heroClipboardDocumentList,
        }),
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(SidebarComponent);
    fixture.detectChanges();
    return fixture.componentInstance;
  }

  it('shows 4 items for view_only (Dashboard, Properties, Tenants, Audit)', async () => {
    const sidebar = await createSidebarFixture('view_only');
    expect(sidebar.visibleItems().length).toBe(4);
  });

  it('shows 8 items for manager (all + manager items except Admin)', async () => {
    const sidebar = await createSidebarFixture('manager');
    expect(sidebar.visibleItems().length).toBe(8);
  });

  it('shows all 9 items for admin', async () => {
    const sidebar = await createSidebarFixture('admin');
    expect(sidebar.visibleItems().length).toBe(9);
  });
});
