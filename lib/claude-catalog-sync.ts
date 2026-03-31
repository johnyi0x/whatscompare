import { randomUUID } from "crypto";
import { Prisma } from "@prisma/client";
import { runAnthropicServerToolLoop } from "./anthropic-loop";
import { dailyBudgetUsd, getClaudeSpendUsd, recordClaudeSpendUsd, utcCalendarDay } from "./claude-budget";
import { affiliateOutboundUrl } from "./affiliate-url";
import { recomputeProductMetrics } from "./computed-metrics";
import { prisma } from "./prisma";
import { fetchOfficialListingPrices } from "./price-sources/official-prices";
import {
  filterTrustedRetailListings,
  inferItemCondition,
  type ItemCondition,
  type TrustedListingInput,
} from "./retail-listings";

function coerceItemCondition(s: string | null | undefined): ItemCondition {
  if (s === "new" || s === "used" || s === "refurbished" || s === "unknown") return s;
  return "unknown";
}

export function anthropicConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY?.trim());
}

function parseJsonObject(text: string): Record<string, unknown> {
  const t = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  const start = t.indexOf("{");
  const end = t.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("no_json_object");
  return JSON.parse(t.slice(start, end + 1)) as Record<string, unknown>;
}

function str(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  return s.length ? s : null;
}

function num(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = parseFloat(v.replace(/[^0-9.]/g, ""));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

export function isValidAmazonProductUrl(url: string): boolean {
  try {
    const href = url.trim().startsWith("http") ? url.trim() : `https://${url.trim()}`;
    const u = new URL(href);
    if (!/amazon\./i.test(u.hostname)) return false;
    return /\/dp\/[A-Z0-9]{8,}/i.test(u.pathname) || /\/gp\/product\//i.test(u.pathname);
  } catch {
    return false;
  }
}

export function isValidBestBuyProductUrl(url: string): boolean {
  try {
    const href = url.trim().startsWith("http") ? url.trim() : `https://${url.trim()}`;
    const u = new URL(href);
    return /\.bestbuy\.com$/i.test(u.hostname) && /\/site\//i.test(u.pathname);
  } catch {
    return false;
  }
}

function specsObject(v: unknown): Record<string, string> {
  if (!v || typeof v !== "object" || Array.isArray(v)) return {};
  const out: Record<string, string> = {};
  for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
    if (out && Object.keys(out).length >= 18) break;
    const ks = k.trim().slice(0, 80);
    if (!ks) continue;
    if (typeof val === "string") {
      const s = val.trim().slice(0, 500);
      if (s) out[ks] = s;
    } else if (typeof val === "number" && Number.isFinite(val)) {
      out[ks] = String(val);
    }
  }
  return out;
}

async function persistListingsAndSnapshots(
  productId: string,
  rows: TrustedListingInput[],
  now: Date,
): Promise<void> {
  const trusted = filterTrustedRetailListings(rows);
  const snapshotRows: Prisma.PriceSnapshotCreateManyInput[] = trusted.map((t) => ({
    id: randomUUID(),
    productId,
    store: t.store,
    price: new Prisma.Decimal(t.price.toFixed(2)),
    regularPrice: t.regularPrice != null ? new Prisma.Decimal(t.regularPrice.toFixed(2)) : null,
    inStock: t.inStock,
    recordedAt: now,
  }));

  await prisma.$transaction(async (tx) => {
    await tx.productStoreListing.deleteMany({ where: { productId } });
    for (const t of trusted) {
      await tx.productStoreListing.create({
        data: {
          id: randomUUID(),
          productId,
          store: t.store,
          storeLabel: t.storeLabel,
          storeUrl:
            t.store === "amazon" ? affiliateOutboundUrl("amazon", t.storeUrl) : t.storeUrl,
          currentPrice: new Prisma.Decimal(t.price.toFixed(2)),
          regularPrice:
            t.regularPrice != null ? new Prisma.Decimal(t.regularPrice.toFixed(2)) : null,
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
}

/**
 * One expensive call: title, image, both PDP URLs, specs, optional initial prices (web search billed per request).
 */
export async function enrichOneProduct(productId: string): Promise<{ estimatedUsd: number; ok: boolean; error?: string }> {
  const p = await prisma.product.findUnique({ where: { id: productId } });
  if (!p) return { estimatedUsd: 0, ok: false, error: "not_found" };
  if (p.enrichmentCompletedAt) return { estimatedUsd: 0, ok: true };

  const maxSearch = Math.min(8, Math.max(1, Number(process.env.CLAUDE_ENRICH_MAX_WEB_SEARCHES ?? 5)));

  const system =
    "Output one JSON object only. Keys: title,imageUrl,amazonUrl,bestBuyUrl,specs,amazonPrice,bestBuyPrice,currency. specs: ≤15 string fields. amazonUrl: https amazon.com /dp/ or /gp/product/. bestBuyUrl: https bestbuy.com/site/. Prices: USD number new buy box or null. No markdown or explanation.";

  const user = `P:${JSON.stringify({
    slug: p.slug,
    q: p.shoppingQuery,
    hint: p.shoppingMatchHint,
    t: p.title,
    brand: p.brand,
    cat: p.category,
  })}`;

  let loop: Awaited<ReturnType<typeof runAnthropicServerToolLoop>>;
  try {
    loop = await runAnthropicServerToolLoop({
      system,
      userText: user,
      tools: [{ type: "web_search_20250305", name: "web_search", max_uses: maxSearch }],
      maxTokens: Math.min(4096, Math.max(1024, Number(process.env.CLAUDE_ENRICH_MAX_TOKENS ?? 2500))),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { estimatedUsd: 0, ok: false, error: msg };
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = parseJsonObject(loop.text);
  } catch {
    return { estimatedUsd: loop.estimatedUsd, ok: false, error: "bad_json" };
  }

  const title = str(parsed.title) ?? p.title;
  let imageUrl = str(parsed.imageUrl);
  if (imageUrl && !/^https:\/\//i.test(imageUrl)) imageUrl = null;

  let amazonUrl = str(parsed.amazonUrl);
  let bestBuyUrl = str(parsed.bestBuyUrl);
  if (amazonUrl && !isValidAmazonProductUrl(amazonUrl)) amazonUrl = null;
  if (bestBuyUrl && !isValidBestBuyProductUrl(bestBuyUrl)) bestBuyUrl = null;

  const specs = specsObject(parsed.specs);
  const amazonPrice = num(parsed.amazonPrice);
  const bestBuyPrice = num(parsed.bestBuyPrice);
  const currency = str(parsed.currency) ?? p.currency;

  const rows: TrustedListingInput[] = [];
  if (amazonUrl && amazonPrice != null && amazonPrice > 0 && amazonPrice < 500_000) {
    rows.push({
      store: "amazon",
      storeLabel: "Amazon",
      storeUrl: amazonUrl,
      price: amazonPrice,
      regularPrice: null,
      rating: null,
      reviewCount: null,
      inStock: true,
      itemCondition: inferItemCondition([], title),
    });
  }
  if (bestBuyUrl && bestBuyPrice != null && bestBuyPrice > 0 && bestBuyPrice < 500_000) {
    rows.push({
      store: "bestbuy",
      storeLabel: "Best Buy",
      storeUrl: bestBuyUrl,
      price: bestBuyPrice,
      regularPrice: null,
      rating: null,
      reviewCount: null,
      inStock: true,
      itemCondition: inferItemCondition([], title),
    });
  }

  const complete =
    Boolean(title) &&
    Boolean(imageUrl) &&
    Boolean(amazonUrl) &&
    Boolean(bestBuyUrl);

  const now = new Date();

  await prisma.product.update({
    where: { id: p.id },
    data: {
      title,
      imageUrl: imageUrl ?? p.imageUrl,
      specsJson: Object.keys(specs).length ? specs : p.specsJson ?? undefined,
      amazonProductUrl: amazonUrl ?? p.amazonProductUrl,
      bestBuyProductUrl: bestBuyUrl ?? p.bestBuyProductUrl,
      currency,
      enrichmentCompletedAt: complete ? now : null,
      lastRefreshedAt: rows.length ? now : p.lastRefreshedAt,
    },
  });

  if (rows.length) {
    await persistListingsAndSnapshots(p.id, rows, now);
    await recomputeProductMetrics(p.id);
  } else if (complete) {
    await prisma.product.update({
      where: { id: p.id },
      data: { lastRefreshedAt: now },
    });
  }

  return { estimatedUsd: loop.estimatedUsd, ok: complete, error: complete ? undefined : "incomplete_enrich" };
}

type BatchRow = { slug: string; amazon: string | null; bestbuy: string | null };

async function refreshPricesForBatch(
  products: {
    id: string;
    slug: string;
    amazonProductUrl: string | null;
    bestBuyProductUrl: string | null;
    listings: { store: string; storeUrl: string }[];
  }[],
): Promise<{ estimatedUsd: number; ok: boolean; error?: string }> {
  const officialMerged = new Map<
    string,
    Partial<{ amazon: number; bestbuy: number; amazonReg: number | null; bestbuyReg: number | null }>
  >();

  for (const pr of products) {
    const off = await fetchOfficialListingPrices(pr.id);
    if (!off) continue;
    const cur: {
      amazon?: number;
      bestbuy?: number;
      amazonReg?: number | null;
      bestbuyReg?: number | null;
    } = {};
    if (off.amazon && off.amazon.price > 0) {
      cur.amazon = off.amazon.price;
      cur.amazonReg = off.amazon.regularPrice ?? null;
    }
    if (off.bestbuy && off.bestbuy.price > 0) {
      cur.bestbuy = off.bestbuy.price;
      cur.bestbuyReg = off.bestbuy.regularPrice ?? null;
    }
    if (Object.keys(cur).length) officialMerged.set(pr.slug, cur);
  }

  const needFetch: BatchRow[] = [];
  let fetchCount = 0;

  for (const pr of products) {
    const amz =
      pr.amazonProductUrl && isValidAmazonProductUrl(pr.amazonProductUrl)
        ? pr.amazonProductUrl
        : pr.listings.find((l) => l.store === "amazon")?.storeUrl ?? null;
    const bb =
      pr.bestBuyProductUrl && isValidBestBuyProductUrl(pr.bestBuyProductUrl)
        ? pr.bestBuyProductUrl
        : pr.listings.find((l) => l.store === "bestbuy")?.storeUrl ?? null;

    const off = officialMerged.get(pr.slug) ?? {};
    const needA = Boolean(amz) && off.amazon == null;
    const needB = Boolean(bb) && off.bestbuy == null;
    if (needA || needB) {
      needFetch.push({
        slug: pr.slug,
        amazon: needA ? amz : null,
        bestbuy: needB ? bb : null,
      });
      if (needA) fetchCount += 1;
      if (needB) fetchCount += 1;
    }
  }

  const slugUsedClaude = new Set(needFetch.map((r) => r.slug));

  let estimatedUsd = 0;

  if (fetchCount > 0) {
    const maxContent = Math.min(
      50_000,
      Math.max(2000, Number(process.env.CLAUDE_FETCH_MAX_CONTENT_TOKENS ?? 8000)),
    );

    const system =
      "Reply JSON only. Keys match input slugs. Values: {amazon:number|null,bestbuy:number|null} USD new full purchase price; null if unreadable.";

    const user = `Fetch URLs below; ignore /mo installment. Input: ${JSON.stringify(needFetch)}`;

    let loop: Awaited<ReturnType<typeof runAnthropicServerToolLoop>>;
    try {
      loop = await runAnthropicServerToolLoop({
        system,
        userText: user,
        tools: [
          {
            type: "web_fetch_20250910",
            name: "web_fetch",
            max_uses: Math.min(20, fetchCount + 2),
            max_content_tokens: maxContent,
          },
        ],
        maxTokens: Math.min(2048, Math.max(400, Number(process.env.CLAUDE_PRICE_MAX_TOKENS ?? 900))),
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      for (const pr of products) {
        const o = officialMerged.get(pr.slug) ?? {};
        await applyStorePrices(
          pr,
          o.amazon ?? null,
          o.bestbuy ?? null,
          o.amazonReg ?? null,
          o.bestbuyReg ?? null,
        );
      }
      return { estimatedUsd: 0, ok: false, error: msg };
    }

    estimatedUsd = loop.estimatedUsd;

    let parsed: Record<string, unknown>;
    try {
      parsed = parseJsonObject(loop.text);
    } catch {
      for (const pr of products) {
        const o = officialMerged.get(pr.slug) ?? {};
        await applyStorePrices(
          pr,
          o.amazon ?? null,
          o.bestbuy ?? null,
          o.amazonReg ?? null,
          o.bestbuyReg ?? null,
        );
      }
      return { estimatedUsd, ok: false, error: "price_bad_json" };
    }

    for (const pr of products) {
      const o = officialMerged.get(pr.slug) ?? {};
      let pa = o.amazon ?? null;
      let pb = o.bestbuy ?? null;
      if (slugUsedClaude.has(pr.slug)) {
        const block = parsed[pr.slug];
        if (block && typeof block === "object" && !Array.isArray(block)) {
          const b = block as Record<string, unknown>;
          if (pa == null) pa = num(b.amazon);
          if (pb == null) pb = num(b.bestbuy);
        }
      }
      await applyStorePrices(pr, pa, pb, o.amazonReg ?? null, o.bestbuyReg ?? null);
    }
  } else {
    for (const pr of products) {
      const o = officialMerged.get(pr.slug) ?? {};
      await applyStorePrices(pr, o.amazon ?? null, o.bestbuy ?? null, o.amazonReg ?? null, o.bestbuyReg ?? null);
    }
  }

  return { estimatedUsd, ok: true };
}

async function applyStorePrices(
  pr: {
    id: string;
    slug: string;
    amazonProductUrl: string | null;
    bestBuyProductUrl: string | null;
    listings: { store: string; storeUrl: string }[];
  },
  amazonPrice: number | null,
  bestbuyPrice: number | null,
  amazonReg: number | null,
  bestbuyReg: number | null,
): Promise<void> {
  const existing = await prisma.productStoreListing.findMany({ where: { productId: pr.id } });

  const amzUrl =
    pr.amazonProductUrl && isValidAmazonProductUrl(pr.amazonProductUrl)
      ? pr.amazonProductUrl
      : pr.listings.find((l) => l.store === "amazon")?.storeUrl ?? null;
  const bbUrl =
    pr.bestBuyProductUrl && isValidBestBuyProductUrl(pr.bestBuyProductUrl)
      ? pr.bestBuyProductUrl
      : pr.listings.find((l) => l.store === "bestbuy")?.storeUrl ?? null;

  let pa = amazonPrice;
  let pb = bestbuyPrice;
  let ra = amazonReg;
  let rb = bestbuyReg;

  const exAmz = existing.find((l) => l.store === "amazon");
  const exBb = existing.find((l) => l.store === "bestbuy");
  if (pa == null && exAmz) {
    pa = Number(exAmz.currentPrice);
    if (ra == null && exAmz.regularPrice != null) ra = Number(exAmz.regularPrice);
  }
  if (pb == null && exBb) {
    pb = Number(exBb.currentPrice);
    if (rb == null && exBb.regularPrice != null) rb = Number(exBb.regularPrice);
  }

  const rows: TrustedListingInput[] = [];
  if (amzUrl && pa != null && pa > 0 && pa < 500_000) {
    rows.push({
      store: "amazon",
      storeLabel: "Amazon",
      storeUrl: amzUrl,
      price: pa,
      regularPrice: ra,
      rating: exAmz?.rating != null ? Number(exAmz.rating) : null,
      reviewCount: exAmz?.reviewCount ?? null,
      inStock: exAmz?.inStock ?? true,
      itemCondition: coerceItemCondition(exAmz?.listingCondition ?? undefined),
    });
  }
  if (bbUrl && pb != null && pb > 0 && pb < 500_000) {
    rows.push({
      store: "bestbuy",
      storeLabel: "Best Buy",
      storeUrl: bbUrl,
      price: pb,
      regularPrice: rb,
      rating: exBb?.rating != null ? Number(exBb.rating) : null,
      reviewCount: exBb?.reviewCount ?? null,
      inStock: exBb?.inStock ?? true,
      itemCondition: coerceItemCondition(exBb?.listingCondition ?? undefined),
    });
  }

  if (!rows.length) return;

  const now = new Date();
  await persistListingsAndSnapshots(pr.id, rows, now);
  await prisma.product.update({
    where: { id: pr.id },
    data: { lastRefreshedAt: now },
  });
  await recomputeProductMetrics(pr.id);
}

export async function runClaudeCatalogCron(): Promise<{
  enriched: number;
  priceBatches: number;
  productsPriceTouched: number;
  estimatedUsd: number;
  errors: string[];
}> {
  const day = utcCalendarDay();
  let spent = await getClaudeSpendUsd(day);
  const budget = dailyBudgetUsd();
  const errors: string[] = [];
  let enriched = 0;
  let priceBatches = 0;
  let productsPriceTouched = 0;

  const enrichReserve = Math.max(0.02, Number(process.env.CLAUDE_ENRICH_BUDGET_RESERVE_USD ?? 0.12));
  const batchSize = Math.min(
    8,
    Math.max(1, Math.floor(Number(process.env.CLAUDE_PRICE_BATCH_SIZE ?? 4))),
  );

  const pending = await prisma.product.findMany({
    where: { enrichmentCompletedAt: null },
    orderBy: { createdAt: "asc" },
  });

  for (const p of pending) {
    if (spent >= budget - 0.001) break;
    if (spent + enrichReserve > budget) break;
    const r = await enrichOneProduct(p.id);
    spent += r.estimatedUsd;
    await recordClaudeSpendUsd(day, r.estimatedUsd);
    if (r.ok) enriched += 1;
    else errors.push(`${p.slug}:enrich:${r.error ?? "fail"}`);
  }

  const enrichedProducts = await prisma.product.findMany({
    where: { enrichmentCompletedAt: { not: null } },
    include: { listings: true },
  });
  enrichedProducts.sort((a, b) => {
    const at = a.lastRefreshedAt?.getTime() ?? 0;
    const bt = b.lastRefreshedAt?.getTime() ?? 0;
    if (a.lastRefreshedAt == null && b.lastRefreshedAt != null) return -1;
    if (b.lastRefreshedAt == null && a.lastRefreshedAt != null) return 1;
    if (at !== bt) return at - bt;
    return a.slug.localeCompare(b.slug);
  });

  for (;;) {
    if (spent >= budget - 0.001) break;
    const slice = enrichedProducts.slice(0, batchSize);
    enrichedProducts.splice(0, batchSize);
    if (!slice.length) break;

    const batchReserve = Math.max(0.03, Number(process.env.CLAUDE_PRICE_BATCH_RESERVE_USD ?? 0.06) * batchSize);
    if (spent + batchReserve > budget) break;

    const r = await refreshPricesForBatch(
      slice.map((p) => ({
        id: p.id,
        slug: p.slug,
        amazonProductUrl: p.amazonProductUrl,
        bestBuyProductUrl: p.bestBuyProductUrl,
        listings: p.listings.map((l) => ({ store: l.store, storeUrl: l.storeUrl })),
      })),
    );
    spent += r.estimatedUsd;
    await recordClaudeSpendUsd(day, r.estimatedUsd);
    priceBatches += 1;
    if (r.ok) productsPriceTouched += slice.length;
    else errors.push(`batch:${r.error ?? "fail"}`);
  }

  return { enriched, priceBatches, productsPriceTouched, estimatedUsd: spent, errors };
}
