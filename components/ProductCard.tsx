import Link from "next/link";
import type { Merchant, Offer, Product } from "@prisma/client";
import { buildAmazonProductUrl, getPartnerTagOrPlaceholder, resolveProductImageUrl } from "@/lib/amazon-affiliate";
import { formatPriceDisclaimer } from "@/lib/format-price";
import { ProductImage } from "./ProductImage";

export type ProductCardModel = Product & {
  merchant: Merchant;
  offers: Offer[];
};

export function ProductCard({ product }: { product: ProductCardModel }) {
  const offer = product.offers[0];
  const tag = getPartnerTagOrPlaceholder();
  const href =
    offer?.affiliateUrl ??
    (product.merchant.slug === "amazon"
      ? buildAmazonProductUrl(product.externalId, { partnerTag: tag })
      : "#");

  const imgSrc = resolveProductImageUrl(product, tag);

  const priceText = offer
    ? new Intl.NumberFormat("en-US", { style: "currency", currency: offer.currency }).format(
        Number(offer.priceAmount)
      )
    : "See Amazon";

  return (
    <article className="group flex flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-sleek transition hover:border-accent/40 hover:shadow-lg dark:shadow-sleek-dark">
      <Link href={`/deals/${product.slug}`} className="block">
        <div className="relative aspect-square bg-surface-subtle">
          {imgSrc ? (
            <ProductImage
              src={imgSrc}
              alt={product.title}
              className="absolute inset-0 h-full w-full object-contain p-3 transition duration-300 group-hover:scale-[1.02]"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-ink-muted">No image</div>
          )}
        </div>
      </Link>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <Link href={`/deals/${product.slug}`} className="font-medium text-ink transition group-hover:text-accent">
          <h2 className="line-clamp-2 text-base leading-snug">{product.title}</h2>
        </Link>
        {product.brand ? <p className="text-xs text-ink-muted">{product.brand}</p> : null}
        {offer?.dealLabel ? <p className="text-xs font-medium text-accent">{offer.dealLabel}</p> : null}
        <p className="text-lg font-semibold tabular-nums text-ink">{priceText}</p>
        <p className="text-xs leading-relaxed text-ink-muted">{formatPriceDisclaimer(offer)}</p>
        <a
          href={href}
          target="_blank"
          rel="sponsored noopener noreferrer"
          className="mt-auto inline-flex justify-center rounded-lg bg-ink px-3 py-2.5 text-center text-sm font-medium text-white transition hover:opacity-90 dark:bg-slate-100 dark:text-slate-900"
        >
          View on Amazon
        </a>
      </div>
    </article>
  );
}
