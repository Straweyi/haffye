# HAFFYE — Coffee on the Move.

Smart mobile coffee platform built with **Next.js App Router**, **TypeScript**, **Tailwind CSS**, **Leaflet + OpenStreetMap**, **Supabase** (PostgreSQL + Auth + RLS + Realtime + Storage), and **Midtrans Snap**, designed to deploy 100% serverless on **Vercel** as an installable **PWA**.

## Application Portals
- **Customer (`/customer`)**: Nearby cart discovery (GPS + manual pin + configurable radius), live Leaflet map with Supabase Realtime updates, customizable product catalog, persistent cart, Midtrans Snap checkout, live order tracking, transaction history, loyalty points & voucher redemption, and product reviews.
- **Barista (`/barista`)**: Operational status control (`OFFLINE` / `ACTIVE` / `BUSY` / `PAUSED`), server-validated live GPS broadcaster, real-time incoming order queue & status transitions, atomic recipe inventory deduction on completion, per-cart menu availability toggles, stock movement logging, and revenue tracking.
- **Admin (`/admin`)**: Real-time fleet map, database-driven sales analytics & charts, customer/barista/vendor management, product/category/image management, raw ingredients & recipe allocation, order/payment monitoring, promotions/vouchers, loyalty adjustments, CSV report exports, audit logs, and runtime settings.

## Documentation
- Architecture & ERD: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- Deployment & Operations Guide: [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)

## Quick Start
1. `npm install`
2. Run migrations `supabase/migrations/20260101000001_schema.sql` through `...00004_grants.sql` in Supabase SQL Editor (plus optional `seed.sql`, `seed_phase2.sql`, `seed_phase3.sql`).
3. Copy `.env.example` to `.env.local` (or `.env`) and fill in Supabase, Midtrans Sandbox, and `CRON_SECRET` keys.
4. Run development server: `npm run dev`

## Available Scripts
- `npm run dev` — start Next.js development server
- `npm run typecheck` — run `tsc --noEmit`
- `npm run build` — build production bundle
- `npm run test:verify` — run end-to-end integration & security verification against Supabase

## Environment Variables
| Variable | Scope | Purpose |
|---|---|---|
| `NEXT_PUBLIC_APP_URL` | Public | Base URL for auth redirects & webhook display |
| `NEXT_PUBLIC_SUPABASE_URL` / `_ANON_KEY` | Public | Supabase client & Realtime |
| `SUPABASE_SERVICE_ROLE_KEY` | **Server only** | Server-side checkout, webhooks, admin user creation |
| `NEXT_PUBLIC_GPS_UPDATE_INTERVAL_SECONDS` | Public | Barista GPS broadcast interval (default `8`) |
| `NEXT_PUBLIC_GPS_MAX_ACCURACY_METERS` | Public | Max accepted GPS accuracy in meters (default `100`) |
| `NEXT_PUBLIC_LOCATION_STALE_SECONDS` | Public | Stale location warning threshold (default `60`) |
| `MIDTRANS_SERVER_KEY` | **Server only** | Midtrans Snap & Status API auth |
| `NEXT_PUBLIC_MIDTRANS_CLIENT_KEY` | Public | Midtrans Snap.js client key |
| `MIDTRANS_IS_PRODUCTION` / `NEXT_PUBLIC_MIDTRANS_IS_PRODUCTION` | Server / Public | `false` for Sandbox |
| `CRON_SECRET` | **Server only** | Protects `/api/cron/*` endpoints |
