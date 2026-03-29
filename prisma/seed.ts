import { PrismaClient } from "@prisma/client";
import { ELECTRONICS_SEED } from "./electronics-seed-data";

const prisma = new PrismaClient();

/**
 * Electronics-only catalog. Prices come from SerpApi (Google Shopping → Immersive) via cron, not from seed.
 * Set RESET_CATALOG_ON_SEED=1 once to wipe products + listings + snapshots (posts kept).
 */
async function main() {
  if (process.env.RESET_CATALOG_ON_SEED === "1") {
    await prisma.priceSnapshot.deleteMany();
    await prisma.productStoreListing.deleteMany();
    await prisma.product.deleteMany();
    console.log("RESET_CATALOG_ON_SEED: cleared Product, listings, snapshots.");
  }

  for (const row of ELECTRONICS_SEED) {
    await prisma.product.upsert({
      where: { slug: row.slug },
      create: {
        slug: row.slug,
        title: row.title,
        category: row.category,
        brand: row.brand ?? null,
        shoppingQuery: row.shoppingQuery,
        shoppingMatchHint: row.shoppingMatchHint ?? null,
        tier: 3,
      },
      update: {
        title: row.title,
        category: row.category,
        brand: row.brand ?? null,
        shoppingQuery: row.shoppingQuery,
        shoppingMatchHint: row.shoppingMatchHint ?? null,
      },
    });
  }

  await prisma.post.upsert({
    where: { slug: "how-affiliate-links-work-here" },
    create: {
      slug: "how-affiliate-links-work-here",
      title: "How affiliate links work on whatscompare",
      excerpt:
        "We may earn from qualifying purchases when you use retailer links. Prices are aggregated snapshots—not live checkout totals.",
      publishedAt: new Date(),
      body: `## Disclosure

whatscompare may earn commissions from qualifying purchases through retailer links shown on product pages.

## Where prices come from

We store **multi-store prices** from scheduled data refreshes (not on every page view). Always confirm price, tax, and shipping on the retailer site before you buy.

## Electronics focus

We currently track a curated set of **consumer electronics** SKUs so our database can compound value over time.`,
    },
    update: {
      title: "How affiliate links work on whatscompare",
      excerpt:
        "We may earn from qualifying purchases when you use retailer links. Prices are aggregated snapshots—not live checkout totals.",
      publishedAt: new Date(),
    },
  });

  console.log(`Seed complete: ${ELECTRONICS_SEED.length} electronics products (awaiting cron for prices).`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
