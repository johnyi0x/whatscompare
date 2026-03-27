import Link from "next/link";

/**
 * Phase 2 placeholder: cross-merchant compare needs stable keys (UPC/GTIN, brand+model) and Offer rows
 * per merchant. Schema already has `merchantId` + `externalId` on Product for that seam.
 */
export default function CompareStubPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="font-display text-3xl font-semibold text-ink">Cross-store compare</h1>
      <p className="text-ink-muted">
        MVP ships Amazon-only search and deals. The database is modeled with <code className="rounded bg-surface-subtle px-1">Merchant</code>,{" "}
        <code className="rounded bg-surface-subtle px-1">Product</code> (per-store <code className="rounded bg-surface-subtle px-1">externalId</code>), and{" "}
        <code className="rounded bg-surface-subtle px-1">Offer</code> so we can add Best Buy (or others) and later map
        equivalent products for side-by-side price.
      </p>
      <p className="text-sm text-ink-muted">
        Next steps: ingest a second merchant feed, add optional <code className="rounded bg-surface-subtle px-1">ProductMatch</code> or UPC column, then
        replace this page with a real compare UI.
      </p>
      <Link href="/search" className="inline-flex text-sm font-medium text-accent hover:underline">
        ← Back to search
      </Link>
    </div>
  );
}
