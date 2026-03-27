import Link from "next/link";
import { AffiliateDisclosure } from "@/components/AffiliateDisclosure";
import { ProductCard } from "@/components/ProductCard";
import { prisma } from "@/lib/prisma";

export default async function HomePage() {
  const featured = await prisma.product.findMany({
    take: 6,
    orderBy: { updatedAt: "desc" },
    include: {
      merchant: true,
      offers: { orderBy: { fetchedAt: "desc" }, take: 1 },
    },
  });

  return (
    <div className="space-y-12">
      <section className="space-y-6 text-center">
        <p className="text-sm font-medium uppercase tracking-widest text-accent">whatscompare.com</p>
        <h1 className="font-display text-4xl font-semibold tracking-tight text-ink sm:text-5xl">
          Deals you can search—<span className="text-accent">honest</span> pricing context
        </h1>
        <p className="mx-auto max-w-2xl text-lg text-ink-muted">
          We index products and prices in Postgres, surface editorial deal pages, and link out with Amazon Associates
          tags. Built for Vercel + Neon (or any Postgres) the same way you ship modern Next apps.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Link
            href="/search"
            className="rounded-md bg-accent px-5 py-2.5 text-sm font-medium text-white hover:bg-accent-hover"
          >
            Browse catalog
          </Link>
          <Link
            href="/posts"
            className="rounded-md border border-ink/15 px-5 py-2.5 text-sm font-medium text-ink hover:border-accent"
          >
            Read deal write-ups
          </Link>
        </div>
      </section>

      <AffiliateDisclosure />

      <section className="space-y-4">
        <div className="flex items-end justify-between gap-4">
          <h2 className="font-display text-2xl font-semibold text-ink">Fresh from the database</h2>
          <Link href="/search" className="text-sm font-medium text-accent hover:underline">
            View all
          </Link>
        </div>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {featured.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      </section>
    </div>
  );
}
