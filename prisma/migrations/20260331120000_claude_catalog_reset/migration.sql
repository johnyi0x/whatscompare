-- ONE-TIME: wipe catalog (old SerpApi data). Run `npx prisma db seed` after migrate.
DELETE FROM "Product";

ALTER TABLE "Product" DROP COLUMN IF EXISTS "googleProductId";
ALTER TABLE "Product" DROP COLUMN IF EXISTS "immersivePageToken";

ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "specsJson" JSONB;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "enrichmentCompletedAt" TIMESTAMP(3);
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "amazonProductUrl" TEXT;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "bestBuyProductUrl" TEXT;

CREATE TABLE "ClaudeDailyUsage" (
    "id" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "estimatedUsd" DECIMAL(14,6) NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClaudeDailyUsage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ClaudeDailyUsage_day_key" ON "ClaudeDailyUsage"("day");
