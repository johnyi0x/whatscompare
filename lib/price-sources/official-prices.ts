/**
 * Reserved for Amazon Creator / Best Buy official APIs (no per-call Claude cost; subject to quotas).
 * Return partial per-store prices; missing stores fall back to Claude in the cron pipeline.
 */
export type OfficialStorePrice = {
  price: number;
  regularPrice: number | null;
  inStock: boolean;
};

export async function fetchOfficialListingPrices(
  _productId: string,
): Promise<Partial<Record<"amazon" | "bestbuy", OfficialStorePrice>> | null> {
  void _productId;
  return null;
}
