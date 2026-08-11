# LaFleur

Production-ready Next.js App Router application for the LaFleur flower store: storefront, public catalog API, and a Telegram Mini App admin area in one deployment.

## Stack and architecture

- Next.js 15, React 19, TypeScript
- Supabase Postgres and public `product-images` Storage bucket
- Public browser/data client uses only the publishable key and remains constrained by RLS
- Server-only admin client uses `SUPABASE_SECRET_KEY`; it is never imported by Client Components
- `/api/products` returns published catalog data
- `/api/admin/*` validates Telegram Mini App `initData`, checks `auth_date`, then verifies the Telegram user against the active `admins` table before any privileged query

## Local setup

Requires Node.js 22+.

```bash
cp .env.example .env.local
npm ci
npm run dev
```

Fill `.env.local` from Supabase **Connect / API Keys** and BotFather. Prefer current `sb_publishable_…` and `sb_secret_…` keys. Never expose `SUPABASE_SECRET_KEY` or `TELEGRAM_BOT_TOKEN` through a `NEXT_PUBLIC_` variable.

## Environment variables

| Variable | Exposure | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Public | Project API URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Public | RLS-limited storefront access |
| `SUPABASE_SECRET_KEY` | Server only | Privileged admin API access |
| `TELEGRAM_BOT_TOKEN` | Server only | Telegram HMAC validation |
| `TELEGRAM_INIT_DATA_MAX_AGE_SECONDS` | Server only | Maximum accepted initData age |

## Telegram Mini App

1. Add at least one record to `admins` using the Telegram numeric user ID.
2. Deploy the app over HTTPS and configure the `/admin` URL as the bot Mini App/Web App URL in BotFather.
3. Set all environment variables in the deployment platform and redeploy.
4. Open `/admin` only through Telegram. Direct browser visits intentionally show an access message.

Admin calls send raw `window.Telegram.WebApp.initData` in `X-Telegram-Init-Data`. The server reconstructs Telegram's data-check string, derives the `WebAppData` HMAC secret, uses a timing-safe signature comparison, enforces freshness, and then performs an `admins` lookup with the server-only Supabase client.

## API

- `GET /api/products?category=roses`
- `POST /api/admin/session`
- `GET|POST /api/admin/{products|categories|orders|promo_codes|product_images}`
- `PATCH|DELETE /api/admin/{resource}/{id}`

Every admin endpoint requires `X-Telegram-Init-Data`. Keep database RLS enabled even though the secret client bypasses it: the API authorization layer is the intentional privileged boundary.

## Checks

```bash
npm test
npm run typecheck
npm run lint
npm run build
```

## Cloudflare Workers

The repository includes the official OpenNext adapter configuration for a full-stack Workers deployment.

```bash
npm run cf:build
npm run cf:preview
npm run cf:deploy
```

For Git-connected Workers Builds, use `npm run cf:build` as the build command and `npx wrangler deploy` as the deploy command. Add all five variables from `.env.example` under **Build variables and secrets**. Mark `SUPABASE_SECRET_KEY` and `TELEGRAM_BOT_TOKEN` as encrypted secrets; the two `NEXT_PUBLIC_` values must be available during the build as well as at runtime.

No secrets belong in Git. `.env*` is ignored except the placeholder-only `.env.example`.
