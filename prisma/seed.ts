import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * Real US Amazon ASINs so /dp/ links and AsinImage URLs resolve.
 * Replace with products you are approved to promote.
 */
const samples = [
  {
    externalId: "B09B8V1LZ3",
    slug: "echo-dot-5th-gen",
    title: "Echo Dot (5th Gen, 2022 release) | Smart speaker with Alexa | Charcoal",
    brand: "Amazon",
    categoryPath: "Electronics > Smart Home",
    description: "Compact Alexa smart speaker. ASIN verified for US Amazon.",
  },
  {
    externalId: "B0CGJQG1TW",
    slug: "kindle-paperwhite",
    title: "Amazon Kindle Paperwhite (16 GB) — 7\" glare-free display, 12th generation",
    brand: "Amazon",
    categoryPath: "Electronics > E-readers",
    description: "E-reader listing; prices in app are seed values—check Amazon for live price.",
  },
  {
    externalId: "B0BP9SNVH9",
    slug: "fire-tv-stick-4k",
    title: "Amazon Fire TV Stick 4K Max streaming device, Wi-Fi 6E, Alexa Voice Remote",
    brand: "Amazon",
    categoryPath: "Electronics > Streaming",
    description: "Fire TV Stick 4K (current-gen family line on Amazon US).",
  },
  {
    externalId: "B0B5MW4JTJ",
    slug: "anker-maggo-power-bank",
    title: "Anker MagGo Power Bank, 10K Foldable Wireless Portable Charger, MagSafe compatible",
    brand: "Anker",
    categoryPath: "Electronics > Accessories",
    description: "Magnetic battery pack for iPhone; search matches “anker”, “magsafe”, “iphone”.",
  },
  {
    externalId: "B0CHLMJMWL",
    slug: "spigen-iphone-15-pro-case",
    title: "Spigen Liquid Air designed for iPhone 15 Pro case — matte black",
    brand: "Spigen",
    categoryPath: "Cell Phones & Accessories > Cases",
    description: "Case for iPhone 15 Pro; matches search “iphone”.",
  },
  {
    externalId: "B0B9Z8TVJ2",
    slug: "anker-usbc-lightning-cable",
    title: "Anker USB-C to Lightning Cable, 310 series, 6 ft — MFi certified, iPhone fast charging",
    brand: "Anker",
    categoryPath: "Cell Phones & Accessories > Cables",
    description: "USB-C to Lightning; matches “iphone”, “lightning”, “anker”.",
  },
  {
    externalId: "B0CMV9PYRQ",
    slug: "bissell-crosswave-omniforce",
    title: "BISSELL CrossWave OmniForce Edge Wet Dry Vacuum — multi-surface cleaner",
    brand: "Bissell",
    categoryPath: "Home & Kitchen > Vacuums",
    description: "Example ASIN from a working SiteStripe-style link; verify listing before heavy promotion.",
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
        imageSource: "asin_widget",
      },
      update: {
        externalId: s.externalId,
        title: s.title,
        brand: s.brand,
        categoryPath: s.categoryPath,
        description: s.description,
        imageUrl: null,
        imageSource: "asin_widget",
      },
    });

    const seedPrice = (49.99 + s.slug.length) % 120;
    await prisma.offer.deleteMany({ where: { productId: product.id, source: "seed" } });
    await prisma.offer.create({
      data: {
        productId: product.id,
        merchantId: amazon.id,
        priceAmount: seedPrice + 0.99,
        currency: "USD",
        listPriceAmount: seedPrice + 29.99,
        dealLabel: "Editor’s pick",
        affiliateUrl: null,
        source: "seed",
        availabilityNote: "Seed price for demo; verify on Amazon before purchase.",
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
