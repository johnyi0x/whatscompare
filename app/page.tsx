import Link from "next/link";
import { ProductCard } from "@/components/ProductCard";
import { ingestedProductWhere } from "@/lib/ingested-products";
import { prisma } from "@/lib/prisma";

export default async function HomePage() {
  const featured = await prisma.product.findMany({
    where: ingestedProductWhere,
    take: 8,
    orderBy: { updatedAt: "desc" },
    include: {
      merchant: true,
      offers: { orderBy: { fetchedAt: "desc" }, take: 1 },
    },
  });

  const recentPosts = await prisma.post.findMany({
    where: { publishedAt: { not: null } },
    orderBy: { publishedAt: "desc" },
    take: 4,
  });

  return (
    <div className="space-y-14">
      <section className="space-y-6 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">Curated Amazon deals</p>
        <h1 className="font-display text-4xl font-semibold tracking-tight text-ink sm:text-5xl sm:leading-tight">
          Deals you can search—<span className="text-accent">honest</span> pricing context
        </h1>
        <p className="mx-auto max-w-xl text-lg leading-relaxed text-ink-muted">
          Find products we track, compare notes at a glance, and jump to Amazon with a clear affiliate disclosure—no
          clutter, just deals worth a look.
        </p>
        <div className="flex flex-wrap justify-center gap-3 pt-2">
          <Link
            href="/search"
            className="rounded-lg bg-accent px-6 py-2.5 text-sm font-semibold text-white shadow-sleek transition hover:bg-accent-hover dark:shadow-sleek-dark"
          >
            Browse catalog
          </Link>
          <Link
            href="/posts"
            className="rounded-lg border border-line bg-surface px-6 py-2.5 text-sm font-medium text-ink transition hover:border-accent"
          >
            Deal blog posts
          </Link>
          <Link
            href="/about"
            className="rounded-lg px-4 py-2.5 text-sm font-medium text-ink-muted underline-offset-4 hover:text-ink hover:underline"
          >
            How it works
          </Link>
        </div>
      </section>

      <section className="space-y-5">
        <div className="flex items-end justify-between gap-4 border-b border-line pb-3">
          <h2 className="font-display text-2xl font-semibold text-ink">Fresh from the database</h2>
          <Link href="/search" className="text-sm font-medium text-accent hover:underline">
            View all
          </Link>
        </div>
        {featured.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-line bg-surface-subtle px-4 py-10 text-center text-ink-muted">
            No ingest-visible products yet. On Vercel, add <code className="text-ink">SERPAPI_API_KEY</code> under{" "}
            <strong className="text-ink">Environment Variables → include it for “Build”</strong> (not only Production) so{" "}
            <code className="text-ink">prisma db seed</code> can call SerpApi during deploy. Then check the build log for
            SerpApi errors, or wait for the daily cron.
          </p>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {featured.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        )}
      </section>

      <section className="space-y-5">
        <div className="flex items-end justify-between gap-4 border-b border-line pb-3">
          <h2 className="font-display text-2xl font-semibold text-ink">Deal blog posts</h2>
          <Link href="/posts" className="text-sm font-medium text-accent hover:underline">
            View all
          </Link>
        </div>
        {recentPosts.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-line bg-surface-subtle px-4 py-8 text-center text-sm text-ink-muted">
            Editorial posts with Amazon affiliate context will appear here—another way to surface referral links besides
            the product grid.
          </p>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2">
            {recentPosts.map((post) => (
              <li key={post.id}>
                <Link
                  href={`/posts/${post.slug}`}
                  className="block h-full rounded-2xl border border-line bg-surface p-5 shadow-sleek transition hover:border-accent/40 dark:shadow-sleek-dark"
                >
                  <h3 className="font-display text-lg font-semibold text-ink">{post.title}</h3>
                  {post.excerpt ? (
                    <p className="mt-2 line-clamp-2 text-sm text-ink-muted">{post.excerpt}</p>
                  ) : null}
                  {post.publishedAt ? (
                    <p className="mt-3 text-xs text-ink-muted">
                      {post.publishedAt.toLocaleDateString("en-US", { dateStyle: "medium" })}
                    </p>
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
