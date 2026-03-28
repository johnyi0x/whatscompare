import { PrismaClient } from "@prisma/client";
import { bootstrapSerpApiIfEmpty, DEFAULT_SERAPI_BOOTSTRAP_ASINS } from "../lib/serpapi-sync";

const prisma = new PrismaClient();

function parseAsinList(raw: string | undefined): string[] {
  if (!raw?.trim()) return [];
  return raw
    .split(/[\s,]+/)
    .map((s) => s.trim().toUpperCase())
    .filter((a) => /^[A-Z0-9]{10}$/.test(a));
}

/** Unique ASINs for stubs: env list, padded to at least 5 with defaults when env has fewer than 5. */
function asinsForStubSeed(envParsed: string[]): string[] {
  const fromEnv = Array.from(new Set(envParsed));
  if (fromEnv.length >= 5) return fromEnv;

  const seen = new Set(fromEnv);
  const out = [...fromEnv];
  for (const a of DEFAULT_SERAPI_BOOTSTRAP_ASINS) {
    if (out.length >= 5) break;
    if (!seen.has(a)) {
      seen.add(a);
      out.push(a);
    }
  }
  return out;
}

/**
 * Optional:
 * - INGEST_ASINS — extra ASIN stubs (merged with defaults until at least 5 when fewer than 5 env ASINs).
 * - RESET_CATALOG_ON_SEED=1 — one-shot wipe (then remove env var).
 * With SERPAPI_API_KEY on Vercel build, seed calls SerpApi for up to 5 never-synced stubs when the catalog has no ingest-visible products yet.
 */
async function main() {
  console.log(
    `[seed] SERPAPI_API_KEY available during this run: ${Boolean(process.env.SERPAPI_API_KEY?.trim())} (Vercel: enable for Build, not only Production).`
  );

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

  await prisma.post.upsert({
    where: { slug: "how-affiliate-links-work-here" },
    create: {
      slug: "how-affiliate-links-work-here",
      title: "How affiliate links work on whatscompare",
      excerpt:
        "We may earn from qualifying Amazon purchases. Here is how we present deals and what to double-check before you buy.",
      publishedAt: new Date(),
      body: `## Disclosure

whatscompare uses Amazon Associates links. If you buy through our links, we may earn a commission at no extra cost to you.

## Prices and availability

Amazon changes prices, coupons, and stock often. Anything we show from our database is a **snapshot**—always confirm on Amazon before checkout.

## Product grid vs blog posts

You will see deals in the searchable catalog and in **deal blog posts**. Both are ways we highlight products we think are worth a look; the same disclosure applies.`,
    },
    update: {
      title: "How affiliate links work on whatscompare",
      excerpt:
        "We may earn from qualifying Amazon purchases. Here is how we present deals and what to double-check before you buy.",
      publishedAt: new Date(),
      body: `## Disclosure

whatscompare uses Amazon Associates links. If you buy through our links, we may earn a commission at no extra cost to you.

## Prices and availability

Amazon changes prices, coupons, and stock often. Anything we show from our database is a **snapshot**—always confirm on Amazon before checkout.

## Product grid vs blog posts

You will see deals in the searchable catalog and in **deal blog posts**. Both are ways we highlight products we think are worth a look; the same disclosure applies.`,
    },
  });

  const stubAsins = asinsForStubSeed(parseAsinList(process.env.INGEST_ASINS));
  for (const asin of stubAsins) {
    const slug = `asin-${asin.toLowerCase()}`;
    // Upsert by (merchantId, externalId): old seed rows used human slugs (e.g. echo-dot-5th-gen) for the same ASIN;
    // upserting only by slug would INSERT and hit P2002 on externalId.
    await prisma.product.upsert({
      where: {
        merchantId_externalId: { merchantId: amazon.id, externalId: asin },
      },
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
        slug,
        externalId: asin,
      },
    });
  }

  const boot = await bootstrapSerpApiIfEmpty(5);
  if (!boot.skipped) {
    console.log(`SerpApi bootstrap: updated ${boot.updated} product(s).`);
    if (boot.errors.length) {
      console.error("[seed] SerpApi bootstrap errors:", boot.errors.join(" | "));
    }
  } else if (boot.reason === "no_api_key") {
    console.log("SerpApi bootstrap skipped: SERPAPI_API_KEY not set.");
  } else if (boot.reason === "already_ingested") {
    console.log("SerpApi bootstrap skipped: catalog already has ingest-visible products.");
  } else if (boot.reason === "disabled") {
    console.log("SerpApi bootstrap skipped: SERPAPI_BOOTSTRAP_ON_SEED=0.");
  }

  console.log(
    `Seed complete: Amazon merchant; ${stubAsins.length} product stub(s); bootstrap=${boot.skipped ? `skipped (${boot.reason})` : `ok (${boot.updated} ingested)`}.`
  );
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
