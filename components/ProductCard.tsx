import Link from "next/link";
import type { Product, ProductStoreListing } from "@prisma/client";
import { displayLabelForStore, sortListingsAmazonFirstThenPrice } from "@/lib/retail-listings";
import { ProductImage } from "./ProductImage";
import { ProductPhotoWell } from "./ProductPhotoWell";

export type ProductCardModel = Product & { listings: ProductStoreListing[] };

function TrendArrow({ trend }: { trend: string | null }) {
  if (!trend) return null;
  const sym = trend === "dropping" ? "↓" : trend === "rising" ? "↑" : "→";
  const label = trend === "dropping" ? "Dropping" : trend === "rising" ? "Rising" : "Stable";
  return (
    <span className="text-xs font-medium text-accent" title={`Price trend: ${label}`}>
      {sym} {label}
    </span>
  );
}

export function ProductCard({ product }: { product: ProductCardModel }) {
  const listings = sortListingsAmazonFirstThenPrice([...product.listings]);
  const byPrice = [...product.listings].sort((a, b) => Number(a.currentPrice) - Number(b.currentPrice));
  const cheapest = byPrice[0];
  const amazon = product.listings.find((l) => l.store === "amazon");
  const primary = amazon ?? cheapest;
  const fmt = (n: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: product.currency }).format(n);

  const priceText = primary ? fmt(Number(primary.currentPrice)) : "Sync pending";
  const cheaperElsewhere =
    amazon &&
    cheapest &&
    cheapest.store !== "amazon" &&
    Number(cheapest.currentPrice) < Number(amazon.currentPrice);

  const img = product.imageUrl?.startsWith("http") ? product.imageUrl : null;

  return (
    <article className="group flex flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-sleek transition hover:border-accent/40 hover:shadow-lg dark:shadow-sleek-dark">
      <Link href={`/deals/${product.slug}`} className="block">
        <ProductPhotoWell hasImage={Boolean(img)}>
          {img ? (
            <ProductImage
              src={img}
              alt={product.title}
              className="h-full w-full object-contain transition duration-300 group-hover:scale-[1.02]"
            />
          ) : (
            <div className="flex h-full items-center justify-center px-4 text-center text-sm text-ink-muted">
              Image after first price sync
            </div>
          )}
        </ProductPhotoWell>
      </Link>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex flex-wrap items-center gap-2">
          {product.dealScorePercent != null && Number(product.dealScorePercent) > 0 ? (
            <span className="rounded-full bg-accent/15 px-2 py-0.5 text-xs font-semibold text-accent">
              {Number(product.dealScorePercent).toFixed(0)}% vs avg
            </span>
          ) : null}
          <TrendArrow trend={product.trendDirection} />
        </div>
        <Link href={`/deals/${product.slug}`} className="font-medium text-ink transition group-hover:text-accent">
          <h2 className="line-clamp-2 text-base leading-snug">{product.title}</h2>
        </Link>
        {product.brand ? <p className="text-xs text-ink-muted">{product.brand}</p> : null}
        {product.category ? <p className="text-xs text-ink-muted">{product.category}</p> : null}
        <p className="text-lg font-semibold tabular-nums text-ink">{priceText}</p>
        {primary ? (
          <p className="text-xs text-ink-muted">
            {amazon ? (
              <>
                <span className="font-medium text-accent">Amazon</span>
                {cheaperElsewhere && cheapest ? (
                  <>
                    {" "}
                    · lower at {displayLabelForStore(cheapest.store)} {fmt(Number(cheapest.currentPrice))}
                  </>
                ) : null}
                {listings.length > 1 ? ` · ${listings.length} stores` : null}
              </>
            ) : (
              <>
                From {displayLabelForStore(primary.store)} · {listings.length} store
                {listings.length !== 1 ? "s" : ""} tracked
              </>
            )}
          </p>
        ) : (
          <p className="text-xs text-ink-muted">Cron fills multi-store prices (not on page load).</p>
        )}
        <Link
          href={`/deals/${product.slug}`}
          className="mt-auto inline-flex justify-center rounded-lg bg-ink px-3 py-2.5 text-center text-sm font-medium text-white transition hover:opacity-90 dark:bg-slate-100 dark:text-slate-900"
        >
          Compare stores
        </Link>
      </div>
    </article>
  );
}
