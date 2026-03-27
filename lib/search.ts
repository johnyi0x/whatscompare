import { prisma } from "./prisma";

const DEFAULT_LIMIT = 24;

/**
 * Hybrid ILIKE + pg_trgm similarity. Requires pg_trgm extension (see migration).
 */
export async function searchProductIds(query: string, limit = DEFAULT_LIMIT): Promise<string[]> {
  const q = query.trim();
  if (!q) return [];

  const escaped = q.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
  const like = `%${escaped}%`;

  const cap = Math.min(Math.max(limit, 1), 100);
  const rows = await prisma.$queryRaw<{ id: string }[]>`
    SELECT p.id
    FROM "Product" p
    WHERE
      p.title ILIKE ${like} ESCAPE '\'
      OR COALESCE(p.brand, '') ILIKE ${like} ESCAPE '\'
      OR p.title % ${q}
      OR COALESCE(p.brand, '') % ${q}
    ORDER BY
      GREATEST(
        similarity(p.title, ${q}),
        similarity(COALESCE(p.brand, ''), ${q})
      ) DESC NULLS LAST,
      p."updatedAt" DESC
    LIMIT ${cap}
  `;

  return rows.map((r) => r.id);
}

export async function searchProductsWithOffers(query: string, limit = DEFAULT_LIMIT) {
  const ids = await searchProductIds(query, limit);
  if (ids.length === 0) return [];

  const products = await prisma.product.findMany({
    where: { id: { in: ids } },
    include: {
      merchant: true,
      offers: {
        orderBy: { fetchedAt: "desc" },
        take: 1,
      },
    },
  });

  const order = new Map(ids.map((id, i) => [id, i]));
  return products.sort((a, b) => (order.get(a.id)! - order.get(b.id)!));
}
