# whatscompare

Next.js 14 (App Router) product deal finder for **whatscompare.com**: Postgres-backed catalog, search (pg_trgm + similarity), deal detail pages, editorial “posts” with embedded products, Amazon affiliate links, optional **PA-API 5 / Creators API** sync when eligible, and optional **SerpApi Amazon Product** ingest (paid third party) when PA-API is unavailable—all via Vercel Cron; **pages never call those APIs**.

## Stack choices

| Piece | Choice | Why |
|--------|--------|-----|
| Framework | Next.js 14 on Vercel | Same pattern as your flight project; SSR for SEO-friendly deal pages. |
| Database | **Neon** Postgres (recommended) | Serverless Postgres, generous free tier, simple pooling with Vercel. **Supabase** is an equally good alternative if you want a dashboard + optional Auth later. |
| ORM | Prisma | Migrations in Git; type-safe queries. |
| Search (MVP) | `pg_trgm` + `similarity` | One bill, no Algolia yet; upgrade path documented below. |
| Cron | Vercel Cron → `/api/cron/sync-amazon` | Secured with `CRON_SECRET`; documented schedule in `vercel.json`. |

## First-time checklist

### 1. GitHub

1. Create a new repository (e.g. `whatscompare`).
2. Push this folder:

```bash
cd whatscompare
git init
git add .
git commit -m "Initial WhatsCompare MVP"
git remote add origin <your-repo-url>
git push -u origin main
```

### 2. Neon (Postgres)

1. Sign up at [https://neon.tech](https://neon.tech).
2. Create a project and database.
3. Copy the **pooled** connection string (compatible with serverless).
4. Enable extensions: the migration runs `CREATE EXTENSION IF NOT EXISTS pg_trgm` (Neon allows this on non‑deprecated compute).

### 3. Environment variables

Copy `.env.example` to `.env` locally and set:

- `DATABASE_URL` — Neon **pooled** connection string (hostname contains `-pooler`). Optional: append `&connect_timeout=30` if the DB was idle and the first connection times out.
- `DIRECT_URL` — Neon **direct** connection string (same Connect dialog in the Neon console, **turn Connection pooling OFF**). Prisma uses this for `migrate` / `seed`, which avoids flaky **P1001** errors through the pooler on some networks. If you are not using Neon’s pooler split, set `DIRECT_URL` to the **same** value as `DATABASE_URL`.
- `NEXT_PUBLIC_SITE_URL` — `http://localhost:3000` locally; `https://whatscompare.com` in production.
- `AMAZON_PARTNER_TAG` — your Associates store ID / tracking ID (locale-specific).
- `CRON_SECRET` — long random string (production).
- Optional PA-API: `PAAPI_ACCESS_KEY`, `PAAPI_SECRET_KEY`, and optionally `PAAPI_HOST`, `PAAPI_REGION`, `PAAPI_MARKETPLACE` (defaults target US Product Advertising API host).

**Amazon API note:** PA-API is being superseded by **Creators API**; eligibility often includes qualifying sales (see [Amazon’s Creators API docs](https://affiliate-program.amazon.com/creatorsapi/docs/en-us/introduction)). If you are not eligible, leave `PAAPI_*` empty—the daily cron still runs and logs `skipped`.

- Optional **SerpApi** (third party, billable): `SERPAPI_API_KEY`, plus optional `SERPAPI_AMAZON_DOMAIN`, `SERPAPI_LANGUAGE`, `SERPAPI_REFRESH_HOURS` (default 48), `SERPAPI_MAX_PER_RUN` (default 5, cap 25), `SERPAPI_REQUEST_DELAY_MS` (default 400). Ingest writes `Offer` / `PriceHistory` with `source=serpapi` and updates `Product.serpapiSyncedAt` so the same ASIN is not refetched until stale. This is **not** an official Amazon API; read [SerpApi’s Amazon Product API](https://serpapi.com/amazon-product-api) for pricing and terms.

### 4. Prisma migrate + seed

```bash
npm install
npx prisma migrate deploy
npm run db:seed
```

**Vercel:** `npm run build` already runs migrate + seed. Seed upserts at least **five Amazon ASIN stubs** (your `INGEST_ASINS` plus defaults). If `SERPAPI_API_KEY` is set and the DB has **no ingest-visible products** yet, seed also calls SerpApi for up to **five** of those stubs so the homepage isn’t empty before the first cron. Disable with `SERPAPI_BOOTSTRAP_ON_SEED=0`. One-time wipe: `RESET_CATALOG_ON_SEED=1` for a single deploy, then remove it.

For local iterative schema tweaks without migration files:

```bash
npx prisma db push
```

### 5. Vercel

1. Import the GitHub repo in [Vercel](https://vercel.com).
2. Add the same environment variables (including `DATABASE_URL`, **`DIRECT_URL`**, `AMAZON_PARTNER_TAG`, `CRON_SECRET`, `NEXT_PUBLIC_SITE_URL`). On Vercel you can set `DIRECT_URL` equal to `DATABASE_URL` if you use a single URL.
3. Deploy. The **`build`** script runs **`prisma migrate deploy`** then **`prisma db seed`** so sample products exist in production (homepage + search work out of the box). Cron jobs from `vercel.json` apply to **production** deployments on [supported plans](https://vercel.com/docs/cron-jobs).

**Local vs Vercel:** Connection errors on your laptop (VPN, ISP, antivirus, `channel_binding`, password typos) are **local to that machine**. Vercel’s build and serverless runtime use **different networks**; reaching Neon is **usually more reliable** there—as long as env vars are correct.

### 6. Amazon Associates

1. Complete enrollment for your target country’s Associates program.
2. Use only approved link formats and your **assigned** tracking ID in `AMAZON_PARTNER_TAG`.
3. Read `COMPLIANCE.md` and the **live** Operating Agreement / Policies on Amazon’s site.

## Scripts

| Command | Purpose |
|---------|---------|
| `npm run dev` | Local dev server |
| `npm run build` | `prisma generate` + production build |
| `npm run db:migrate` | `prisma migrate deploy` (CI/production) |
| `npm run db:seed` | Seed Amazon merchant, sample products, one post |
| `npm run db:studio` | Prisma Studio |

## Cron: what runs, how often, limits

- **Route:** `GET /api/cron/sync-amazon` (single Hobby cron in `vercel.json`)
- **Schedule:** `0 9 * * *` (once daily at **09:00 UTC**) — **Vercel Hobby allows at most one cron run per day**; use Pro if you need more frequent runs (e.g. every 6 hours).
- **Auth:** If `CRON_SECRET` is set, requests must include `Authorization: Bearer <CRON_SECRET>` (Vercel Cron does this automatically when the var exists).
- **Behavior:** (1) PA-API `GetItems` for all Amazon ASINs when `PAAPI_*` are set. (2) **SerpApi** refresh for products with `serpapiSyncedAt` null or older than `SERPAPI_REFRESH_HOURS`, up to `SERPAPI_MAX_PER_RUN` per run, when `SERPAPI_API_KEY` is set. Both write to Postgres; **user-facing routes only read the database** (except `/api/amazon-img`, which proxies Amazon’s image URL). Logs separate `SyncJobLog` rows: `sync-amazon-paapi`, `sync-serpapi`.
- **Optional manual SerpApi-only hit:** `GET /api/cron/sync-serpapi` with the same `Authorization` header (useful for testing or an extra Pro cron).
- **Failure handling:** Partial errors are stored in log `detail`; HTTP 500 only on thrown exceptions. Missing keys return 200 with `skipped` so cron does not retry as a hard failure.

**Rate limits:** Respect [PA-API throttles](https://webservices.amazon.com/paapi5/documentation/troubleshooting/api-rates.html). For SerpApi, keep `SERPAPI_MAX_PER_RUN` and `SERPAPI_REFRESH_HOURS` conservative to control cost; see SerpApi pricing and cache behavior.

## API

- `GET /api/search?q=kindle` — JSON search results (for future mobile/widgets).

## Phase 2 seams

- **Merchants:** Add rows to `Merchant` (e.g. `bestbuy`) and ingest separate product feeds.
- **Matching:** Add UPC/GTIN (or a `ProductGroup` table) to relate Amazon vs other retailers; see stub page `/compare`.
- **Search scale:** Move to Meilisearch, Typesense, or Algolia if catalog size or latency outgrows Postgres.

## Domain: whatscompare.com

Point DNS to Vercel and set the project domain. Retire WordPress when this app is live and redirects (if any) are planned.

## Related project

Flight deals remain in **`trip-finder`** / FlightDealio; this repo is scoped to whatscompare only.
