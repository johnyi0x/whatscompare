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
        The live catalog already stores <strong className="text-ink">multiple retailers per product</strong> (from Google
        Shopping immersive results). This page is reserved for a future UI that matches the same physical SKU across
        merchants using UPC/GTIN or manual grouping.
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
