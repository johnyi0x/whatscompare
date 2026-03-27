import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const amazon = await prisma.merchant.upsert({
    where: { slug: "amazon" },
    create: { slug: "amazon", name: "Amazon" },
    update: {},
  });

  const samples = [
    {
      externalId: "B0D93YPFQK",
      slug: "echo-dot-5th-gen",
      title: "Echo Dot (5th Gen, 2024 release) | Smart speaker with Alexa",
      brand: "Amazon",
      categoryPath: "Electronics > Smart Home",
      description:
        "Compact smart speaker for music, timers, and Alexa routines. Replace ASIN and copy with your PA-API-backed data in production.",
      imageUrl: "https://placehold.co/400x400/0f1419/ff6b35/png?text=Echo+Dot",
      imageSource: "seed",
    },
    {
      externalId: "B0CX23V2ZK",
      slug: "kindle-paperwhite",
      title: "Amazon Kindle Paperwhite (16 GB) — 7\" glare-free display",
      brand: "Amazon",
      categoryPath: "Electronics > E-readers",
      description: "E-reader placeholder listing for local dev; swap for real ASINs you are approved to promote.",
      imageUrl: "https://placehold.co/400x400/0f1419/ff6b35/png?text=Kindle",
      imageSource: "seed",
    },
    {
      externalId: "B0D1XD1ZV3",
      slug: "fire-tv-stick-4k",
      title: "Amazon Fire TV Stick 4K streaming device",
      brand: "Amazon",
      categoryPath: "Electronics > Streaming",
      description: "Streaming stick placeholder; verify live price and availability on Amazon before publishing deals.",
      imageUrl: "https://placehold.co/400x400/0f1419/ff6b35/png?text=Fire+TV",
      imageSource: "seed",
    },
    {
      externalId: "B0CJT4XD8G",
      slug: "anker-power-bank",
      title: "Anker MagGo Power Bank 10K | Magnetic wireless portable charger",
      brand: "Anker",
      categoryPath: "Electronics > Accessories",
      description: "Accessory example for search and category browsing.",
      imageUrl: "https://placehold.co/400x400/0f1419/ff6b35/png?text=Anker",
      imageSource: "seed",
    },
  ];

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
        imageUrl: s.imageUrl,
        imageSource: s.imageSource,
      },
      update: {
        title: s.title,
        brand: s.brand,
        categoryPath: s.categoryPath,
        description: s.description,
        imageUrl: s.imageUrl,
        imageSource: s.imageSource,
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
        availabilityNote: "Seed data for development only.",
        fetchedAt: new Date(),
        lastSyncedAt: new Date(),
      },
    });
  }

  const echo = await prisma.product.findUnique({ where: { slug: "echo-dot-5th-gen" } });
  const kindle = await prisma.product.findUnique({ where: { slug: "kindle-paperwhite" } });
  const anker = await prisma.product.findUnique({ where: { slug: "anker-power-bank" } });

  if (echo && kindle && anker) {
    await prisma.post.upsert({
      where: { slug: "smart-home-starter-deals" },
      create: {
        slug: "smart-home-starter-deals",
        title: "Smart home starter deals we’re watching",
        excerpt: "Echo, Kindle, and a rock-solid accessory—editorial roundup format for WhatsCompare.",
        publishedAt: new Date(),
        body: `## Why these picks

We curate offers from our database and link out with our Amazon Associates tag. **Prices and availability change**—always confirm on Amazon before you buy.

- Reliable Alexa hub for timers and music
- E-reader for distraction-free reading  
- Travel-friendly charging when you’re on the go

Use the product blocks below for one-click affiliate destinations.`,
      },
      update: {
        title: "Smart home starter deals we’re watching",
        excerpt: "Echo, Kindle, and a rock-solid accessory—editorial roundup format for WhatsCompare.",
        publishedAt: new Date(),
        body: `## Why these picks

We curate offers from our database and link out with our Amazon Associates tag. **Prices and availability change**—always confirm on Amazon before you buy.

- Reliable Alexa hub for timers and music
- E-reader for distraction-free reading  
- Travel-friendly charging when you’re on the go

Use the product blocks below for one-click affiliate destinations.`,
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
        { postId: post.id, productId: anker.id, sortOrder: 2, blurb: "Keep phones topped up on travel days." },
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
