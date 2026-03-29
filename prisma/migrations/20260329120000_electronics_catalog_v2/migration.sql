-- Rebuild catalog: multi-store SerpApi (Google Shopping + Immersive). Drops legacy Amazon-only tables.

DROP TABLE IF EXISTS "PostProduct" CASCADE;
DROP TABLE IF EXISTS "PriceHistory" CASCADE;
DROP TABLE IF EXISTS "Offer" CASCADE;
DROP TABLE IF EXISTS "Product" CASCADE;
DROP TABLE IF EXISTS "Merchant" CASCADE;

CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "imageUrl" TEXT,
    "category" TEXT,
    "brand" TEXT,
    "tier" INTEGER NOT NULL DEFAULT 3,
    "shoppingQuery" TEXT NOT NULL,
    "shoppingMatchHint" TEXT,
    "googleProductId" TEXT,
    "immersivePageToken" TEXT,
    "lastRefreshedAt" TIMESTAMP(3),
    "dealScorePercent" DECIMAL(6,2),
    "avgPrice90d" DECIMAL(12,2),
    "lowestPriceCurrent" DECIMAL(12,2),
    "trendDirection" TEXT,
    "cheapestStoreMostOften" TEXT,
    "cheapestStoreWinPct" DECIMAL(5,2),
    "volatilityScore" DECIMAL(12,4),
    "dealConfidence" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Product_slug_key" ON "Product"("slug");
CREATE INDEX "Product_brand_idx" ON "Product"("brand");
CREATE INDEX "Product_tier_lastRefreshedAt_idx" ON "Product"("tier", "lastRefreshedAt");
CREATE INDEX "Product_title_trgm_idx" ON "Product" USING gin ("title" gin_trgm_ops);
CREATE INDEX "Product_brand_trgm_idx" ON "Product" USING gin ("brand" gin_trgm_ops);

CREATE TABLE "ProductStoreListing" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "store" TEXT NOT NULL,
    "storeLabel" TEXT,
    "storeUrl" TEXT NOT NULL,
    "currentPrice" DECIMAL(12,2) NOT NULL,
    "regularPrice" DECIMAL(12,2),
    "rating" DECIMAL(4,2),
    "reviewCount" INTEGER,
    "inStock" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductStoreListing_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProductStoreListing_productId_store_key" ON "ProductStoreListing"("productId", "store");
CREATE INDEX "ProductStoreListing_productId_idx" ON "ProductStoreListing"("productId");

CREATE TABLE "PriceSnapshot" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "store" TEXT NOT NULL,
    "price" DECIMAL(12,2) NOT NULL,
    "regularPrice" DECIMAL(12,2),
    "inStock" BOOLEAN NOT NULL DEFAULT true,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PriceSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PriceSnapshot_productId_recordedAt_idx" ON "PriceSnapshot"("productId", "recordedAt");
CREATE INDEX "PriceSnapshot_productId_store_recordedAt_idx" ON "PriceSnapshot"("productId", "store", "recordedAt");

ALTER TABLE "ProductStoreListing" ADD CONSTRAINT "ProductStoreListing_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PriceSnapshot" ADD CONSTRAINT "PriceSnapshot_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
