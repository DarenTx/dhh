import { TestBed } from '@angular/core/testing';
import { describe, it, expect, vi } from 'vitest';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { SettingsPage } from './settings-page';
import {
  SettingsService,
  AppSettings,
  IrsCategory,
  ExpenseSubcategory,
} from '../../core/services/settings.service';
import { SUPABASE_CLIENT } from '../../core/auth/supabase.provider';

const defaultSettings: AppSettings = {
  expense_monthly_aggregate_threshold: 150,
  guaranteed_payment_hour_cap: 20,
};

const mockCategory: IrsCategory = { id: 1, name: 'Advertising' };

const mockSub: ExpenseSubcategory = {
  id: 'sub-1',
  irs_category_id: 1,
  name: 'Facebook Ads',
  is_active: true,
  created_at: '2024-01-01T00:00:00Z',
};

function makeSettingsService(overrides: Partial<Record<keyof SettingsService, unknown>> = {}) {
  return {
    getSettings: vi.fn().mockReturnValue(of(defaultSettings)),
    updateSettings: vi.fn().mockReturnValue(of(undefined)),
    getCategories: vi.fn().mockReturnValue(of([mockCategory])),
    getSubcategories: vi.fn().mockReturnValue(of([mockSub])),
    addSubcategory: vi.fn().mockReturnValue(of(undefined)),
    disableSubcategory: vi.fn().mockReturnValue(of(undefined)),
    ...overrides,
  };
}

async function createFixture(serviceOverrides: Parameters<typeof makeSettingsService>[0] = {}) {
  const settingsService = makeSettingsService(serviceOverrides);

  await TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: SettingsService, useValue: settingsService },
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

  const fixture = TestBed.createComponent(SettingsPage);
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  return { fixture, component: fixture.componentInstance, settingsService };
}

describe('SettingsPage', () => {
  it('creates without error', async () => {
    const { component } = await createFixture();
    expect(component).toBeTruthy();
  });

  it('loads settings on init and patches the form', async () => {
    const { component, settingsService } = await createFixture();
    expect(settingsService.getSettings).toHaveBeenCalled();
    expect(component.settingsForm.value.expenseThreshold).toBe(150);
    expect(component.settingsForm.value.hourCap).toBe(20);
  });

  it('loads IRS categories on init', async () => {
    const { component } = await createFixture();
    expect(component.categories()).toHaveLength(1);
    expect(component.categories()[0].name).toBe('Advertising');
  });

  it('calls updateSettings and sets settingsSaved on valid save', async () => {
    const { component, settingsService } = await createFixture();
    component.saveSettings();
    expect(settingsService.updateSettings).toHaveBeenCalledWith({
      expenseThreshold: 150,
      hourCap: 20,
    });
    expect(component.settingsSaved()).toBe(true);
  });

  it('marks form touched and does not save when form is invalid', async () => {
    const { component, settingsService } = await createFixture();
    component.settingsForm.setValue({ expenseThreshold: -1, hourCap: 20 });
    component.saveSettings();
    expect(settingsService.updateSettings).not.toHaveBeenCalled();
    expect(component.settingsForm.touched).toBe(true);
  });

  it('toggleCategory expands a category and loads its subcategories', async () => {
    const { component, settingsService } = await createFixture();
    component.toggleCategory(1);
    expect(component.expandedCategory()).toBe(1);
    expect(settingsService.getSubcategories).toHaveBeenCalledWith(1);
    expect(component.subcategories()[1]).toHaveLength(1);
  });

  it('toggleCategory collapses when called again', async () => {
    const { component } = await createFixture();
    component.toggleCategory(1);
    component.toggleCategory(1);
    expect(component.expandedCategory()).toBeNull();
  });

  it('addSub does nothing when newSubName is empty', async () => {
    const { component, settingsService } = await createFixture();
    component.newSubName = '   ';
    component.addSub(1);
    expect(settingsService.addSubcategory).not.toHaveBeenCalled();
  });
});
