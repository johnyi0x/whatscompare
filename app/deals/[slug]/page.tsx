import Link from "next/link";
import { notFound } from "next/navigation";
import { ProductImage } from "@/components/ProductImage";
import { buildAmazonProductUrl, getPartnerTagOrPlaceholder, resolveProductImageUrl } from "@/lib/amazon-affiliate";
import { formatPriceDisclaimer } from "@/lib/format-price";
import { prisma } from "@/lib/prisma";

type Props = { params: { slug: string } };

export async function generateMetadata({ params }: Props) {
  const product = await prisma.product.findUnique({ where: { slug: params.slug } });
  if (!product) return { title: "Deal not found" };
  return { title: product.title };
}

export default async function DealDetailPage({ params }: Props) {
  const product = await prisma.product.findUnique({
    where: { slug: params.slug },
    include: {
      merchant: true,
      offers: { orderBy: { fetchedAt: "desc" }, take: 1 },
      priceHistory: { orderBy: { recordedAt: "desc" }, take: 14 },
    },
  });

  if (!product) notFound();

  const offer = product.offers[0];
  const tag = getPartnerTagOrPlaceholder();
  const affiliateHref =
    offer?.affiliateUrl ??
    (product.merchant.slug === "amazon" ? buildAmazonProductUrl(product.externalId, { partnerTag: tag }) : null);

  const heroImg = resolveProductImageUrl(product, tag);

  const priceText = offer
    ? new Intl.NumberFormat("en-US", { style: "currency", currency: offer.currency }).format(
        Number(offer.priceAmount)
      )
    : null;

  const listText =
    offer?.listPriceAmount != null
      ? new Intl.NumberFormat("en-US", { style: "currency", currency: offer.currency }).format(
          Number(offer.listPriceAmount)
        )
      : null;

  return (
    <article className="space-y-8">
      <nav className="text-sm text-ink-muted">
        <Link href="/search" className="hover:text-ink">
          Search
        </Link>
        <span className="mx-2">/</span>
        <span className="text-ink">{product.title}</span>
      </nav>

      <div className="grid gap-10 lg:grid-cols-2">
        <div className="relative aspect-square overflow-hidden rounded-2xl border border-line bg-surface-subtle">
          {heroImg ? (
            <ProductImage
              src={heroImg}
              alt={product.title}
              priority
              className="absolute inset-0 h-full w-full object-contain p-4"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-ink-muted">No image on file</div>
          )}
        </div>

        <div className="space-y-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">{product.merchant.name}</p>
          <h1 className="font-display text-3xl font-semibold leading-tight text-ink">{product.title}</h1>
          {product.brand ? <p className="text-sm text-ink-muted">Brand: {product.brand}</p> : null}
          {product.categoryPath ? <p className="text-sm text-ink-muted">{product.categoryPath}</p> : null}

          <div className="rounded-xl border border-line bg-surface p-5 shadow-sleek dark:shadow-sleek-dark">
            {priceText ? (
              <div className="flex flex-wrap items-baseline gap-3">
                <p className="text-3xl font-bold text-ink">{priceText}</p>
                {listText ? <p className="text-sm text-ink-muted line-through">{listText}</p> : null}
              </div>
            ) : (
              <p className="text-lg text-ink-muted">Open Amazon to see the current price.</p>
            )}
            <p className="mt-2 text-sm text-ink-muted">{formatPriceDisclaimer(offer)}</p>
            <p className="mt-1 text-xs text-ink-muted">
              ASIN: {product.externalId} · Source: {offer?.source ?? "n/a"} · Image: {product.imageSource ?? "n/a"}
            </p>
            {affiliateHref ? (
              <a
                href={affiliateHref}
                target="_blank"
                rel="sponsored noopener noreferrer"
                className="mt-4 inline-flex w-full justify-center rounded-md bg-accent px-4 py-3 text-center text-sm font-semibold text-white hover:bg-accent-hover lg:w-auto"
              >
                Check price on Amazon
              </a>
            ) : (
              <p className="mt-4 text-sm text-ink-muted">Affiliate link unavailable for this merchant.</p>
            )}
          </div>

          {product.description ? (
            <div className="prose prose-sm max-w-none text-ink-muted dark:prose-invert">
              <p>{product.description}</p>
            </div>
          ) : null}
        </div>
      </div>

      {product.priceHistory.length > 1 ? (
        <section className="space-y-3">
          <h2 className="font-display text-xl font-semibold text-ink">Recent price snapshots</h2>
          <ul className="grid gap-2 sm:grid-cols-2">
            {product.priceHistory.map((row) => (
              <li
                key={row.id}
                className="flex justify-between rounded-md border border-line bg-surface-subtle px-3 py-2 text-sm"
              >
                <span className="text-ink-muted">{row.recordedAt.toLocaleDateString()}</span>
                <span className="font-medium text-ink">
                  {new Intl.NumberFormat("en-US", { style: "currency", currency: row.currency }).format(
                    Number(row.priceAmount)
                  )}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </article>
  );
}
