# Login — Functional Plan

## Overview

The login flow offers two authentication methods, both backed by Supabase:

1. **Google OAuth** — one-click sign-in via Google
2. **Email Magic Link** — passwordless sign-in via a Supabase email link

All Supabase API calls are encapsulated in `AuthenticationService`.

---

## Testing Requirements

- **Unit tests**: all components, services, validators, and guards must have unit tests with a minimum of **90% code coverage** (statements, branches, functions, and lines).
- **Playwright (E2E) tests**: the full login flow must be covered by Playwright tests, including:
  - Successful Google OAuth redirect
  - Successful magic link submission and confirmation state
  - Magic link validation errors (empty, invalid format, internal domain)
  - Magic link rate-limit error display
  - `AuthCallbackPage` success redirect and error redirect
  - `authGuard` redirecting unauthenticated users to `/login`
  - Post-login redirect destination preservation and restoration

---

## Routes

| Path                | Component          | Description                                      |
| ------------------- | ------------------ | ------------------------------------------------ |
| `/login`            | `LoginPage`        | Entry point; presents both login options         |
| `/login/magic-link` | `MagicLinkPage`    | Email entry form for magic link                  |
| `/login/callback`   | `AuthCallbackPage` | Handles redirect after OAuth or magic link click |

---

## Post-Login Redirect Destination

Before initiating any OAuth or magic-link flow that leaves the current page, the app must preserve the intended destination so `AuthCallbackPage` can restore it:

1. **Before redirecting away**: store the intended destination path in `sessionStorage` under the key `auth_redirect_destination`. Only paths that start with `/` and do **not** start with `/login` are valid destinations; everything else defaults to `/`.
2. **On callback success**: `AuthCallbackPage` reads and immediately removes the key from `sessionStorage`, then navigates to the stored path. If the key is absent or invalid the fallback is `/`.
3. **Open-redirect protection**: the destination is validated at the point of storage _and_ at the point of use. Any value that is not a same-origin relative path (i.e. starts with `http`, `//`, or contains `..`) is discarded and replaced with `/`.

---

## Components

### `LoginPage`

- While the initial session check is in progress, the page renders a loading indicator (e.g., a spinner) and suppresses both action buttons to avoid a flash of the login UI.
- Once the session check resolves:
  - **Authenticated** → immediately redirect to the post-login destination (see [Post-Login Redirect Destination](#post-login-redirect-destination)).
  - **Not authenticated** → show the login UI.
- Displays two actions:
  - **Sign in with Google** button → stores the intended destination, then calls `AuthenticationService.signInWithGoogle()`.
    - The button shows a loading/disabled state while the call is in flight.
    - On error → displays the error message inline near the button; the button returns to its active state.
  - **Sign in with Email** link/button → navigates to `/login/magic-link`.
- If the current URL contains an `?error=` query parameter (set by `AuthCallbackPage` on failure), the page reads and displays that error message in a visible error banner at the top of the form. The parameter must be URL-decoded before display.
- `role="main"` on the page root; the heading has `id="login-heading"` and the `<main>` element references it via `aria-labelledby`.

### `MagicLinkPage`

- Contains a single email input field and a submit button.
- **Validation rules** (evaluated on submit and on blur):
  - Field must not be empty.
  - Value must be a well-formed email address (standard RFC 5322 format).
  - Value must **not** use the `dahlheritagehomes.com` domain or any subdomain thereof (case-insensitive). See [Email Validation Logic](#email-validation-logic).
- On valid submit:
  - The submit button immediately becomes disabled and shows a loading indicator.
  - Calls `AuthenticationService.sendMagicLink(email)`.
- On success → the form is replaced by a confirmation message telling the user to check their inbox.
- On error:
  - If the service returns a rate-limit error (Supabase error code `over_email_send_rate_limit` or HTTP 429), display the message: _"Too many attempts. Please wait a moment before trying again."_
  - For all other errors → display the error message returned by the service.
  - In both error cases the submit button re-enables so the user can retry.
- Provides a back link to `/login`.
- Accessibility: the email `<input>` has an associated `<label>`, `aria-describedby` pointing to the inline validation error element, and `aria-invalid="true"` when the field is invalid.

### `AuthCallbackPage`

- Rendered at `/login/callback` (configured as the Supabase redirect URL).
- On init, renders a full-page loading indicator immediately (before any async work begins) so users are never shown a blank page.
- Calls `AuthenticationService.handleAuthCallback()` to exchange the URL authorization code for a session using PKCE (see [AuthenticationService](#authenticationservice)).
- On success → reads the stored destination from `sessionStorage`, validates it (see [Post-Login Redirect Destination](#post-login-redirect-destination)), and performs a `Router.navigate()` to that path.
- On error → redirects to `/login?error=<URL-encoded error message>`.

---

## AuthenticationService

Located at `src/app/core/auth/authentication.service.ts`.

### Methods

| Method                                        | Description                                                                                                                                                                                                                          |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `signInWithGoogle(): Promise<void>`           | Initiates Supabase OAuth flow with Google provider; sets `redirectTo` to the absolute callback URL (e.g., `https://dahlheritagehomes.com/login/callback`).                                                                           |
| `sendMagicLink(email: string): Promise<void>` | Calls `supabase.auth.signInWithOtp({ email })` with `redirectTo` set to the absolute callback URL (e.g., `https://dahlheritagehomes.com/login/callback`). The `redirectTo` value must be an absolute URL, not a relative path.       |
| `handleAuthCallback(): Promise<void>`         | Calls `supabase.auth.exchangeCodeForSession(code)` using the PKCE authorization code from the `?code=` query parameter. **Implicit (hash-based) token detection is not used**; if no `code` parameter is present the method throws.  |
| `getSession(): Observable<Session \| null>`   | Returns the current session as an observable. Uses `supabase.auth.onAuthStateChange` under the hood and replays the latest value (i.e., behaves as a `BehaviorSubject`-like source) so subscribers always receive the current state. |
| `signOut(): Promise<void>`                    | Calls `supabase.auth.signOut()` and navigates to `/login`.                                                                                                                                                                           |

### Supabase Client

- A single `SupabaseClient` instance is provided at the application root (via `provideSupabase()` or an `APP_INITIALIZER`).
- `AuthenticationService` injects the client and does not create its own instance.
- The client must be configured with `auth.flowType: 'pkce'` and `auth.storage: localStorage` to ensure consistent PKCE behavior and session persistence across browser restarts.

---

## Email Validation Logic

Implemented as a reusable Angular validator (`noInternalEmailValidator`):

1. Check the value is non-empty.
2. Verify the value matches the standard email pattern.
3. Extract the domain portion (everything after `@`).
4. Reject if `domain.toLowerCase() === 'dahlheritagehomes.com'` **or** `domain.toLowerCase().endsWith('.dahlheritagehomes.com')`.

> **Note**: step 4 uses both an exact match and an `endsWith` subdomain check. The earlier bullet point in `MagicLinkPage` ("must not use the `dahlheritagehomes.com` domain or any subdomain") is the authoritative rule; the `===` check alone is insufficient.

The validator is applied to the reactive form control in `MagicLinkPage`.

---

## Auth State Guard

An `authGuard` function (functional route guard) protects all non-login routes:

- Injects `AuthenticationService` and calls `getSession()`.
- Takes the **first emission** from the observable (using `first()`), maps it to `true` if a session exists or to `inject(Router).createUrlTree(['/login'])` if it does not, and returns the resulting `Observable<boolean | UrlTree>`.
- Using `first()` ensures the guard completes (does not remain subscribed) and avoids a race condition where the guard fires before the session is hydrated from `localStorage`.

---

## Supabase Configuration Requirements

- **OAuth provider**: Google must be enabled in the Supabase project's Auth settings.
- **PKCE flow**: the Supabase client must be initialized with `auth.flowType: 'pkce'`. This ensures the authorization code (not an implicit token in the URL hash) is used for the callback exchange, which is more secure.
- **Redirect URLs** (both must be added to the Supabase allowed redirect URLs list):
  - `https://dahlheritagehomes.com/login/callback`
  - `http://localhost:4200/login/callback` (local dev only)
- **Magic link**: enabled by default with Supabase email OTP; no additional provider configuration needed.
- **Rate limiting**: Supabase enforces a default email send rate limit. The UI handles the `over_email_send_rate_limit` error code explicitly (see `MagicLinkPage` error handling above).
