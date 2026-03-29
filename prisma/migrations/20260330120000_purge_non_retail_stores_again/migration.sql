-- One-time cleanup: remove any listings/snapshots outside Amazon, Best Buy, Walmart (e.g. legacy Visible, Target, slug keys).
DELETE FROM "PriceSnapshot" WHERE store NOT IN ('amazon', 'bestbuy', 'walmart');
DELETE FROM "ProductStoreListing" WHERE store NOT IN ('amazon', 'bestbuy', 'walmart');
