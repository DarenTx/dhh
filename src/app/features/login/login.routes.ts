import { Routes } from '@angular/router';
import { LoginPage } from './login-page';
import { MagicLinkPage } from './magic-link-page';
import { AuthCallbackPage } from './auth-callback-page';

export const loginRoutes: Routes = [
  { path: '', component: LoginPage },
  { path: 'magic-link', component: MagicLinkPage },
  { path: 'callback', component: AuthCallbackPage },
];
