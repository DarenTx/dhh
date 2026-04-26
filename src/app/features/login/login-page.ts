import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthenticationService } from '../../core/auth/authentication.service';
import { storeRedirectDestination } from '../../core/auth/redirect-destination';
import { noInternalEmailValidator } from '../../core/auth/no-internal-email.validator';
import { first } from 'rxjs/operators';

const RATE_LIMIT_CODES = ['over_email_send_rate_limit'];
const RATE_LIMIT_MESSAGE = 'Too many attempts. Please wait a moment before trying again.';

@Component({
  selector: 'app-login-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule],
  host: { role: 'main', 'aria-labelledby': 'login-heading' },
  templateUrl: './login-page.html',
  styleUrl: './login-page.scss',
})
export class LoginPage implements OnInit {
  private readonly auth = inject(AuthenticationService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly fb = inject(FormBuilder);

  readonly loading = signal(true);
  readonly googleLoading = signal(false);
  readonly googleError = signal<string | null>(null);
  readonly callbackError = signal<string | null>(null);

  readonly form = this.fb.group({
    email: ['', [Validators.required, Validators.email, noInternalEmailValidator]],
  });

  readonly submitting = signal(false);
  readonly submitted = signal(false);
  readonly serverError = signal<string | null>(null);

  get emailControl() {
    return this.form.controls.email;
  }

  get emailErrorMessage(): string | null {
    const ctrl = this.emailControl;
    if (!ctrl.touched && !ctrl.dirty) return null;
    if (ctrl.hasError('required')) return 'Email is required.';
    if (ctrl.hasError('email')) return 'Please enter a valid email address.';
    if (ctrl.hasError('internalEmail')) return 'Do not use a dahlheritagehomes.com email address.';
    return null;
  }

  ngOnInit(): void {
    const rawError = this.route.snapshot.queryParamMap.get('error');
    if (rawError) {
      this.callbackError.set(decodeURIComponent(rawError));
      this.loading.set(false);
      return;
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

  async onSubmit(): Promise<void> {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;

    this.submitting.set(true);
    this.serverError.set(null);

    try {
      await this.auth.sendMagicLink(this.emailControl.value!);
      this.submitted.set(true);
    } catch (err: unknown) {
      const error = err as { code?: string; status?: number; message?: string };
      const isRateLimit =
        (error.code && RATE_LIMIT_CODES.includes(error.code)) || error.status === 429;
      this.serverError.set(
        isRateLimit ? RATE_LIMIT_MESSAGE : (error.message ?? 'An error occurred.'),
      );
      this.submitting.set(false);
    }
  }
}
