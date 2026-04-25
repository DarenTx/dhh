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

function makeSession(role: 'admin' | 'manager' | 'view_only' | null) {
  if (!role) return null;
  return { user: { id: '123', app_metadata: { role } } };
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

  it('shows 3 items for view_only (Dashboard, Properties, Audit)', async () => {
    const sidebar = await createSidebarFixture('view_only');
    expect(sidebar.visibleItems().length).toBe(3);
  });

  it('shows 7 items for manager (all except Admin)', async () => {
    const sidebar = await createSidebarFixture('manager');
    expect(sidebar.visibleItems().length).toBe(7);
  });

  it('shows all 8 items for admin', async () => {
    const sidebar = await createSidebarFixture('admin');
    expect(sidebar.visibleItems().length).toBe(8);
  });
});
