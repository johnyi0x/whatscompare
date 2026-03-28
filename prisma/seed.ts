import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * US Amazon ASINs checked against live /dp/ pages; swap anytime from SiteStripe.
 * Prices are approximate MSRP/typical retail for demo — live prices need PA-API cron.
 */
const samples: Array<{
  externalId: string;
  slug: string;
  title: string;
  brand: string;
  categoryPath: string;
  description: string;
  priceAmount: number;
  listPriceAmount: number;
}> = [
  {
    externalId: "B09B8V1LZ3",
    slug: "echo-dot-5th-gen",
    title: "Echo Dot (5th Gen, 2022 release) | Smart speaker with Alexa | Charcoal",
    brand: "Amazon",
    categoryPath: "Electronics > Smart Home",
    description: "Compact Alexa smart speaker.",
    priceAmount: 49.99,
    listPriceAmount: 59.99,
  },
  {
    externalId: "B0CGJQG1TW",
    slug: "kindle-paperwhite",
    title: "Amazon Kindle Paperwhite (16 GB) — 7\" glare-free display, 12th generation",
    brand: "Amazon",
    categoryPath: "Electronics > E-readers",
    description: "Kindle Paperwhite; verify current price on Amazon.",
    priceAmount: 159.99,
    listPriceAmount: 189.99,
  },
  {
    externalId: "B0BP9SNVH9",
    slug: "fire-tv-stick-4k",
    title: "Amazon Fire TV Stick 4K Max streaming device, Wi-Fi 6E, Alexa Voice Remote",
    brand: "Amazon",
    categoryPath: "Electronics > Streaming",
    description: "Fire TV Stick 4K Max.",
    priceAmount: 34.99,
    listPriceAmount: 59.99,
  },
  {
    externalId: "B09P8DSRVB",
    slug: "anker-maggo-power-bank",
    title: "Anker 633 Magnetic Battery (MagGo), 10,000mAh wireless portable charger, foldable stand",
    brand: "Anker",
    categoryPath: "Electronics > Accessories",
    description: "10K MagSafe-style battery with stand.",
    priceAmount: 69.99,
    listPriceAmount: 89.99,
  },
  {
    externalId: "B0CHLMJMWL",
    slug: "spigen-iphone-15-pro-case",
    title: "Spigen Liquid Air designed for iPhone 15 Pro case — matte black",
    brand: "Spigen",
    categoryPath: "Cell Phones & Accessories > Cases",
    description: "Slim case for iPhone 15 Pro.",
    priceAmount: 16.99,
    listPriceAmount: 24.99,
  },
  {
    externalId: "B08H83C89C",
    slug: "anker-usbc-lightning-cable",
    title: "Anker USB-C to Lightning Cable, PowerLine (6 ft), MFi certified, fast charging",
    brand: "Anker",
    categoryPath: "Cell Phones & Accessories > Cables",
    description: "USB-C to Lightning 6 ft.",
    priceAmount: 17.99,
    listPriceAmount: 22.99,
  },
  {
    externalId: "B0CMV9PYRQ",
    slug: "bissell-crosswave-omniforce",
    title: "BISSELL CrossWave OmniForce Cordless Wet Dry Vacuum — multi-surface cleaner",
    brand: "Bissell",
    categoryPath: "Home & Kitchen > Vacuums",
    description: "Wet/dry floor cleaner; promos change often on Amazon.",
    priceAmount: 139.99,
    listPriceAmount: 279.99,
  },
];

async function main() {
  const amazon = await prisma.merchant.upsert({
    where: { slug: "amazon" },
    create: { slug: "amazon", name: "Amazon" },
    update: {},
  });

  for (const s of samples) {
    const product = await prisma.product.upsert({
      where: { slug: s.slug },
      create: {
        merchantId: amazon.id,
        externalId: s.externalId,
        slug: s.slug,
        title: s.title,
        brand: s.brand,
        categoryPath: s.categoryPath,
        description: s.description,
        imageUrl: null,
        imageSource: "asin_proxy",
      },
      update: {
        externalId: s.externalId,
        title: s.title,
        brand: s.brand,
        categoryPath: s.categoryPath,
        description: s.description,
        imageUrl: null,
        imageSource: "asin_proxy",
      },
    });

    await prisma.offer.deleteMany({ where: { productId: product.id, source: "seed" } });
    await prisma.offer.create({
      data: {
        productId: product.id,
        merchantId: amazon.id,
        priceAmount: s.priceAmount,
        currency: "USD",
        listPriceAmount: s.listPriceAmount,
        dealLabel: "Editor’s pick",
        affiliateUrl: null,
        source: "seed",
        availabilityNote: "Approximate reference price; Amazon’s live price may differ (sales, Lightning Deals).",
        fetchedAt: new Date(),
        lastSyncedAt: new Date(),
      },
    });
  }

  const echo = await prisma.product.findUnique({ where: { slug: "echo-dot-5th-gen" } });
  const kindle = await prisma.product.findUnique({ where: { slug: "kindle-paperwhite" } });
  const ankerBank = await prisma.product.findUnique({ where: { slug: "anker-maggo-power-bank" } });

  if (echo && kindle && ankerBank) {
    await prisma.post.upsert({
      where: { slug: "smart-home-starter-deals" },
      create: {
        slug: "smart-home-starter-deals",
        title: "Smart home starter deals we’re watching",
        excerpt: "Echo, Kindle, and a solid Anker pick—editorial roundup on WhatsCompare.",
        publishedAt: new Date(),
        body: `## Why these picks

We link with our Amazon Associates tag. **Prices and availability change**—always confirm on Amazon before you buy.

- Alexa in every room
- Distraction-free reading
- Keep devices charged on the go`,
      },
      update: {
        title: "Smart home starter deals we’re watching",
        excerpt: "Echo, Kindle, and a solid Anker pick—editorial roundup on WhatsCompare.",
        publishedAt: new Date(),
        body: `## Why these picks

We link with our Amazon Associates tag. **Prices and availability change**—always confirm on Amazon before you buy.

- Alexa in every room
- Distraction-free reading
- Keep devices charged on the go`,
      },
    });

    const post = await prisma.post.findUniqueOrThrow({
      where: { slug: "smart-home-starter-deals" },
    });

    await prisma.postProduct.deleteMany({ where: { postId: post.id } });
    await prisma.postProduct.createMany({
      data: [
        { postId: post.id, productId: echo.id, sortOrder: 0, blurb: "Best entry point for Alexa routines." },
        { postId: post.id, productId: kindle.id, sortOrder: 1, blurb: "Great for reading without phone glare." },
        { postId: post.id, productId: ankerBank.id, sortOrder: 2, blurb: "MagSafe-friendly power on the go." },
      ],
    });
  }

  console.log("Seed complete: Amazon merchant, sample products, one editorial post.");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
