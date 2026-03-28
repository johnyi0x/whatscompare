import { ProductCard } from "@/components/ProductCard";
import { searchProductsWithOffers } from "@/lib/search";

type Props = { searchParams: { q?: string } };

export default async function SearchPage({ searchParams }: Props) {
  const q = searchParams.q?.trim() ?? "";
  const products = q ? await searchProductsWithOffers(q, 48) : [];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl font-semibold text-ink">Search deals</h1>
        <p className="mt-2 text-ink-muted">
          {q
            ? `Results for “${q}” — ranked with Postgres trigram + similarity.`
            : "Enter a query in the header to search titles and brands."}
        </p>
      </div>

      {q && products.length === 0 ? (
        <p className="rounded-lg border border-dashed border-line bg-surface-subtle px-4 py-8 text-center text-ink-muted">
          No matches yet. Try another keyword or seed more products.
        </p>
      ) : null}

      {products.length > 0 ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      ) : null}
    </div>
  );
}
