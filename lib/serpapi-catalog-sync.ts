import { randomUUID } from "crypto";
import { Prisma } from "@prisma/client";
import { recomputeProductMetrics } from "./computed-metrics";
import { prisma } from "./prisma";
import {
  filterTrustedRetailListings,
  inferItemCondition,
  type TrustedListingInput,
} from "./retail-listings";
import { inferInStockFromDetails, storeKeyFromSerpName } from "./store-key";

const SERP = "https://serpapi.com/search.json";

export function serpApiConfigured(): boolean {
  return Boolean(process.env.SERPAPI_API_KEY?.trim());
}

type ShoppingItem = {
  title?: string;
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
    const name = st.name?.trim() || "unknown";
    const store = storeKeyFromSerpName(name);
    const price = parseMoney(st.extracted_price) ?? parseMoney(st.price);
    if (price == null) continue;
    const reg = parseMoney(st.extracted_original_price) ?? parseMoney(st.original_price);
    const inStock = inferInStockFromDetails(st.details_and_offers);
    const url = st.link?.trim() || "#";
    const itemCondition = inferItemCondition(st.details_and_offers, name);
    parsed.push({
      store,
      storeLabel: name,
      storeUrl: url,
      price,
      regularPrice: reg,
      rating: st.rating ?? null,
      reviewCount: st.reviews ?? null,
      inStock,
      itemCondition,
    });
  }

  const trusted = filterTrustedRetailListings(parsed);
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
          storeUrl: t.storeUrl,
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
    // Worst case: shopping + immersive = 2
    if (!c.immersivePageToken && remainingBudget < 2) break;

    const r = await syncOneProduct(c.id);
    apiCalls += r.apiCalls;
    if (r.ok) processed += 1;
    else errors.push(`${c.slug}: ${r.error}`);
  }

  return { processed, apiCalls, errors };
}
