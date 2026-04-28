# Dahl Heritage Homes — Agent Instructions

A property management PWA for tracking properties, tenants, leases, expenses, and guaranteed payments. Uses Supabase for backend/auth and Gemini AI (via Edge Functions) for document extraction.

See [docs/overview.md](docs/overview.md) for full project description and [docs/roadmap.md](docs/roadmap.md) for the feature roadmap.

## Build & Test

```bash
npm start          # dev server → localhost:4200
npm run build      # production build → dist/
npm test           # Vitest unit tests
npm run test:e2e   # Playwright e2e tests
npm run test:e2e:ui  # Playwright interactive UI
```

## Architecture

- **Angular 21, fully standalone** — no NgModules anywhere
- **Lazy-loaded feature routes** defined in `src/app/app.routes.ts`
- **Role-based access**: `authGuard`, `managerGuard`, `adminGuard` — roles (`admin | manager | view_only`) come from `app_metadata.role` in the Supabase JWT
- **Supabase client** injected via `SUPABASE_CLIENT` `InjectionToken` (see `src/app/core/auth/supabase.provider.ts`) — never import `@supabase/supabase-js` directly in components or services
- **AI extraction** via two Edge Functions (`extract-lease`, `extract-expense`) bridged by `AiExtractionService`

Feature areas: `admin`, `approvals`, `audit`, `dashboard`, `expenses`, `guaranteed-payments`, `login`, `properties`, `settings`, `tenants`

## Conventions

All of these differ from Angular defaults — follow them everywhere:

**DI**: Use `inject()` in field declarations, never constructor parameters.

```typescript
private readonly supabase = inject<SupabaseClient>(SUPABASE_CLIENT);
private readonly role = inject(RoleService);
```

**Observables from Supabase**: Wrap all Supabase promise calls with `from()`.

```typescript
getAll(): Observable<Expense[]> {
  return from(this.supabase.from('expenses').select('*').then(({ data, error }) => {
    if (error) throw error;
    return data ?? [];
  }));
}
```

**Change detection**: Always `ChangeDetectionStrategy.OnPush`.

**Signals**: Use `signal()` / `computed()` for local state; use `toSignal()` to bridge observables into templates.

**Styles**: Inline styles in the `@Component` decorator (`styles: [...]`), not separate `.scss` files — except global styles in `src/styles.scss`.

**Icons**: Use `@ng-icons/heroicons` outline set via `NgIconComponent`.

## Testing

- Unit tests use **Vitest** with `jsdom` and Angular's `TestBed`. Config: `vitest.config.ts`. A custom Vite plugin inlines `templateUrl` and patches signal inputs for compatibility.
- E2E tests use **Playwright**. Config: `playwright.config.ts`. Tests live in `e2e/`.
- Run unit tests for a specific file: `npx vitest run src/app/features/expenses/expenses.component.spec.ts`

## Supabase

- Migrations: `supabase/migrations/` (5 phases, chronological)
- Edge Functions: `supabase/functions/` (`extract-lease`, `extract-expense`, `invite-user`)
- Environment config: `src/environments/environment.ts` (dev) / `environment.prod.ts` (prod)
- Auth: PKCE flow with Google OAuth and email magic links
