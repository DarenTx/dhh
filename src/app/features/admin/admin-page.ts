import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { NgIconComponent } from '@ng-icons/core';
import { AuthenticationService } from '../../core/auth/authentication.service';
import { AdminService, UserRecord, UserRole } from '../../core/services/admin.service';
import { map } from 'rxjs';

@Component({
  selector: 'app-admin-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, NgIconComponent],
  styles: `
    :host {
      display: block;
    }

    .page-header {
      padding: 2rem 1.5rem 1rem;
      border-bottom: 1px solid #e2e8f0;
    }

    h1 {
      margin: 0;
      font-size: 1.5rem;
      font-weight: 700;
      color: #2d3748;
    }

    .section {
      padding: 1.5rem;
      max-width: 56rem;
    }

    h2 {
      font-size: 1.125rem;
      font-weight: 600;
      margin: 0 0 1rem;
      color: #2d3748;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.9375rem;
    }

    th {
      text-align: left;
      padding: 0.5rem 0.75rem;
      font-size: 0.75rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #718096;
      border-bottom: 2px solid #e2e8f0;
    }

    td {
      padding: 0.75rem;
      border-bottom: 1px solid #edf2f7;
      color: #4a5568;
    }

    .badge {
      display: inline-block;
      padding: 0.125rem 0.5rem;
      border-radius: 9999px;
      font-size: 0.75rem;
      font-weight: 600;
    }

    .badge-admin {
      background: #ebf4ff;
      color: #2b6cb0;
    }
    .badge-manager {
      background: #f0fff4;
      color: #276749;
    }
    .badge-view-only {
      background: #faf5ff;
      color: #553c9a;
    }
    .badge-active {
      background: #f0fff4;
      color: #276749;
    }
    .badge-inactive {
      background: #fff5f5;
      color: #c53030;
    }

    .invite-card {
      background: #fff;
      border: 1px solid #e2e8f0;
      border-radius: 0.75rem;
      padding: 1.5rem;
      max-width: 28rem;
    }

    .form-group {
      display: flex;
      flex-direction: column;
      gap: 0.375rem;
      margin-bottom: 1rem;
    }

    label {
      font-size: 0.875rem;
      font-weight: 600;
      color: #4a5568;
    }

    input,
    select {
      padding: 0.5rem 0.75rem;
      border: 1px solid #cbd5e0;
      border-radius: 0.375rem;
      font-size: 0.9375rem;
      color: #2d3748;
      outline: none;

      &:focus {
        border-color: #4299e1;
        box-shadow: 0 0 0 3px rgba(66, 153, 225, 0.2);
      }
    }

    .error-text {
      font-size: 0.8125rem;
      color: #c53030;
    }

    .btn {
      display: flex;
      align-items: center;
      gap: 0.375rem;
      padding: 0.5rem 1rem;
      border-radius: 0.375rem;
      font-size: 0.9375rem;
      font-weight: 600;
      cursor: pointer;
      border: none;
      transition: opacity 0.15s;

      &:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }
    }

    .btn-primary {
      background: #2b6cb0;
      color: #fff;
    }
    .btn-danger {
      background: #fc8181;
      color: #fff;
      font-size: 0.8125rem;
      padding: 0.25rem 0.625rem;
    }
    .btn-success {
      background: #68d391;
      color: #fff;
      font-size: 0.8125rem;
      padding: 0.25rem 0.625rem;
    }

    .avatar {
      width: 2rem;
      height: 2rem;
      border-radius: 9999px;
      object-fit: cover;
    }
    .avatar-placeholder {
      width: 2rem;
      height: 2rem;
      border-radius: 9999px;
      background: #e2e8f0;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: 0.75rem;
      font-weight: 600;
      color: #718096;
    }
    .user-cell {
      display: flex;
      align-items: center;
      gap: 0.625rem;
    }
    .user-name {
      font-weight: 500;
      color: #2d3748;
    }
    .user-email {
      font-size: 0.8125rem;
      color: #718096;
    }

    .success-msg {
      color: #276749;
      font-size: 0.9375rem;
      margin-top: 0.75rem;
    }
    .error-msg {
      color: #c53030;
      font-size: 0.9375rem;
      margin-top: 0.75rem;
    }
  `,
  template: `
    <div class="page-header">
      <h1>Admin</h1>
    </div>

    <div class="section">
      <h2>Users</h2>

      @if (loadError()) {
        <p class="error-msg">Failed to load users: {{ loadError() }}</p>
      } @else {
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Role</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            @for (user of users(); track user.user_id) {
              <tr>
                <td>
                  <div class="user-cell">
                    @if (user.avatar_url) {
                      <img class="avatar" [src]="user.avatar_url" [alt]="user.email" />
                    } @else {
                      <span class="avatar-placeholder">{{
                        (user.first_name?.[0] ?? user.email[0]).toUpperCase()
                      }}</span>
                    }
                    <div>
                      @if (user.first_name || user.last_name) {
                        <div class="user-name">{{ user.first_name }} {{ user.last_name }}</div>
                      }
                      <div class="user-email">{{ user.email }}</div>
                    </div>
                  </div>
                </td>
                <td>
                  <span
                    class="badge"
                    [class.badge-admin]="user.role === 'admin'"
                    [class.badge-manager]="user.role === 'manager'"
                    [class.badge-view-only]="user.role === 'view_only'"
                    >{{ user.role }}</span
                  >
                </td>
                <td>
                  <span
                    class="badge"
                    [class.badge-active]="user.is_active"
                    [class.badge-inactive]="!user.is_active"
                    >{{ user.is_active ? 'Active' : 'Inactive' }}</span
                  >
                </td>
                <td>
                  @if (user.user_id !== currentUserId()) {
                    @if (user.is_active) {
                      <button class="btn btn-danger" (click)="deactivate(user)">Deactivate</button>
                    } @else {
                      <button class="btn btn-success" (click)="reactivate(user)">Reactivate</button>
                    }
                  } @else {
                    <button class="btn btn-danger" disabled>Deactivate</button>
                  }
                </td>
              </tr>
            }
          </tbody>
        </table>
      }
    </div>

    <div class="section">
      <h2>Invite User</h2>
      <div class="invite-card">
        <form [formGroup]="inviteForm" (ngSubmit)="invite()">
          <div class="form-group">
            <label for="first-name">First Name</label>
            <input id="first-name" type="text" formControlName="firstName" placeholder="Jane" />
          </div>
          <div class="form-group">
            <label for="last-name">Last Name</label>
            <input id="last-name" type="text" formControlName="lastName" placeholder="Smith" />
          </div>
          <div class="form-group">
            <label for="email">Email</label>
            <input
              id="email"
              type="email"
              formControlName="email"
              placeholder="user@dahlheritagehomes.com"
            />
            @if (inviteForm.controls.email.invalid && inviteForm.controls.email.touched) {
              @if (inviteForm.controls.email.errors?.['required']) {
                <span class="error-text">Email is required.</span>
              } @else if (inviteForm.controls.email.errors?.['email']) {
                <span class="error-text">Please enter a valid email address.</span>
              }
            }
          </div>

          <div class="form-group">
            <label for="role">Role</label>
            <select id="role" formControlName="role">
              <option value="view_only">View Only</option>
              <option value="manager">Manager</option>
              <option value="admin">Admin</option>
            </select>
          </div>

          <button class="btn btn-primary" type="submit" [disabled]="submitting()">
            <ng-icon name="heroEnvelope" size="16" />
            {{ submitting() ? 'Sending…' : 'Send Invite' }}
          </button>
        </form>

        @if (inviteSuccess()) {
          <p class="success-msg">Invite sent successfully!</p>
        }
        @if (inviteError()) {
          <p class="error-msg">{{ inviteError() }}</p>
        }
      </div>
    </div>
  `,
})
export class AdminPage {
  private readonly adminService = inject(AdminService);
  private readonly authService = inject(AuthenticationService);
  private readonly fb = inject(FormBuilder);

  readonly users = signal<UserRecord[]>([]);
  readonly loadError = signal<string | null>(null);
  readonly submitting = signal(false);
  readonly inviteSuccess = signal(false);
  readonly inviteError = signal<string | null>(null);
  readonly currentUserId = signal<string | null>(null);

  readonly inviteForm = this.fb.group({
    firstName: [''],
    lastName: [''],
    email: ['', [Validators.required, Validators.email]],
    role: ['view_only' as UserRole, Validators.required],
  });

  constructor() {
    this.loadUsers();
    this.authService
      .getSession()
      .pipe(map((s) => s?.user?.id ?? null))
      .subscribe((id) => this.currentUserId.set(id));
  }

  private loadUsers(): void {
    this.adminService.getUsers().subscribe({
      next: (users) => this.users.set(users),
      error: (err) => this.loadError.set(err?.message ?? 'Unknown error'),
    });
  }

  invite(): void {
    if (this.inviteForm.invalid) {
      this.inviteForm.markAllAsTouched();
      return;
    }
    this.submitting.set(true);
    this.inviteSuccess.set(false);
    this.inviteError.set(null);

    const { email, role, firstName, lastName } = this.inviteForm.value;
    this.adminService
      .inviteUser(email!, role as UserRole, firstName ?? undefined, lastName ?? undefined)
      .subscribe({
        next: () => {
          this.submitting.set(false);
          this.inviteSuccess.set(true);
          this.inviteForm.reset({ firstName: '', lastName: '', email: '', role: 'view_only' });
          this.loadUsers();
        },
        error: (err) => {
          this.submitting.set(false);
          this.inviteError.set(err?.message ?? 'Failed to send invite.');
        },
      });
  }

  deactivate(user: UserRecord): void {
    this.adminService.deactivateUser(user.user_id).subscribe({
      next: () => this.loadUsers(),
    });
  }

  reactivate(user: UserRecord): void {
    this.adminService.reactivateUser(user.user_id).subscribe({
      next: () => this.loadUsers(),
    });
  }
}
