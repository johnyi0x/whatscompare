/**
 * Only these retailers are persisted and shown (major storefronts; aligns with affiliate focus).
 */
export const ALLOWED_RETAIL_KEYS = ["amazon", "bestbuy", "walmart"] as const;
export type AllowedRetailKey = (typeof ALLOWED_RETAIL_KEYS)[number];

export function isAllowedRetailKey(store: string): store is AllowedRetailKey {
  return (ALLOWED_RETAIL_KEYS as readonly string[]).includes(store);
}

export function displayLabelForStore(store: string): string {
  switch (store) {
    case "amazon":
      return "Amazon";
    case "bestbuy":
      return "Best Buy";
    case "walmart":
      return "Walmart";
    default:
      return store;
  }
}

/** Amazon first, then remaining stores by ascending price. */
export function sortListingsAmazonFirstThenPrice<
  T extends { store: string; currentPrice: unknown },
>(listings: T[]): T[] {
  const amazon = listings.filter((l) => l.store === "amazon").sort((a, b) => Number(a.currentPrice) - Number(b.currentPrice));
  const rest = listings
    .filter((l) => l.store !== "amazon")
    .sort((a, b) => Number(a.currentPrice) - Number(b.currentPrice));
  return [...amazon, ...rest];
}

/** Chart series order: Amazon → Best Buy → Walmart (only keys present). */
export function sortStoreKeysForChart(keys: string[]): string[] {
  const order: AllowedRetailKey[] = ["amazon", "bestbuy", "walmart"];
  const set = new Set(keys);
  const head = order.filter((k) => set.has(k));
  const tail = keys.filter((k) => !order.includes(k as AllowedRetailKey)).sort();
  return [...head, ...tail];
}

export type ItemCondition = "new" | "used" | "refurbished" | "unknown";

/** Infer condition from SerpApi immersive `details_and_offers` + seller line. */
export function inferItemCondition(details?: string[], storeLabel?: string): ItemCondition {
  const text = [...(details ?? []), storeLabel ?? ""].join(" ").toLowerCase();
  if (
    /\brefurbish|\brenewed\b|\bopen[-\s]?box\b|\bopen box\b|\bscratch\s*&\s*dent\b/.test(text)
  ) {
    return "refurbished";
  }
  if (/\bused\b|\bpre[-\s]?owned\b|\bsecond[-\s]?hand\b|\blike new\b/.test(text)) {
    return "used";
  }
  return "unknown";
}

export type TrustedListingInput = {
  store: string;
  storeLabel: string;
  storeUrl: string;
  price: number;
  regularPrice: number | null;
  rating: number | null;
  reviewCount: number | null;
  inStock: boolean;
  itemCondition: ItemCondition;
};

/**
 * Keep allowlisted stores, drop used/refurb rows, then drop obvious low-price outliers vs peers.
 */
export function filterTrustedRetailListings(rows: TrustedListingInput[]): TrustedListingInput[] {
  let out = rows.filter((r) => isAllowedRetailKey(r.store));
  out = out.filter((r) => r.itemCondition === "new" || r.itemCondition === "unknown");
  out = dropSuspiciousLowPrices(out);
  return out;
}

function medianSorted(sorted: number[]): number {
  const n = sorted.length;
  if (!n) return 0;
  const mid = Math.floor(n / 2);
  return n % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

function dropSuspiciousLowPrices(rows: TrustedListingInput[]): TrustedListingInput[] {
  if (rows.length <= 1) return rows;

  const minRatio = clamp01(Number(process.env.LISTING_PRICE_MIN_TO_MEDIAN_RATIO || 0.52), 0.35, 0.75);
  const pairSpread = clamp01(Number(process.env.LISTING_TWO_STORE_SPREAD_RATIO || 1.65), 1.2, 3);
  const pairLowCap = clamp01(Number(process.env.LISTING_TWO_STORE_LOW_VS_HIGH || 0.42), 0.25, 0.55);

  if (rows.length === 2) {
    const [a, b] = [...rows].sort((x, y) => x.price - y.price);
    if (b.price / a.price >= pairSpread && a.price < b.price * pairLowCap) {
      return [b];
    }
    return rows;
  }

  const prices = rows.map((r) => r.price).sort((a, b) => a - b);
  const med = medianSorted(prices);
  const q1 = prices[Math.max(0, Math.floor((prices.length - 1) * 0.25))]!;
  const q3 = prices[Math.min(prices.length - 1, Math.ceil((prices.length - 1) * 0.75))]!;
  const iqr = q3 - q1;
  const iqrFloor = q1 - 1.5 * iqr;
  const ratioFloor = med * minRatio;
  const floor = Math.max(iqrFloor > 0 ? iqrFloor : 0, ratioFloor);

  return rows.filter((r) => r.price >= floor);
}

function clamp01(n: number, lo: number, hi: number): number {
  if (!Number.isFinite(n)) return lo;
  return Math.min(hi, Math.max(lo, n));
}
