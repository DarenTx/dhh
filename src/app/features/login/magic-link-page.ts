import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthenticationService } from '../../core/auth/authentication.service';
import { noInternalEmailValidator } from '../../core/auth/no-internal-email.validator';

const RATE_LIMIT_CODES = ['over_email_send_rate_limit'];
const RATE_LIMIT_MESSAGE = 'Too many attempts. Please wait a moment before trying again.';

@Component({
  selector: 'app-magic-link-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './magic-link-page.html',
  styleUrl: './magic-link-page.scss',
})
export class MagicLinkPage {
  private readonly auth = inject(AuthenticationService);
  private readonly fb = inject(FormBuilder);

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
    if (ctrl.hasError('internalEmail')) return 'Internal email addresses are not allowed.';
    return null;
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
