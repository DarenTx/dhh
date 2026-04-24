import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AuthenticationService } from '../../core/auth/authentication.service';
import { consumeRedirectDestination } from '../../core/auth/redirect-destination';

@Component({
  selector: 'app-auth-callback-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="callback-container" aria-busy="true" aria-label="Completing sign in…">
      <div class="spinner"></div>
      <p>Completing sign in…</p>
    </div>
  `,
  styles: `
    :host {
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
    }
    .callback-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 1rem;
    }
    .spinner {
      width: 2rem;
      height: 2rem;
      border: 3px solid #ccc;
      border-top-color: #333;
      border-radius: 50%;
      animation: spin 0.7s linear infinite;
    }
    @keyframes spin {
      to {
        transform: rotate(360deg);
      }
    }
  `,
})
export class AuthCallbackPage implements OnInit {
  private readonly auth = inject(AuthenticationService);
  private readonly router = inject(Router);

  ngOnInit(): void {
    this.handleCallback();
  }

  private async handleCallback(): Promise<void> {
    try {
      await this.auth.handleAuthCallback();
      const destination = consumeRedirectDestination();
      await this.router.navigate([destination]);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Authentication failed.';
      await this.router.navigate(['/login'], {
        queryParams: { error: encodeURIComponent(message) },
      });
    }
  }
}
