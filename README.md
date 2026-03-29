# whatscompare

Next.js 14 (App Router) **electronics** deal site: Postgres stores a curated catalog, **append-only `PriceSnapshot` rows**, and **latest `ProductStoreListing`** per retailer. Ingest uses **SerpApi** [`google_shopping`](https://serpapi.com/google-shopping-api) + [`google_immersive_product`](https://serpapi.com/google-immersive-product-api) on a **cron only** (never per page view). Product pages use **Recharts** for store price bars and multi-line history.

## Stack

| Piece | Choice |
|--------|--------|
| Framework | Next.js 14 on Vercel |
| Database | Neon Postgres |
| ORM | Prisma |
| Search | `pg_trgm` + `similarity` on `Product` |
| Charts | `recharts` (client components) |
| Ingest | `GET /api/cron/sync-catalog` (see `vercel.json`) |

## Env

See `.env.example`. Important:

- `SERPAPI_API_KEY` — required for ingest.
- `SERPAPI_MAX_CALLS_PER_RUN` — default **8** (shopping + immersive each count as a request; tune to your monthly quota).
- `CRON_SECRET` — set in production so only Vercel Cron hits the route.

## Migrate + seed

```bash
npm install
npx prisma migrate deploy
npm run db:seed
```

Seed loads **36** curated electronics SKUs (`prisma/electronics-seed-data.ts`). Prices appear after cron runs immersive sync.

`RESET_CATALOG_ON_SEED=1` once clears products, listings, and snapshots (posts kept).

## Cron

- **Route:** `GET /api/cron/sync-catalog`
- **Schedule:** `0 9 * * *` (daily 09:00 UTC) — Hobby = one cron/day; increase frequency on Pro if needed.
- Tier **1 / 2 / 3** sets minimum hours between refreshes (**3h / 24h / 72h**); the **call cap** per run prevents burning the whole monthly quota in a day.

## API

- `GET /api/search?q=…` — JSON catalog search.

## Related

Flight deals: **`trip-finder`** / FlightDealio.
