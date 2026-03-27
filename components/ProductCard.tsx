import Image from "next/image";
import Link from "next/link";
import type { Merchant, Offer, Product } from "@prisma/client";
import { buildAmazonProductUrl, getPartnerTagOrPlaceholder } from "@/lib/amazon-affiliate";
import { formatPriceDisclaimer } from "@/lib/format-price";

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

  const priceText = offer
    ? new Intl.NumberFormat("en-US", { style: "currency", currency: offer.currency }).format(
        Number(offer.priceAmount)
      )
    : "See Amazon";

  return (
    <article className="flex flex-col overflow-hidden rounded-xl border border-ink/10 bg-surface shadow-sm transition hover:border-accent/40">
      <Link href={`/deals/${product.slug}`} className="block">
        <div className="relative aspect-square bg-surface-subtle">
          {product.imageUrl ? (
            <Image
              src={product.imageUrl}
              alt={product.title}
              fill
              className="object-cover"
              sizes="(max-width: 640px) 100vw, 33vw"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-ink-muted">No image</div>
          )}
        </div>
      </Link>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <Link href={`/deals/${product.slug}`} className="font-medium text-ink hover:text-accent">
          <h2 className="line-clamp-2 text-base leading-snug">{product.title}</h2>
        </Link>
        {product.brand ? <p className="text-xs text-ink-muted">{product.brand}</p> : null}
        {offer?.dealLabel ? (
          <p className="text-xs font-medium text-accent">{offer.dealLabel}</p>
        ) : null}
        <p className="text-lg font-semibold text-ink">{priceText}</p>
        <p className="text-xs text-ink-muted">{formatPriceDisclaimer(offer)}</p>
        <a
          href={href}
          target="_blank"
          rel="sponsored noopener noreferrer"
          className="mt-auto inline-flex justify-center rounded-md bg-ink px-3 py-2 text-center text-sm font-medium text-white hover:bg-ink/90"
        >
          View on Amazon
        </a>
      </div>
    </article>
  );
}
