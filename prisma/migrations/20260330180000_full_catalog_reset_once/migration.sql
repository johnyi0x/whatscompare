-- One-time: remove every tracked product and all listings/snapshots (posts and other tables unchanged).
-- After deploy, run: npx prisma db seed   (or your seed pipeline) to recreate the electronics catalog.
DELETE FROM "Product";
