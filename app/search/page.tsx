import { ProductCard } from "@/components/ProductCard";
import { prisma } from "@/lib/prisma";
import { searchProductsWithListings } from "@/lib/search";

type Props = { searchParams: { q?: string } };

export default async function SearchPage({ searchParams }: Props) {
  const q = searchParams.q?.trim() ?? "";
  const products = q
    ? await searchProductsWithListings(q, 48)
    : await prisma.product.findMany({
        include: { listings: { orderBy: { currentPrice: "asc" } } },
        orderBy: { title: "asc" },
        take: 60,
      });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl font-semibold text-ink">Electronics catalog</h1>
        <p className="mt-2 text-ink-muted">
          {q
            ? `Results for “${q}” — titles, brands, and categories (trigram + similarity).`
            : "All tracked SKUs. Use the header search to filter. Prices fill in after scheduled SerpApi sync."}
        </p>
      </div>

      {products.length === 0 ? (
        <p className="rounded-lg border border-dashed border-line bg-surface-subtle px-4 py-8 text-center text-ink-muted">
          No products. Run migrations and <code className="text-ink">prisma db seed</code>.
        </p>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      )}
    </div>
  );
}
