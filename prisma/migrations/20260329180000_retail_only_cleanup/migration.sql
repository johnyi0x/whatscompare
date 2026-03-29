-- One-time: remove non–big-three retailer rows so history matches site policy (Amazon, Best Buy, Walmart only).
DELETE FROM "PriceSnapshot" WHERE store NOT IN ('amazon', 'bestbuy', 'walmart');
DELETE FROM "ProductStoreListing" WHERE store NOT IN ('amazon', 'bestbuy', 'walmart');

-- Persist condition classification from sync (new / used / refurbished / unknown).
ALTER TABLE "ProductStoreListing" ADD COLUMN "listingCondition" TEXT;
