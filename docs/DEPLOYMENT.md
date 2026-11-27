# HAFFYE — Deployment & Operations Guide

HAFFYE is engineered to run **100% serverless on Vercel** with managed external services (Supabase + Midtrans + OpenStreetMap/Leaflet). No Express.js server, VPS, Docker container, or standalone WebSocket server is required.

## 1. Supabase Setup & Migrations
1. Create a Supabase project (choose a region near your users, e.g., `ap-southeast-1` Singapore).
2. In **SQL Editor**, run the migration files in strict order:
   1. `supabase/migrations/20260101000001_schema.sql`
   2. `supabase/migrations/20260101000002_functions.sql`
   3. `supabase/migrations/20260101000003_rls.sql`
   4. `supabase/migrations/20260101000004_grants.sql`
   5. Optional demo seeds: `supabase/seed.sql`, `supabase/seed_phase2.sql`, `supabase/seed_phase3.sql`.
3. In **Authentication → Sign In / Providers → Email**: ensure Email Signups are enabled.
4. In **Authentication → URL Configuration**: set **Site URL** to your production Vercel domain (`https://your-app.vercel.app`) and add `https://your-app.vercel.app/**` to Redirect URLs.
5. **Storage**: The `product-images` public bucket is created automatically when an admin uploads the first product image, or you can create a public bucket named `product-images` in **Storage**.

## 2. Midtrans Snap Sandbox Configuration
1. Sign in to https://dashboard.sandbox.midtrans.com.
2. Copy **Server Key** (`SB-Mid-server-...`) and **Client Key** (`SB-Mid-client-...`) from **Settings → Access Keys**.
3. Under **Settings → Configuration**:
   - Set **Payment Notification URL** to `https://your-app.vercel.app/api/payments/webhook`.
   - Set Finish / Unfinish / Error Redirect URLs to `https://your-app.vercel.app/customer/orders`.

## 3. Vercel Environment Variables
Add the following variables in **Vercel Project → Settings → Environment Variables**:

| Variable | Visibility | Notes |
|---|---|---|
| `NEXT_PUBLIC_APP_URL` | Public | `https://your-app.vercel.app` |
| `NEXT_PUBLIC_SUPABASE_URL` | Public | Supabase Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public | Supabase `anon` public key |
| `SUPABASE_SERVICE_ROLE_KEY` | **Server Only** | Never prefix with `NEXT_PUBLIC_` |
| `NEXT_PUBLIC_GPS_UPDATE_INTERVAL_SECONDS` | Public | Default `8` |
| `NEXT_PUBLIC_GPS_MAX_ACCURACY_METERS` | Public | Default `100` |
| `NEXT_PUBLIC_LOCATION_STALE_SECONDS` | Public | Default `60` |
| `MIDTRANS_SERVER_KEY` | **Server Only** | `SB-Mid-server-...` for Sandbox |
| `NEXT_PUBLIC_MIDTRANS_CLIENT_KEY` | Public | `SB-Mid-client-...` for Sandbox |
| `MIDTRANS_IS_PRODUCTION` | Server Only | `false` for Sandbox |
| `NEXT_PUBLIC_MIDTRANS_IS_PRODUCTION` | Public | `false` for Sandbox |
| `CRON_SECRET` | **Server Only** | Long random secret (Vercel sends `Authorization: Bearer <CRON_SECRET>`) |

## 4. Vercel Cron Jobs
`vercel.json` defines two cron routes:
- `/api/cron/cleanup-locations` — removes stale `vendor_locations` rows older than 15 minutes.
- `/api/cron/expire-payments` — checks overdue pending payments against Midtrans and releases unused vouchers.

> **Vercel Hobby vs Pro Note**: `vercel.json` is configured with daily schedules (`0 0 * * *` and `5 0 * * *`) so it deploys cleanly on the **Vercel Hobby** plan. On Vercel Pro, you may optionally tighten the schedule (e.g. `*/10 * * * *`). Note that stale vendor GPS locations are also flagged live in the UI after `NEXT_PUBLIC_LOCATION_STALE_SECONDS`, and overdue payments are checked live when customers open `/customer/orders/[id]`.

## 5. Production Validation Checklist
1. `npm run typecheck` — 0 TypeScript errors.
2. `npm run build` — production build succeeds across all routes (`/`, `/customer/*`, `/barista/*`, `/admin/*`, `/api/*`, `/manifest.webmanifest`, `/offline`).
3. `npm run test:verify` — verifies auth, RLS, privilege escalation guards, GPS triggers, Midtrans signature logic, order idempotency, and atomic `complete_order()` inventory deduction against your Supabase project.
4. In Chrome DevTools → **Application → Manifest & Service Workers**: verify `HAFFYE` is installable, `sw.js` is active, and `/api/*`, `/login`, `/customer/*`, `/barista/*`, `/admin/*` are excluded from cache.
