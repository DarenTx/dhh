import { Routes } from '@angular/router';
import { Home } from './home/home';
import { authGuard } from './core/auth/auth.guard';

export const routes: Routes = [
  { path: '', component: Home, canActivate: [authGuard] },
  {
    path: 'login',
    loadChildren: () => import('./features/login/login.routes').then((m) => m.loginRoutes),
  },
  { path: '**', redirectTo: '' },
];
