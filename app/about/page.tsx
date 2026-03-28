import Link from "next/link";

export const metadata = { title: "How it works" };

export default function AboutPage() {
  return (
    <article className="mx-auto max-w-2xl space-y-10">
      <header className="space-y-2">
        <h1 className="font-display text-4xl font-semibold text-ink">How WhatsCompare works</h1>
        <p className="text-ink-muted">
          Product data flow, APIs, and intervals—framed like a market data stack (similar idea to indexing exchange
          feeds), but for retail offers.
        </p>
      </header>

      <section className="space-y-3 text-ink-muted">
        <h2 className="font-display text-xl font-semibold text-ink">There is no magic “deals API” in the MVP</h2>
        <p>
          Amazon does not give a public “stream all deals” WebSocket like a crypto exchange. What you have is:{" "}
          <strong className="text-ink">your Postgres database</strong> as the source of truth, plus optional{" "}
          <strong className="text-ink">Amazon PA-API / Creators API</strong> when your account meets Amazon’s eligibility
          rules (often including qualifying sales). Optionally, a <strong className="text-ink">paid third-party API</strong>{" "}
          (SerpApi) can refresh catalog snapshots from the server only—never on every page view. The public site does not
          scrape Amazon HTML (that violates their terms and breaks often).
        </p>
      </section>

      <section className="space-y-3 text-ink-muted">
        <h2 className="font-display text-xl font-semibold text-ink">What we store (schema mental model)</h2>
        <ul className="list-inside list-disc space-y-2">
          <li>
            <strong className="text-ink">Merchant</strong> — e.g. <code className="text-ink">amazon</code> (later: Best Buy,
            etc.).
          </li>
          <li>
            <strong className="text-ink">Product</strong> — one row per catalog item at that merchant: ASIN, title, brand,
            slug, optional description. This is like a perpetual “instrument id” in trading.
          </li>
          <li>
            <strong className="text-ink">Offer</strong> — a <em>snapshot</em>: price, currency, list price, deal label,
            <code className="text-ink">fetchedAt</code>, <code className="text-ink">source</code> (
            <code className="text-ink">seed</code> | <code className="text-ink">pa_api</code> |{" "}
            <code className="text-ink">serpapi</code> | manual). New snapshots append;
            the UI usually shows the latest.
          </li>
          <li>
            <strong className="text-ink">PriceHistory</strong> — optional time series of past snapshots (good for “was $X”
            charts—like OHLC but simpler).
          </li>
          <li>
            <strong className="text-ink">Post / PostProduct</strong> — editorial roundups linking many products.
          </li>
        </ul>
      </section>

      <section className="space-y-3 text-ink-muted">
        <h2 className="font-display text-xl font-semibold text-ink">How data gets in today</h2>
        <ol className="list-inside list-decimal space-y-2">
          <li>
            <strong className="text-ink">Seed (every production build):</strong>{" "}
            <code className="text-ink">prisma db seed</code> upserts a small curated set of real ASINs with{" "}
            <strong className="text-ink">reference prices</strong> (not live). That’s why prices can drift from Lightning
            Deals / sales until PA-API runs.
          </li>
          <li>
            <strong className="text-ink">Images:</strong> the UI loads{" "}
            <code className="text-ink">/api/amazon-img?asin=…</code>, which fetches Amazon’s AsinImage JPEG on the{" "}
            <strong className="text-ink">server</strong> (browsers often block the widget URL directly). If Amazon returns
            403/404, the image fails until ASIN/tag is fixed.
          </li>
          <li>
            <strong className="text-ink">PA-API / Creators path (optional):</strong> the same daily cron can call Amazon’s
            API when <code className="text-ink">PAAPI_*</code> is set and your account is eligible. Amazon is moving toward{" "}
            <a
              className="text-accent underline"
              href="https://affiliate-program.amazon.com/creatorsapi/docs/en-us/introduction"
              rel="noopener noreferrer"
              target="_blank"
            >
              Creators API
            </a>
            ; confirm current rules in their docs.
          </li>
          <li>
            <strong className="text-ink">SerpApi refresh (optional, paid 3rd party):</strong> if you are not yet eligible for
            PA-API, you can set <code className="text-ink">SERPAPI_API_KEY</code>. The cron refreshes only a{" "}
            <em>small capped batch</em> of stale Amazon products per run (TTL + max per run), writes{" "}
            <code className="text-ink">source=serpapi</code>, and sets <code className="text-ink">serpapiSyncedAt</code> so we
            do not call the API on every visitor. Product pages still read <strong className="text-ink">only Postgres</strong>.
            Not an official Amazon feed—verify prices on Amazon before purchase.
          </li>
        </ol>
      </section>

      <section className="space-y-3 text-ink-muted">
        <h2 className="font-display text-xl font-semibold text-ink">Crypto analogy (Hyperliquid-style mindset)</h2>
        <p>
          Think of <strong className="text-ink">Product</strong> as the contract symbol, <strong className="text-ink">Offer</strong>{" "}
          as the last trade print, and <strong className="text-ink">PriceHistory</strong> as your stored ticks. Ingest job =
          cron hitting PA-API (or future merchant feeds). Normalization = mapping each feed into the same columns. Downstream
          = search ranking, deal badges, cross-retailer compare (phase 2). The polish you want is mostly: better ingest
          frequency, dedupe, and alerting when price moves X%.
        </p>
      </section>

      <section className="space-y-3 text-ink-muted">
        <h2 className="font-display text-xl font-semibold text-ink">Affiliate links</h2>
        <p>
          Links are <code className="text-ink">https://www.amazon.com/dp/{"{ASIN}"}?tag=…&linkCode=ll1&language=en_US</code>.
          Your <code className="text-ink">AMAZON_PARTNER_TAG</code> must match SiteStripe exactly.
        </p>
      </section>

      <section className="space-y-3 text-ink-muted">
        <h2 className="font-display text-xl font-semibold text-ink">Tech stack</h2>
        <p>
          Next.js (App Router) on Vercel, Prisma + Postgres, full-text-ish search with pg_trgm. Same deployment pattern as
          other small data-backed apps.
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
