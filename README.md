# whatscompare

Next.js 14 (App Router) **electronics** deal site: Postgres stores a curated catalog, **append-only `PriceSnapshot` rows**, and **latest `ProductStoreListing`** per retailer (Amazon and Best Buy). Ingest uses the **Claude API** on a **cron only** (never per page view): **one-time-style enrichment** per SKU (web search → title, image, both PDP URLs, specs JSON) and **daily price refresh** (prefer **web fetch** on those URLs so you mostly pay token costs; official retailer APIs can be wired in later without changing the shape of the pipeline). Product pages use **Recharts** for store price bars and multi-line history.

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

- `ANTHROPIC_API_KEY` — required for ingest (set on Vercel).
- `CLAUDE_DAILY_BUDGET_USD` — default **1** (USD); cron stops when estimated spend for the UTC day reaches the cap (tokens + web search surcharges).
- `CRON_SECRET` — set in production so only Vercel Cron hits the route.

Tune `CLAUDE_INPUT_USD_PER_MT` / `CLAUDE_OUTPUT_USD_PER_MT` to the model you set in `CLAUDE_MODEL` so the budget ledger matches your bill.

## Migrate + seed

```bash
npm install
npx prisma migrate deploy
npm run db:seed
```

Seed loads **36** curated electronics SKUs (`prisma/electronics-seed-data.ts`). Enrichment and prices appear after the cron runs.

`RESET_CATALOG_ON_SEED=1` optionally clears products, listings, and snapshots again (posts kept). The migration `20260331120000_claude_catalog_reset` already wiped the catalog **once** when applied.

## Cron

- **Route:** `GET /api/cron/sync-catalog`
- **Schedule:** `0 9 * * *` (daily 09:00 UTC) — adjust in `vercel.json` if needed.
- Pending SKUs are **enriched** until `enrichmentCompletedAt` is set (requires valid Amazon + Best Buy PDP URLs, title, and `https` image). Enriched SKUs are **price-refreshed** in batches; spend is recorded in `ClaudeDailyUsage` per UTC day.

## API

- `GET /api/search?q=…` — JSON catalog search.

## Related

Flight deals: **`trip-finder`** / FlightDealio.
