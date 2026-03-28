import Link from "next/link";
import { notFound } from "next/navigation";
import ReactMarkdown from "react-markdown";
import { ProductImage } from "@/components/ProductImage";
import { buildAmazonProductUrl, getPartnerTagOrPlaceholder, resolveProductImageUrl } from "@/lib/amazon-affiliate";
import { formatPriceDisclaimer } from "@/lib/format-price";
import { prisma } from "@/lib/prisma";

type Props = { params: { slug: string } };

export async function generateMetadata({ params }: Props) {
  const post = await prisma.post.findUnique({ where: { slug: params.slug } });
  if (!post) return { title: "Post not found" };
  return { title: post.title };
}

export default async function PostDetailPage({ params }: Props) {
  const post = await prisma.post.findUnique({
    where: { slug: params.slug },
    include: {
      products: {
        orderBy: { sortOrder: "asc" },
        include: {
          product: {
            include: {
              merchant: true,
              offers: { orderBy: { fetchedAt: "desc" }, take: 1 },
            },
          },
        },
      },
    },
  });

  if (!post) notFound();

  const tag = getPartnerTagOrPlaceholder();

  return (
    <article className="space-y-10">
      <header className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-accent">Deal roundup</p>
        <h1 className="font-display text-4xl font-semibold text-ink">{post.title}</h1>
        {post.publishedAt ? (
          <p className="text-sm text-ink-muted">
            {post.publishedAt.toLocaleDateString("en-US", { dateStyle: "long" })}
          </p>
        ) : null}
      </header>

      <div className="prose prose-neutral max-w-none prose-headings:font-display prose-a:text-accent dark:prose-invert">
        <ReactMarkdown>{post.body}</ReactMarkdown>
      </div>

      {post.products.length > 0 ? (
        <section className="space-y-4">
          <h2 className="font-display text-2xl font-semibold text-ink">Products in this story</h2>
          <div className="grid gap-6 lg:grid-cols-2">
            {post.products.map(({ product, blurb }) => {
              const offer = product.offers[0];
              const href =
                offer?.affiliateUrl ??
                (product.merchant.slug === "amazon"
                  ? buildAmazonProductUrl(product.externalId, { partnerTag: tag })
                  : "#");
              const thumb = resolveProductImageUrl(product, tag);
              const priceText = offer
                ? new Intl.NumberFormat("en-US", { style: "currency", currency: offer.currency }).format(
                    Number(offer.priceAmount)
                  )
                : "See Amazon";

              return (
                <div
                  key={product.id}
                  className="flex gap-4 rounded-xl border border-line bg-surface p-4 shadow-sleek dark:shadow-sleek-dark"
                >
                  <Link
                    href={`/deals/${product.slug}`}
                    className="relative h-28 w-28 shrink-0 overflow-hidden rounded-lg bg-surface-subtle"
                  >
                    {thumb ? (
                      <ProductImage
                        src={thumb}
                        alt={product.title}
                        className="absolute inset-0 h-full w-full object-contain p-1"
                      />
                    ) : null}
                  </Link>
                  <div className="min-w-0 flex-1 space-y-2">
                    <Link href={`/deals/${product.slug}`} className="font-medium text-ink hover:text-accent">
                      {product.title}
                    </Link>
                    {blurb ? <p className="text-sm text-ink-muted">{blurb}</p> : null}
                    <p className="text-sm font-semibold text-ink">{priceText}</p>
                    <p className="text-xs text-ink-muted">{formatPriceDisclaimer(offer)}</p>
                    <a
                      href={href}
                      target="_blank"
                      rel="sponsored noopener noreferrer"
                      className="inline-flex rounded-md bg-ink px-3 py-1.5 text-xs font-medium text-white hover:bg-ink/90"
                    >
                      View on Amazon
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ) : null}
    </article>
  );
}
