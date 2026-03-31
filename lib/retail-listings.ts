/**
 * Only these retailers are persisted and shown (major storefronts; aligns with affiliate focus).
 */
export const ALLOWED_RETAIL_KEYS = ["amazon", "bestbuy"] as const;
export type AllowedRetailKey = (typeof ALLOWED_RETAIL_KEYS)[number];

export function isAllowedRetailKey(store: string): store is AllowedRetailKey {
  return (ALLOWED_RETAIL_KEYS as readonly string[]).includes(store);
}

function tryHostname(link: string): string {
  try {
    const u = link.startsWith("http") ? link : `https://${link}`;
    return new URL(u).hostname.toLowerCase();
  } catch {
    return "";
  }
}

const OFFICIAL_HOST: Record<AllowedRetailKey, RegExp> = {
  amazon: /^(.+\.)?amazon\.(com|co\.uk|ca|de|fr|it|es|in|com\.au|com\.mx|nl|se|pl|eg|sa|ae|tr|sg)$/,
  bestbuy: /\.bestbuy\.com$/,
};

/**
 * Map seller label + product URL to exactly one allowed key, or null (row is ignored).
 * Never slugify unknown sellers — that let "Visible", "Verizon", etc. into the DB.
 */
export function canonicalAllowedRetailKey(name: string, link?: string): AllowedRetailKey | null {
  const n = name.trim().toLowerCase();
  const host = link ? tryHostname(link) : "";

  if (host && OFFICIAL_HOST.amazon.test(host)) return "amazon";
  if (/\bamazon\.com\b/.test(n) || /^amazon\b/.test(n) || /\bamazon\s/.test(n)) return "amazon";

  if (host && OFFICIAL_HOST.bestbuy.test(host)) return "bestbuy";
  if (/\bbest\s*buy\b/.test(n) || /\bbestbuy\b/.test(n)) return "bestbuy";

  return null;
}

/** True if price text / details look like a monthly installment, not full purchase price. */
export function looksLikeMonthlyInstallment(parts: (string | undefined | null)[]): boolean {
  const blob = parts.filter(Boolean).join(" ").toLowerCase();
  if (!blob) return false;
  if (/\/\s*mo\b|\/mo\b|\/\s*month\b|per\s*month|monthly\s*(payment|installment|price)|\/month\b/.test(blob)) {
    return true;
  }
  if (/\b\d+\s*months?\b.*\b(financ|payment|install)/.test(blob) || /\bfrom\s*\$[\d.]+\s*\/\s*mo/.test(blob)) {
    return true;
  }
  if (/\b(phone|device)\s+payment\s+plan\b|\binstallment\s+plan\b/.test(blob)) return true;
  return false;
}

export type ItemCondition = "new" | "used" | "refurbished" | "unknown";

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
 * One row per store: among offers on the official domain, pick the lowest price.
 * If none on the official host, fall back to the lowest marketplace offer for that key.
 */
export function mergeTrustedListingsByStore(rows: TrustedListingInput[]): TrustedListingInput[] {
  const byStore = new Map<AllowedRetailKey, TrustedListingInput[]>();
  for (const r of rows) {
    if (!isAllowedRetailKey(r.store)) continue;
    const arr = byStore.get(r.store) ?? [];
    arr.push(r);
    byStore.set(r.store, arr);
  }
  const out: TrustedListingInput[] = [];
  for (const k of ALLOWED_RETAIL_KEYS) {
    const g = byStore.get(k);
    if (!g?.length) continue;
    const official = g.filter((r) => OFFICIAL_HOST[k].test(tryHostname(r.storeUrl)));
    const pool = official.length ? official : g;
    out.push(pool.reduce((a, b) => (a.price <= b.price ? a : b)));
  }
  return out;
}

export function displayLabelForStore(store: string): string {
  switch (store) {
    case "amazon":
      return "Amazon";
    case "bestbuy":
      return "Best Buy";
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

/** Chart series order: Amazon → Best Buy (only keys present). */
export function sortStoreKeysForChart(keys: string[]): string[] {
  const order: AllowedRetailKey[] = ["amazon", "bestbuy"];
  const set = new Set(keys);
  const head = order.filter((k) => set.has(k));
  const tail = keys.filter((k) => !order.includes(k as AllowedRetailKey)).sort();
  return [...head, ...tail];
}

/** Infer condition from offer/detail text + seller line. */
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

/** Drop absurdly cheap rows when another peer is clearly full retail (e.g. $27 vs $471 phone). */
function dropVsPeerExtremeLow(rows: TrustedListingInput[]): TrustedListingInput[] {
  if (rows.length < 2) return rows;
  const hi = Math.max(...rows.map((r) => r.price));
  if (hi < 220) return rows;
  return rows.filter((r) => !(r.price < 130 && r.price < hi * 0.22));
}

/** Same retailer with both installment and full price: drop the cheap duplicate. */
function dropSameStoreInstallmentSpread(rows: TrustedListingInput[]): TrustedListingInput[] {
  const byStore = new Map<AllowedRetailKey, TrustedListingInput[]>();
  for (const r of rows) {
    if (!isAllowedRetailKey(r.store)) continue;
    const arr = byStore.get(r.store) ?? [];
    arr.push(r);
    byStore.set(r.store, arr);
  }
  const kept: TrustedListingInput[] = [];
  for (const [, g] of Array.from(byStore.entries())) {
    if (g.length < 2) {
      kept.push(...g);
      continue;
    }
    const lo = Math.min(...g.map((r) => r.price));
    const hi = Math.max(...g.map((r) => r.price));
    if (hi >= 180 && lo < 100 && hi / lo >= 4.5) {
      kept.push(...g.filter((r) => r.price > lo));
    } else {
      kept.push(...g);
    }
  }
  return kept;
}

/**
 * Keep allowlisted stores, drop used/refurb, strip installment/carrier junk, merge per retailer, then outlier rules.
 */
export function filterTrustedRetailListings(rows: TrustedListingInput[]): TrustedListingInput[] {
  let out = rows.filter((r) => isAllowedRetailKey(r.store));
  out = out.filter((r) => r.itemCondition === "new" || r.itemCondition === "unknown");
  out = dropVsPeerExtremeLow(out);
  out = dropSameStoreInstallmentSpread(out);
  out = mergeTrustedListingsByStore(out);
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
