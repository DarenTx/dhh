import { inject, Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { Session, SupabaseClient } from '@supabase/supabase-js';
import { from, Observable, ReplaySubject } from 'rxjs';
import { environment } from '../../../environments/environment';
import { SUPABASE_CLIENT } from './supabase.provider';

@Injectable({ providedIn: 'root' })
export class AuthenticationService {
  private readonly supabase = inject<SupabaseClient>(SUPABASE_CLIENT);
  private readonly router = inject(Router);

  private readonly callbackUrl = `${environment.appUrl}/login/callback`;

  private readonly session$ = new ReplaySubject<Session | null>(1);

  constructor() {
    // Hydrate from existing session and subscribe to future changes
    this.supabase.auth.onAuthStateChange((_event, session) => {
      this.session$.next(session);
    });
  }

  getSession(): Observable<Session | null> {
    return this.session$.asObservable();
  }

  async signInWithGoogle(): Promise<void> {
    const { error } = await this.supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: this.callbackUrl },
    });
    if (error) throw error;
  }

  async sendMagicLink(email: string): Promise<void> {
    const { error } = await this.supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: this.callbackUrl },
    });
    if (error) throw error;
  }

  async handleAuthCallback(): Promise<void> {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    if (!code) {
      throw new Error('No authorization code found in URL.');
    }
    const { error } = await this.supabase.auth.exchangeCodeForSession(code);
    if (error) throw error;
  }

  async signOutSilent(): Promise<void> {
    await this.supabase.auth.signOut();
  }

  async signOut(): Promise<void> {
    await this.signOutSilent();
    await this.router.navigate(['/login']);
  }
}
