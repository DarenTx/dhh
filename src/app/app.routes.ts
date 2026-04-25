import { Routes } from '@angular/router';
import { Home } from './home/home';
import { authGuard } from './core/auth/auth.guard';
import { adminGuard, managerGuard } from './core/role/role.guard';
import { ShellComponent } from './layout/shell/shell.component';
import { PropertiesPage } from './features/properties/properties-page';
import { ExpensesPage } from './features/expenses/expenses-page';
import { GuaranteedPaymentsPage } from './features/guaranteed-payments/guaranteed-payments-page';
import { ApprovalsPage } from './features/approvals/approvals-page';

export const routes: Routes = [
  {
    path: 'login',
    loadChildren: () => import('./features/login/login.routes').then((m) => m.loginRoutes),
  },
  {
    path: '',
    component: ShellComponent,
    canActivate: [authGuard],
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      { path: 'dashboard', component: Home },
      { path: 'properties', component: PropertiesPage },
      { path: 'expenses', component: ExpensesPage, canActivate: [managerGuard] },
      {
        path: 'guaranteed-payments',
        component: GuaranteedPaymentsPage,
        canActivate: [managerGuard],
      },
      { path: 'approvals', component: ApprovalsPage, canActivate: [managerGuard] },
      {
        path: 'settings',
        loadComponent: () =>
          import('./features/settings/settings-page').then((m) => m.SettingsPage),
        canActivate: [managerGuard],
      },
      {
        path: 'admin',
        loadComponent: () =>
          import('./features/admin/admin-page').then((m) => m.AdminPage),
        canActivate: [adminGuard],
      },
      {
        path: 'audit',
        loadComponent: () =>
          import('./features/audit/audit-page').then((m) => m.AuditPage),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];

