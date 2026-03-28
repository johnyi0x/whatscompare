import type { Prisma } from "@prisma/client";

/**
 * Products eligible for public listing: enriched by SerpApi and/or Amazon PA-API (Creators path).
 * Seed-only / placeholder rows stay in the DB for cron targets but are hidden until ingest succeeds.
 */
export const ingestedProductWhere: Prisma.ProductWhereInput = {
  OR: [
    { serpapiSyncedAt: { not: null } },
    { imageSource: "pa_api" },
    {
      offers: {
        some: { source: { in: ["pa_api", "serpapi"] } },
      },
    },
  ],
};

export function productDetailWhere(slug: string): Prisma.ProductWhereInput {
  return { slug, ...ingestedProductWhere };
}
