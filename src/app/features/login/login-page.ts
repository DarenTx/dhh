import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { AuthenticationService } from '../../core/auth/authentication.service';
import { storeRedirectDestination } from '../../core/auth/redirect-destination';
import { first } from 'rxjs/operators';

@Component({
  selector: 'app-login-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  host: { role: 'main', 'aria-labelledby': 'login-heading' },
  templateUrl: './login-page.html',
  styleUrl: './login-page.scss',
})
export class LoginPage implements OnInit {
  private readonly auth = inject(AuthenticationService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly loading = signal(true);
  readonly googleLoading = signal(false);
  readonly googleError = signal<string | null>(null);
  readonly callbackError = signal<string | null>(null);

  ngOnInit(): void {
    const rawError = this.route.snapshot.queryParamMap.get('error');
    if (rawError) {
      this.callbackError.set(decodeURIComponent(rawError));
    }

    this.auth
      .getSession()
      .pipe(first())
      .subscribe((session) => {
        if (session) {
          const destination = sessionStorage.getItem('auth_redirect_destination') ?? '/';
          this.router.navigate([destination]);
        } else {
          this.loading.set(false);
        }
      });
  }

  async signInWithGoogle(): Promise<void> {
    this.googleLoading.set(true);
    this.googleError.set(null);
    storeRedirectDestination(this.router.url.split('?')[0]);
    try {
      await this.auth.signInWithGoogle();
    } catch (err: unknown) {
      this.googleError.set(err instanceof Error ? err.message : 'An error occurred.');
      this.googleLoading.set(false);
    }
  }
}
