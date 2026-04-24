import { Routes } from '@angular/router';
import { LoginPage } from './login-page';
import { AuthCallbackPage } from './auth-callback-page';

export const loginRoutes: Routes = [
  { path: '', component: LoginPage },
  { path: 'callback', component: AuthCallbackPage },
];
