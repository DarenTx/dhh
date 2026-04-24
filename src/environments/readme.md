# Environment Configuration

Angular does not use `.env` files directly. These values are configured in the environment files in this folder:

- **Development:** `environment.ts`
- **Production:** `environment.prod.ts`

Replace the placeholder values in both files before running or deploying.

## Required Values

| Variable           | Description                                               | Where to find it                                                                 |
| ------------------ | --------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `supabase.url`     | Your Supabase project URL                                 | Supabase Dashboard → Project Settings → API → Project URL                        |
| `supabase.anonKey` | Your Supabase anonymous (public) key                      | Supabase Dashboard → Project Settings → API → Project API Keys → **anon/public** |
| `appUrl`           | The URL your app is served from (used for auth redirects) | `http://localhost:4200` for dev, your domain for production                      |

## Example

```ts
export const environment = {
  production: false,
  supabase: {
    url: 'https://<your-project-ref>.supabase.co',
    anonKey: 'sb_publishable_<your-anon-key>',
  },
  appUrl: 'http://localhost:4200',
};
```

> **Note:** The `anonKey` is a public key and safe to commit. Never commit the **service role key** (`sb_secret_...`) — it bypasses Row Level Security.
