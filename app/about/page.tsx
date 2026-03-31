import Link from "next/link";

export const metadata = { title: "How it works" };

export default function AboutPage() {
  return (
    <article className="mx-auto max-w-2xl space-y-10">
      <header className="space-y-2">
        <h1 className="font-display text-4xl font-semibold text-ink">How whatscompare works</h1>
        <p className="text-ink-muted">
          Electronics-first catalog: we <strong className="text-ink">stack price snapshots over time</strong> across
          Amazon and Best Buy, then compute deal scores and charts—value compounds as the daily cron runs.
        </p>
      </header>

      <section className="space-y-3 text-ink-muted">
        <h2 className="font-display text-xl font-semibold text-ink">Data model</h2>
        <ul className="list-inside list-disc space-y-2">
          <li>
            <strong className="text-ink">Product</strong> — curated SKU (seed title, category, brand, shopping query).
            After enrichment: canonical Amazon/Best Buy URLs, image, optional specs JSON, and{" "}
            <code className="text-ink">enrichmentCompletedAt</code>.
          </li>
          <li>
            <strong className="text-ink">ProductStoreListing</strong> — latest price, regular price, link per store.
          </li>
          <li>
            <strong className="text-ink">PriceSnapshot</strong> — <em>append-only</em> row per store on each refresh.
            Metrics and charts read from this history.
          </li>
          <li>
            <strong className="text-ink">ClaudeDailyUsage</strong> — estimated Claude spend per UTC calendar day for the
            configured budget cap.
          </li>
        </ul>
      </section>

      <section className="space-y-3 text-ink-muted">
        <h2 className="font-display text-xl font-semibold text-ink">Claude API — how we stay efficient</h2>
        <p>
          <strong className="text-ink">Enrichment (once per SKU):</strong> web search finds the correct PDPs, title, image,
          and a small specs object. That step incurs <strong className="text-ink">web search surcharges</strong> (per
          Anthropic pricing) plus tokens.
        </p>
        <p>
          <strong className="text-ink">Daily prices:</strong> we pass your saved Amazon/Best Buy URLs into{" "}
          <strong className="text-ink">web fetch</strong> so Claude reads those pages directly—extra tool charges are
          token-only for fetch today. Heavy JS sites may still be hard to read; later you can plug in Amazon / Best Buy
          official APIs in <code className="text-ink">lib/price-sources/official-prices.ts</code> (free within their
          quotas) and the cron will prefer those numbers when implemented.
        </p>
        <p>
          <strong className="text-ink">No API calls on page views.</strong> Only{" "}
          <code className="text-ink">GET /api/cron/sync-catalog</code> (Vercel Cron) runs ingest, stopped by{" "}
          <code className="text-ink">CLAUDE_DAILY_BUDGET_USD</code> (default $1/day).
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
          Horizontal bar chart (current prices), multi-line history chart (daily low per store), specs grid when
          enrichment returned structured fields, sorted buy links. Wrap URLs with your affiliate IDs where your programs
          allow.
        </p>
      </section>

      <p>
        <Link href="/search" className="font-medium text-accent hover:underline">
          Browse the catalog
        </Link>
      </p>
    </article>
  );
}
