import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function parseAsinList(raw: string | undefined): string[] {
  if (!raw?.trim()) return [];
  return raw
    .split(/[\s,]+/)
    .map((s) => s.trim().toUpperCase())
    .filter((a) => /^[A-Z0-9]{10}$/.test(a));
}

/**
 * Default: no sample products (catalog is API-driven). Optional:
 * - INGEST_ASINS=B0XXX,B0YYY — stub rows for daily SerpApi / PA-API cron.
 * - RESET_CATALOG_ON_SEED=1 — one-shot wipe of products/offers/history/posts (then remove env var).
 */
async function main() {
  if (process.env.RESET_CATALOG_ON_SEED === "1") {
    await prisma.postProduct.deleteMany();
    await prisma.priceHistory.deleteMany();
    await prisma.offer.deleteMany();
    await prisma.product.deleteMany();
    await prisma.post.deleteMany();
    console.log("RESET_CATALOG_ON_SEED: cleared products, offers, price history, posts.");
  }

  const amazon = await prisma.merchant.upsert({
    where: { slug: "amazon" },
    create: { slug: "amazon", name: "Amazon" },
    update: {},
  });

  const ingestAsins = parseAsinList(process.env.INGEST_ASINS);
  for (const asin of ingestAsins) {
    const slug = `asin-${asin.toLowerCase()}`;
    await prisma.product.upsert({
      where: { slug },
      create: {
        merchantId: amazon.id,
        externalId: asin,
        slug,
        title: `Amazon ${asin}`,
        brand: null,
        categoryPath: null,
        description:
          "Title, image, and price appear after the next successful catalog sync (SerpApi or Amazon PA-API).",
        imageUrl: null,
        imageSource: "none",
      },
      update: {
        externalId: asin,
      },
    });
  }

  console.log(
    `Seed complete: Amazon merchant; ${ingestAsins.length} ASIN stub(s) from INGEST_ASINS (if any). No demo products.`
  );
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
