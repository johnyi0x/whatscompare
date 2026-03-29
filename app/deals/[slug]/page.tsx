import Link from "next/link";
import { notFound } from "next/navigation";
import { ProductCharts } from "@/components/ProductCharts";
import { ProductImage } from "@/components/ProductImage";
import { affiliateOutboundUrl } from "@/lib/affiliate-url";
import { buildMultiStoreLineSeries } from "@/lib/chart-data";
import { prisma } from "@/lib/prisma";
import { ALLOWED_RETAIL_KEYS, displayLabelForStore, sortListingsAmazonFirstThenPrice } from "@/lib/retail-listings";
import { ProductPhotoWell } from "@/components/ProductPhotoWell";

type Props = { params: { slug: string } };

export async function generateMetadata({ params }: Props) {
  const product = await prisma.product.findUnique({ where: { slug: params.slug } });
  if (!product) return { title: "Not found" };
  return { title: product.title };
}

export default async function DealDetailPage({ params }: Props) {
  const product = await prisma.product.findUnique({
    where: { slug: params.slug },
    include: {
      listings: { orderBy: { currentPrice: "asc" } },
    },
  });

  if (!product) notFound();

  const since = new Date(Date.now() - 120 * 24 * 60 * 60 * 1000);
  const snapshots = await prisma.priceSnapshot.findMany({
    where: {
      productId: product.id,
      recordedAt: { gte: since },
      store: { in: [...ALLOWED_RETAIL_KEYS] },
    },
    orderBy: { recordedAt: "asc" },
    take: 8000,
  });

  const { storeKeys, points } = buildMultiStoreLineSeries(snapshots);

  const listingsSorted = sortListingsAmazonFirstThenPrice(product.listings);
  const minP =
    listingsSorted.length > 0
      ? Math.min(...listingsSorted.map((l) => Number(l.currentPrice)))
      : null;
  const barData = listingsSorted.map((l) => ({
    name: l.storeLabel ?? displayLabelForStore(l.store),
    price: Number(l.currentPrice),
    isLow: minP != null && Number(l.currentPrice) === minP,
  }));

  const img = product.imageUrl?.startsWith("http") ? product.imageUrl : null;

  return (
    <article className="space-y-10">
      <nav className="text-sm text-ink-muted">
        <Link href="/search" className="hover:text-ink">
          Catalog
        </Link>
        <span className="mx-2">/</span>
        <span className="text-ink">{product.title}</span>
      </nav>

      <div className="grid gap-10 lg:grid-cols-2">
        <ProductPhotoWell hasImage={Boolean(img)} className="rounded-2xl border border-line">
          {img ? (
            <ProductImage src={img} alt={product.title} priority className="h-full w-full object-contain" />
          ) : (
            <div className="flex h-full items-center justify-center text-ink-muted">Image after first sync</div>
          )}
        </ProductPhotoWell>

        <div className="space-y-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-accent">Electronics · multi-store</p>
          <h1 className="font-display text-3xl font-semibold leading-tight text-ink">{product.title}</h1>
          {product.brand ? <p className="text-sm text-ink-muted">{product.brand}</p> : null}
          {product.category ? <p className="text-sm text-ink-muted">{product.category}</p> : null}

          <div className="flex flex-wrap gap-2">
            {product.dealScorePercent != null && Number(product.dealScorePercent) > 0 ? (
              <span className="rounded-full bg-accent/15 px-3 py-1 text-sm font-semibold text-accent">
                {Number(product.dealScorePercent).toFixed(0)}% below recent average
              </span>
            ) : null}
            {product.trendDirection ? (
              <span className="rounded-full border border-line px-3 py-1 text-sm text-ink-muted">
                Trend: {product.trendDirection}
              </span>
            ) : null}
            {product.dealConfidence ? (
              <span className="rounded-full border border-line px-3 py-1 text-sm text-ink-muted">
                Deal confidence: {product.dealConfidence}
              </span>
            ) : null}
            {product.volatilityScore != null ? (
              <span className="rounded-full border border-line px-3 py-1 text-sm text-ink-muted">
                Volatility (stdev): {Number(product.volatilityScore).toFixed(2)}
              </span>
            ) : null}
          </div>

          {product.cheapestStoreMostOften && product.cheapestStoreWinPct != null ? (
            <p className="text-sm text-ink-muted">
              Over recent history,{" "}
              <span className="font-medium text-ink">{displayLabelForStore(product.cheapestStoreMostOften)}</span> most
              often had the lowest price we recorded ({Number(product.cheapestStoreWinPct).toFixed(0)}% of the time). This
              improves as we collect more checks.
            </p>
          ) : null}

          <div className="rounded-xl border border-line bg-surface p-5 shadow-sleek dark:shadow-sleek-dark">
            <h2 className="font-display text-lg font-semibold text-ink">Where to buy</h2>
            <p className="mt-1 text-sm text-ink-muted">
              Live links to Amazon, Best Buy, and Walmart. We compare full purchase prices from these retailers when
              available.
            </p>
            <ul className="mt-4 space-y-2">
              {listingsSorted.map((l) => (
                <li key={l.id}>
                  <a
                    href={affiliateOutboundUrl(l.store, l.storeUrl)}
                    target="_blank"
                    rel="nofollow sponsored noopener noreferrer"
                    className={`flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm transition hover:border-accent ${
                      minP != null && Number(l.currentPrice) === minP ? "border-accent/50 bg-accent/5" : "border-line"
                    }`}
                  >
                    <span className="font-medium text-ink">
                      {l.store === "amazon" ? (
                        <span className="text-accent">Amazon</span>
                      ) : (
                        (l.storeLabel ?? displayLabelForStore(l.store))
                      )}
                      {l.listingCondition && l.listingCondition !== "unknown" ? (
                        <span className="ml-2 rounded bg-surface-subtle px-1.5 py-0.5 text-[10px] font-normal uppercase tracking-wide text-ink-muted">
                          {l.listingCondition}
                        </span>
                      ) : null}
                    </span>
                    <span className="tabular-nums font-semibold text-ink">
                      {new Intl.NumberFormat("en-US", { style: "currency", currency: product.currency }).format(
                        Number(l.currentPrice)
                      )}
                    </span>
                  </a>
                </li>
              ))}
            </ul>
            {listingsSorted.length === 0 ? (
              <p className="mt-2 text-sm text-ink-muted">No store rows yet—wait for the next catalog cron run.</p>
            ) : null}
          </div>
        </div>
      </div>

      <ProductCharts barData={barData} linePoints={points} storeKeys={storeKeys} />

      <p className="text-xs text-ink-muted">
        Last refreshed: {product.lastRefreshedAt ? product.lastRefreshedAt.toLocaleString() : "never"} · Append-only
        snapshots power charts and deal scores.
      </p>
    </article>
  );
}
