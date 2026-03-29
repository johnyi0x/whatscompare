import Link from "next/link";

export const metadata = { title: "How it works" };

export default function AboutPage() {
  return (
    <article className="mx-auto max-w-2xl space-y-10">
      <header className="space-y-2">
        <h1 className="font-display text-4xl font-semibold text-ink">How whatscompare works</h1>
        <p className="text-ink-muted">
          Electronics-first catalog: we <strong className="text-ink">stack price snapshots over time</strong> across
          retailers surfaced by Google Shopping, then compute deal scores and charts—value compounds as the cron runs.
        </p>
      </header>

      <section className="space-y-3 text-ink-muted">
        <h2 className="font-display text-xl font-semibold text-ink">Data model</h2>
        <ul className="list-inside list-disc space-y-2">
          <li>
            <strong className="text-ink">Product</strong> — curated SKU (title, category, brand, tier, shopping query).
            The immersive <code className="text-ink">page_token</code> is stored after the first successful discovery.
          </li>
          <li>
            <strong className="text-ink">ProductStoreListing</strong> — latest price, regular price, rating, link per
            store (Amazon, Best Buy, etc.).
          </li>
          <li>
            <strong className="text-ink">PriceSnapshot</strong> — <em>append-only</em> row per store on every refresh.
            Metrics and charts read from this history.
          </li>
        </ul>
      </section>

      <section className="space-y-3 text-ink-muted">
        <h2 className="font-display text-xl font-semibold text-ink">SerpApi (paid) — how we stay efficient</h2>
        <p>
          We use <code className="text-ink">engine=google_shopping</code> to discover a product’s immersive token, then{" "}
          <code className="text-ink">engine=google_immersive_product</code> for multi-store prices. Identical parameters
          can hit SerpApi’s <strong className="text-ink">1h cache</strong> (cached searches are free and do not count the
          same way as fresh fetches—see SerpApi pricing docs).
        </p>
        <p>
          <strong className="text-ink">No API calls on page views.</strong> Only{" "}
          <code className="text-ink">GET /api/cron/sync-catalog</code> (Vercel Cron) runs ingest, capped by{" "}
          <code className="text-ink">SERPAPI_MAX_CALLS_PER_RUN</code> (default 8). Tier 1 / 2 / 3 controls how often a
          product is <em>eligible</em> for refresh (3h / 24h / 72h since last run); the cap spreads load across the month.
        </p>
      </section>

      <section className="space-y-3 text-ink-muted">
        <h2 className="font-display text-xl font-semibold text-ink">Computed metrics (after each refresh)</h2>
        <ul className="list-inside list-disc space-y-2">
          <li>
            <strong className="text-ink">Deal score</strong> — % below ~90d average of daily minimum prices.
          </li>
          <li>
            <strong className="text-ink">Trend</strong> — coarse rising / dropping / stable from recent daily mins.
          </li>
          <li>
            <strong className="text-ink">Cheapest store</strong> — which retailer most often had the low price across
            snapshots.
          </li>
          <li>
            <strong className="text-ink">Volatility</strong> — standard deviation of daily mins (higher = more swingy).
          </li>
          <li>
            <strong className="text-ink">Deal confidence</strong> — heuristic from how rare the current low is vs history.
          </li>
        </ul>
      </section>

      <section className="space-y-3 text-ink-muted">
        <h2 className="font-display text-xl font-semibold text-ink">Product page</h2>
        <p>
          Horizontal bar chart (current prices), multi-line history chart (daily low per store), sorted buy links. Wrap
          URLs with your affiliate IDs where your programs allow.
        </p>
      </section>

      <p>
        <Link href="/" className="font-medium text-accent hover:underline">
          ← Back home
        </Link>
      </p>
    </article>
  );
}
