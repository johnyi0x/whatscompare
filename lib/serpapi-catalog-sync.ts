import { randomUUID } from "crypto";
import { Prisma } from "@prisma/client";
import { affiliateOutboundUrl } from "./affiliate-url";
import { recomputeProductMetrics } from "./computed-metrics";
import { prisma } from "./prisma";
import {
  canonicalAllowedRetailKey,
  filterTrustedRetailListings,
  inferItemCondition,
  looksLikeMonthlyInstallment,
  type TrustedListingInput,
} from "./retail-listings";
import { inferInStockFromDetails } from "./store-key";

const SERP = "https://serpapi.com/search.json";

export function serpApiConfigured(): boolean {
  return Boolean(process.env.SERPAPI_API_KEY?.trim());
}

type ShoppingItem = {
  title?: string;
  /** Direct retailer URL when present */
  link?: string;
  /** Google Shopping product page (often no retailer hostname) */
  product_link?: string;
  tracking_link?: string;
  source?: string;
  price?: string;
  extracted_price?: number;
  /** SerpApi may flag financing / per-month pricing */
  installment?: string | Record<string, unknown> | boolean;
  product_id?: string;
  immersive_product_page_token?: string;
  thumbnail?: string;
  serpapi_immersive_product_api?: string;
};

type ImmersiveStore = {
  name?: string;
  link?: string;
  extracted_price?: number;
  price?: string;
  extracted_original_price?: number;
  original_price?: string;
  rating?: number;
  reviews?: number;
  details_and_offers?: string[];
};

function parseMoney(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = parseFloat(v.replace(/[^0-9.]/g, ""));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function extractShoppingResults(json: Record<string, unknown>): ShoppingItem[] {
  const out: ShoppingItem[] = [];
  const push = (arr: unknown) => {
    if (Array.isArray(arr)) out.push(...(arr as ShoppingItem[]));
  };
  push(json.shopping_results);
  push(json.inline_shopping_results);
  const cat = json.categorized_shopping_results;
  if (Array.isArray(cat)) {
    for (const c of cat) {
      if (c && typeof c === "object" && "shopping_results" in c) {
        push((c as { shopping_results?: unknown }).shopping_results);
      }
    }
  }
  return out;
}

function pickShoppingItem(items: ShoppingItem[], hint?: string | null): ShoppingItem | null {
  if (!items.length) return null;
  const h = hint?.trim().toLowerCase();
  if (h) {
    const hit = items.find((i) => i.title?.toLowerCase().includes(h));
    if (hit) return hit;
  }
  return items[0];
}

async function serpGet(params: Record<string, string>): Promise<{ ok: true; json: Record<string, unknown> } | { ok: false; error: string }> {
  const key = process.env.SERPAPI_API_KEY?.trim();
  if (!key) return { ok: false, error: "no API key" };
  const url = new URL(SERP);
  url.searchParams.set("api_key", key);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  const res = await fetch(url.toString(), { cache: "no-store" });
  const json = (await res.json()) as Record<string, unknown>;
  if (!res.ok) {
    return { ok: false, error: (json.error as string) || `HTTP ${res.status}` };
  }
  if (json.error) return { ok: false, error: String(json.error) };
  return { ok: true, json };
}

/** Cached by default (no_cache=false) — does not count against quota when cache hits. */
export async function fetchGoogleShopping(query: string): Promise<{ ok: true; items: ShoppingItem[] } | { ok: false; error: string }> {
  const gl = process.env.SERPAPI_GL?.trim() || "us";
  const hl = process.env.SERPAPI_HL?.trim() || "en";
  const r = await serpGet({
    engine: "google_shopping",
    q: query,
    gl,
    hl,
    google_domain: "google.com",
    device: "desktop",
    no_cache: "false",
  });
  if (!r.ok) return r;
  return { ok: true, items: extractShoppingResults(r.json) };
}

export async function fetchImmersiveProduct(pageToken: string): Promise<
  | { ok: true; product: Record<string, unknown> }
  | { ok: false; error: string }
> {
  const r = await serpGet({
    engine: "google_immersive_product",
    page_token: pageToken,
    no_cache: "false",
  });
  if (!r.ok) return r;
  const pr = r.json.product_results;
  if (!pr || typeof pr !== "object") {
    return { ok: false, error: "no product_results" };
  }
  return { ok: true, product: pr as Record<string, unknown> };
}

function parseStores(product: Record<string, unknown>): ImmersiveStore[] {
  const s = product.stores;
  return Array.isArray(s) ? (s as ImmersiveStore[]) : [];
}

function extractDestinationFromGoogleRedirect(href: string): string | null {
  try {
    const u = new URL(href);
    const adurl = u.searchParams.get("adurl") || u.searchParams.get("url");
    if (adurl) {
      const decoded = decodeURIComponent(adurl.replace(/\+/g, " "));
      if (/^https?:\/\//i.test(decoded)) return decoded;
    }
    const q = u.searchParams.get("q");
    if (q && /^https?:\/\//i.test(q)) return decodeURIComponent(q.replace(/\+/g, " "));
  } catch {
    /* ignore */
  }
  return null;
}

/** SerpApi shopping rows often use `product_link` / `tracking_link` instead of `link`. */
function retailerUrlFromShoppingItem(item: ShoppingItem): string | null {
  const direct = item.link?.trim();
  if (direct && /\.amazon\./i.test(direct) && !/google\.com\/shopping\/product/i.test(direct)) {
    return direct;
  }
  if (direct && /\/dp\/|\/gp\/product\//i.test(direct) && !/google\.com\/shopping/i.test(direct)) {
    return direct;
  }
  const tr = item.tracking_link?.trim();
  if (tr) {
    const dest = extractDestinationFromGoogleRedirect(tr);
    if (dest && /\.amazon\./i.test(dest)) return dest;
  }
  const pl = item.product_link?.trim();
  if (pl) {
    const dest = extractDestinationFromGoogleRedirect(pl);
    if (dest && /\.amazon\./i.test(dest)) return dest;
  }
  if (direct && !/google\.com\/shopping\/product/i.test(direct)) return direct || null;
  return null;
}

function shoppingItemHasInstallmentFlag(item: ShoppingItem): boolean {
  const inst = item.installment;
  if (inst != null && inst !== false && inst !== "") return true;
  return looksLikeMonthlyInstallment([item.title, item.price, item.source]);
}

type AmazonOrganic = {
  sponsored?: boolean;
  title?: string;
  link_clean?: string;
  link?: string;
  extracted_price?: number;
  price?: string;
};

/** Normalize SerpApi Amazon Search links (including sspa/click URLs that embed /dp/ASIN). */
function pickAmazonUrlFromOrganic(pick: AmazonOrganic): string | null {
  const raw = pick.link_clean?.trim() || pick.link?.trim();
  if (!raw) return null;
  try {
    const href = raw.startsWith("//") ? `https:${raw}` : raw;
    const u = new URL(href);
    if (!/amazon\./i.test(u.hostname)) return null;
    if (/\/dp\/[a-z0-9]{8,}/i.test(u.pathname) || /\/gp\/product\//i.test(u.pathname)) {
      return href;
    }
    const decoded = decodeURIComponent(href);
    const m = decoded.match(/\/dp\/([a-z0-9]{8,})/i);
    if (m) return `https://${u.hostname}/dp/${m[1]}`;
  } catch {
    /* ignore */
  }
  return null;
}

type AmazonQueryContext = {
  shoppingQuery: string;
  shoppingMatchHint: string | null;
  title: string;
  brand: string | null;
};

/** Distinct Amazon Search queries to try when the first query misses (e.g. Xbox vs TV naming). */
function buildAmazonSearchQueries(ctx: AmazonQueryContext): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  const add = (s: string | null | undefined) => {
    const t = (s ?? "").replace(/\s+/g, " ").trim();
    if (t.length < 2) return;
    const k = t.toLowerCase();
    if (seen.has(k)) return;
    seen.add(k);
    out.push(t);
  };

  add(ctx.shoppingQuery);
  add(ctx.shoppingMatchHint);
  if (ctx.brand && ctx.shoppingMatchHint) add(`${ctx.brand} ${ctx.shoppingMatchHint}`);
  if (ctx.brand) add(ctx.brand);
  add(ctx.title.slice(0, 120));
  const head = ctx.title.split(/\s+/).filter(Boolean).slice(0, 10).join(" ");
  if (head.length > 8) add(head);

  return out;
}

/**
 * Amazon Search API — real amazon.com /dp/ URLs + prices. Set SERPAPI_AMAZON_ENGINE=0 to skip.
 */
async function fetchAmazonFromAmazonEngine(
  searchQuery: string,
  shoppingMatchHint: string | null
): Promise<{ row: TrustedListingInput | null; apiCalls: number }> {
  if (process.env.SERPAPI_AMAZON_ENGINE === "0") {
    return { row: null, apiCalls: 0 };
  }
  const domain = process.env.AMAZON_DOMAIN?.trim() || "amazon.com";
  const r = await serpGet({
    engine: "amazon",
    k: searchQuery,
    amazon_domain: domain,
    device: "desktop",
    no_cache: "false",
  });
  if (!r.ok) return { row: null, apiCalls: 1 };
  const org = r.json.organic_results;
  if (!Array.isArray(org) || org.length === 0) return { row: null, apiCalls: 1 };

  const list = org as AmazonOrganic[];
  const organicFirst = list.filter((x) => !x.sponsored);
  const pool = organicFirst.length ? organicFirst : list;
  const h = shoppingMatchHint?.trim().toLowerCase();
  const ranked = h
    ? [...pool].sort((a, b) => {
        const at = a.title?.toLowerCase().includes(h) ? 1 : 0;
        const bt = b.title?.toLowerCase().includes(h) ? 1 : 0;
        return bt - at;
      })
    : pool;

  for (const pick of ranked.slice(0, 12)) {
    const url = pickAmazonUrlFromOrganic(pick);
    const price =
      typeof pick.extracted_price === "number" && Number.isFinite(pick.extracted_price)
        ? pick.extracted_price
        : parseMoney(pick.price);
    if (!url || price == null) continue;
    if (looksLikeMonthlyInstallment([pick.title, pick.price])) continue;
    return {
      row: {
        store: "amazon",
        storeLabel: "Amazon",
        storeUrl: url,
        price,
        regularPrice: null,
        rating: null,
        reviewCount: null,
        inStock: true,
        itemCondition: inferItemCondition([], pick.title),
      },
      apiCalls: 1,
    };
  }

  return { row: null, apiCalls: 1 };
}

/**
 * When immersive omits Amazon: Google Shopping (… amazon.com) then several SerpApi Amazon Search queries.
 * SERPAPI_AMAZON_FALLBACK=0 disables both steps.
 */
async function fetchAmazonListingFallback(
  ctx: AmazonQueryContext
): Promise<{ row: TrustedListingInput | null; apiCalls: number }> {
  if (process.env.SERPAPI_AMAZON_FALLBACK === "0") {
    return { row: null, apiCalls: 0 };
  }

  let apiCalls = 0;
  const shop = await fetchGoogleShopping(`${ctx.shoppingQuery} amazon.com`);
  apiCalls += 1;
  if (shop.ok) {
    const candidates: ShoppingItem[] = [];
    for (const raw of shop.items) {
      const item = raw as ShoppingItem;
      if (shoppingItemHasInstallmentFlag(item)) continue;
      const url = retailerUrlFromShoppingItem(item);
      if (!url || !/\.amazon\./i.test(url)) continue;
      if (canonicalAllowedRetailKey(item.source ?? "Amazon", url) !== "amazon") continue;
      const price =
        typeof item.extracted_price === "number" && Number.isFinite(item.extracted_price)
          ? item.extracted_price
          : parseMoney(item.price);
      if (price == null) continue;
      candidates.push(item);
    }
    const item = pickShoppingItem(candidates, ctx.shoppingMatchHint) ?? candidates[0];
    if (item) {
      const url = retailerUrlFromShoppingItem(item)!;
      const price =
        typeof item.extracted_price === "number" && Number.isFinite(item.extracted_price)
          ? item.extracted_price
          : parseMoney(item.price)!;
      return {
        row: {
          store: "amazon",
          storeLabel: "Amazon",
          storeUrl: url,
          price,
          regularPrice: null,
          rating: null,
          reviewCount: null,
          inStock: true,
          itemCondition: inferItemCondition([], item.title),
        },
        apiCalls,
      };
    }
  }

  if (process.env.SERPAPI_AMAZON_ENGINE === "0") {
    return { row: null, apiCalls };
  }

  const queries = buildAmazonSearchQueries(ctx);
  const maxTries = Math.min(
    queries.length,
    Math.min(6, Math.max(1, Number(process.env.SERPAPI_AMAZON_MAX_ENGINE_TRIES || 4)))
  );
  let engineRow: TrustedListingInput | null = null;
  for (let i = 0; i < maxTries; i++) {
    const q = queries[i];
    if (!q) break;
    const engine = await fetchAmazonFromAmazonEngine(q, ctx.shoppingMatchHint);
    apiCalls += engine.apiCalls;
    if (engine.row) {
      engineRow = engine.row;
      break;
    }
  }

  return { row: engineRow, apiCalls };
}

export type SyncOneResult = { productId: string; apiCalls: number; ok: boolean; error?: string };

/**
 * Resolve immersive token via Google Shopping if missing, then fetch immersive stores, upsert listings, append snapshots, recompute metrics.
 */
export async function syncOneProduct(productId: string): Promise<SyncOneResult> {
  let apiCalls = 0;
  const p = await prisma.product.findUnique({ where: { id: productId } });
  if (!p) return { productId, apiCalls: 0, ok: false, error: "not found" };

  let token = p.immersivePageToken;

  if (!token) {
    const shop = await fetchGoogleShopping(p.shoppingQuery);
    apiCalls += 1;
    if (!shop.ok) {
      return { productId, apiCalls, ok: false, error: shop.error };
    }
    const item = pickShoppingItem(shop.items, p.shoppingMatchHint);
    if (!item?.immersive_product_page_token) {
      return { productId, apiCalls, ok: false, error: "no immersive token in shopping results" };
    }
    token = item.immersive_product_page_token;
    await prisma.product.update({
      where: { id: p.id },
      data: {
        immersivePageToken: token,
        googleProductId: item.product_id ?? p.googleProductId,
        imageUrl: item.thumbnail ?? p.imageUrl,
        title: item.title && item.title.length > p.title.length ? item.title : p.title,
      },
    });
  }

  const imm = await fetchImmersiveProduct(token);
  apiCalls += 1;
  if (!imm.ok) {
    // Token may be stale — clear to force shopping re-discovery next run
    await prisma.product.update({
      where: { id: p.id },
      data: { immersivePageToken: null },
    });
    return { productId, apiCalls, ok: false, error: imm.error };
  }

  const stores = parseStores(imm.product);
  if (!stores.length) {
    return { productId, apiCalls, ok: false, error: "no stores in immersive response" };
  }

  const parsed: TrustedListingInput[] = [];
  for (const st of stores) {
    const name = st.name?.trim() || "";
    const link = st.link?.trim() || "";
    if (!name && !link) continue;
    if (
      looksLikeMonthlyInstallment([
        st.price,
        st.original_price,
        ...(st.details_and_offers ?? []),
      ])
    ) {
      continue;
    }
    const store = canonicalAllowedRetailKey(name || "Unknown", link || undefined);
    if (!store) continue;
    const price = parseMoney(st.extracted_price) ?? parseMoney(st.price);
    if (price == null) continue;
    const reg = parseMoney(st.extracted_original_price) ?? parseMoney(st.original_price);
    const inStock = inferInStockFromDetails(st.details_and_offers);
    const url = link || "#";
    const itemCondition = inferItemCondition(st.details_and_offers, name);
    parsed.push({
      store,
      storeLabel: name || store,
      storeUrl: url,
      price,
      regularPrice: reg,
      rating: st.rating ?? null,
      reviewCount: st.reviews ?? null,
      inStock,
      itemCondition,
    });
  }

  let trusted = filterTrustedRetailListings(parsed);
  if (!trusted.some((t) => t.store === "amazon")) {
    const fb = await fetchAmazonListingFallback({
      shoppingQuery: p.shoppingQuery,
      shoppingMatchHint: p.shoppingMatchHint,
      title: p.title,
      brand: p.brand,
    });
    apiCalls += fb.apiCalls;
    if (fb.row) {
      trusted = filterTrustedRetailListings([...parsed, fb.row]);
    }
  }
  if (!trusted.length) {
    await prisma.productStoreListing.deleteMany({ where: { productId: p.id } });
    return {
      productId,
      apiCalls,
      ok: false,
      error: "no trusted listings after allowlist + condition/outlier filters",
    };
  }

  const now = new Date();
  const snapshotRows: Prisma.PriceSnapshotCreateManyInput[] = trusted.map((t) => ({
    id: randomUUID(),
    productId: p.id,
    store: t.store,
    price: new Prisma.Decimal(t.price.toFixed(2)),
    regularPrice: t.regularPrice != null ? new Prisma.Decimal(t.regularPrice.toFixed(2)) : null,
    inStock: t.inStock,
    recordedAt: now,
  }));

  await prisma.$transaction(async (tx) => {
    await tx.productStoreListing.deleteMany({ where: { productId: p.id } });
    for (const t of trusted) {
      await tx.productStoreListing.create({
        data: {
          id: randomUUID(),
          productId: p.id,
          store: t.store,
          storeLabel: t.storeLabel,
          storeUrl:
            t.store === "amazon" ? affiliateOutboundUrl("amazon", t.storeUrl) : t.storeUrl,
          currentPrice: new Prisma.Decimal(t.price.toFixed(2)),
          regularPrice: t.regularPrice != null ? new Prisma.Decimal(t.regularPrice.toFixed(2)) : null,
          rating: t.rating != null ? new Prisma.Decimal(t.rating) : null,
          reviewCount: t.reviewCount,
          inStock: t.inStock,
          listingCondition: t.itemCondition,
        },
      });
    }
  });

  if (snapshotRows.length) {
    await prisma.priceSnapshot.createMany({ data: snapshotRows });
  }

  await prisma.product.update({
    where: { id: p.id },
    data: { lastRefreshedAt: now },
  });

  await recomputeProductMetrics(p.id);

  return { productId, apiCalls, ok: true };
}

function staleByTier(tier: number, last: Date | null, now: number): boolean {
  if (!last) return true;
  const ms = now - last.getTime();
  const h = ms / (60 * 60 * 1000);
  if (tier === 1) return h >= 3;
  if (tier === 2) return h >= 24;
  return h >= 72;
}

/**
 * Tier-priority refresh with a hard API call budget (immersive + shopping each count as 1).
 * Intended for daily Vercel cron: keep monthly SerpApi usage under control.
 */
export async function runTieredCatalogSync(): Promise<{
  processed: number;
  apiCalls: number;
  errors: string[];
}> {
  const maxCalls = Math.min(50, Math.max(1, Number(process.env.SERPAPI_MAX_CALLS_PER_RUN || 8)));
  const errors: string[] = [];
  let apiCalls = 0;
  let processed = 0;

  const now = Date.now();
  const candidates = await prisma.product.findMany();
  candidates.sort((a, b) => {
    if (a.tier !== b.tier) return a.tier - b.tier;
    const at = a.lastRefreshedAt;
    const bt = b.lastRefreshedAt;
    if (at == null && bt == null) return 0;
    if (at == null) return -1;
    if (bt == null) return 1;
    return at.getTime() - bt.getTime();
  });

  const due = candidates.filter((c) => staleByTier(c.tier, c.lastRefreshedAt, now));

  for (const c of due) {
    if (apiCalls >= maxCalls) break;
    const remainingBudget = maxCalls - apiCalls;
    // Worst case includes multiple Amazon Search tries (see SERPAPI_AMAZON_MAX_ENGINE_TRIES, default 4).
    const minNeeded = c.immersivePageToken ? 6 : 7;
    if (remainingBudget < minNeeded) break;

    const r = await syncOneProduct(c.id);
    apiCalls += r.apiCalls;
    if (r.ok) processed += 1;
    else errors.push(`${c.slug}: ${r.error}`);
  }

  return { processed, apiCalls, errors };
}
