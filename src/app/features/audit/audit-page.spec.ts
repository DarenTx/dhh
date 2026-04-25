import { TestBed } from '@angular/core/testing';
import { describe, it, expect, vi } from 'vitest';
import { provideRouter } from '@angular/router';
import { provideLocationMocks } from '@angular/common/testing';
import { of } from 'rxjs';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { AuditPage } from './audit-page';
import { AuditService, AuditRow, AuditResult } from '../../core/services/audit.service';
import { SUPABASE_CLIENT } from '../../core/auth/supabase.provider';

const mockRow: AuditRow = {
  id: 'row-1',
  table_name: 'user_roles',
  record_id: 'rec-1',
  operation: 'INSERT',
  old_data: null,
  new_data: { email: 'a@b.com', role: 'view_only' },
  performed_by: 'user-1',
  performed_at: '2024-06-01T12:00:00Z',
  performer_email: 'admin@dahlheritagehomes.com',
};

function makeAuditService(result: AuditResult = { rows: [mockRow], totalCount: 1 }) {
  return {
    loadAudit: vi.fn().mockReturnValue(of(result)),
  };
}

async function createFixture(
  serviceResult?: AuditResult,
  queryParams: Record<string, string> = {},
) {
  const auditService = makeAuditService(serviceResult);

  await TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      provideLocationMocks(),
      { provide: AuditService, useValue: auditService },
      {
        provide: ActivatedRoute,
        useValue: {
          queryParamMap: of(convertToParamMap(queryParams)),
        },
      },
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

  const fixture = TestBed.createComponent(AuditPage);
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  return { fixture, component: fixture.componentInstance, auditService };
}

describe('AuditPage', () => {
  it('creates without error', async () => {
    const { component } = await createFixture();
    expect(component).toBeTruthy();
  });

  it('loads audit data on init', async () => {
    const { component, auditService } = await createFixture();
    expect(auditService.loadAudit).toHaveBeenCalled();
    expect(component.rows()).toHaveLength(1);
    expect(component.rows()[0].table_name).toBe('user_roles');
  });

  it('sets totalCount from the service result', async () => {
    const { component } = await createFixture({ rows: [mockRow, mockRow], totalCount: 2 });
    expect(component.totalCount()).toBe(2);
  });

  it('defaults to page 1 when no query param', async () => {
    const { component } = await createFixture();
    expect(component.currentPage()).toBe(1);
  });

  it('reads page from queryParamMap', async () => {
    const { component } = await createFixture(undefined, { page: '3' });
    expect(component.currentPage()).toBe(3);
  });

  it('totalPages() returns 1 when totalCount is 0', async () => {
    const { component } = await createFixture({ rows: [], totalCount: 0 });
    expect(component.totalPages()).toBe(1);
  });

  it('totalPages() returns correct number when totalCount > PAGE_SIZE', async () => {
    const { component } = await createFixture({ rows: [], totalCount: 301 });
    expect(component.totalPages()).toBe(3); // ceil(301/150) = 3
  });

  it('toggleRow expands a row', async () => {
    const { component } = await createFixture();
    component.toggleRow('row-1');
    expect(component.expandedRowId()).toBe('row-1');
  });

  it('toggleRow collapses a row when clicked again', async () => {
    const { component } = await createFixture();
    component.toggleRow('row-1');
    component.toggleRow('row-1');
    expect(component.expandedRowId()).toBeNull();
  });

  it('sets loading to false after data loads', async () => {
    const { component } = await createFixture();
    expect(component.loading()).toBe(false);
  });

  it('shows empty state when rows is empty', async () => {
    const { fixture } = await createFixture({ rows: [], totalCount: 0 });
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('.empty-state')).toBeTruthy();
  });
});
