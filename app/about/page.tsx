import Link from "next/link";

export const metadata = { title: "How it works" };

export default function AboutPage() {
  return (
    <article className="mx-auto max-w-2xl space-y-10">
      <header className="space-y-2">
        <h1 className="font-display text-4xl font-semibold text-ink">How WhatsCompare works</h1>
        <p className="text-ink-muted">
          Stack, data flow, and how often your database updates—useful if you run the site or extend it.
        </p>
      </header>

      <section className="space-y-3 text-ink-muted">
        <h2 className="font-display text-xl font-semibold text-ink">What gets stored</h2>
        <p>
          Products live in <strong className="text-ink">Postgres</strong> (e.g. Neon): merchants, product rows (title,
          brand, ASIN, slug), <strong className="text-ink">offers</strong> (price snapshot, currency, source, timestamps),
          optional <strong className="text-ink">price history</strong>, and editorial <strong className="text-ink">posts</strong>{" "}
          linked to products. Images for Amazon rows use the official{" "}
          <strong className="text-ink">AsinImage</strong> widget URL with your Associates tag when no custom image is set.
        </p>
      </section>

      <section className="space-y-3 text-ink-muted">
        <h2 className="font-display text-xl font-semibold text-ink">How often data updates</h2>
        <ul className="list-inside list-disc space-y-2">
          <li>
            <strong className="text-ink">Every Vercel production build:</strong> <code className="text-ink">prisma db seed</code>{" "}
            runs (upserts). It refreshes demo rows; it is not a full catalog crawl.
          </li>
          <li>
            <strong className="text-ink">Scheduled (Vercel Cron, Hobby):</strong> once per day,{" "}
            <code className="text-ink">/api/cron/sync-amazon</code> runs. If <code className="text-ink">PAAPI_*</code> keys
            and <code className="text-ink">AMAZON_PARTNER_TAG</code> are set, it calls Amazon Product Advertising API for
            ASINs in the DB and appends new offers + price history. If PA-API is not configured, the job logs{" "}
            <code className="text-ink">skipped</code> and does not fail the deploy.
          </li>
          <li>
            <strong className="text-ink">You:</strong> add or edit rows (Prisma Studio, SQL, or a future admin UI) anytime.
          </li>
        </ul>
      </section>

      <section className="space-y-3 text-ink-muted">
        <h2 className="font-display text-xl font-semibold text-ink">Affiliate links</h2>
        <p>
          Outbound product links use <code className="text-ink">https://www.amazon.com/dp/{"{ASIN}"}</code> with your{" "}
          <code className="text-ink">tag</code> and standard Associates query params (
          <code className="text-ink">linkCode=ll1</code>, etc.). Use the <strong className="text-ink">exact</strong> store ID
          from SiteStripe in <code className="text-ink">AMAZON_PARTNER_TAG</code> (including any{" "}
          <code className="text-ink">0</code> vs <code className="text-ink">O</code> in the string).
        </p>
      </section>

      <section className="space-y-3 text-ink-muted">
        <h2 className="font-display text-xl font-semibold text-ink">Tech stack</h2>
        <p>
          <strong className="text-ink">Next.js</strong> (App Router) on <strong className="text-ink">Vercel</strong>,{" "}
          <strong className="text-ink">Prisma</strong> + Postgres, search via <strong className="text-ink">pg_trgm</strong>. Same
          rough shape as other small Next apps you deploy to Vercel + a managed database.
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
