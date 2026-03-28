import type { Merchant, Product } from "@prisma/client";
import { ingestedProductWhere } from "./ingested-products";
import { prisma } from "./prisma";
import { buildAmazonProductUrl, getPartnerTagOrPlaceholder } from "./amazon-affiliate";

const SERPAPI_SEARCH = "https://serpapi.com/search.json";

/** Default ASINs for stub seed + first-run SerpApi ingest when `INGEST_ASINS` is empty or short. */
export const DEFAULT_SERAPI_BOOTSTRAP_ASINS = [
  "B0CHLMJMWL",
  "B08H83C89C",
  "B0CMV9PYRQ",
  "B09B8V1LZ3",
  "B0CGJQG1TW",
] as const;

type ProductResults = {
  asin?: string;
  title?: string;
  description?: string;
  thumbnails?: string[];
  extracted_price?: number;
  extracted_old_price?: number;
  badges?: string[];
};

type SerpApiResponse = {
  error?: string;
  product_results?: ProductResults;
  search_metadata?: { status?: string };
};

export function serpApiConfigured(): boolean {
  return Boolean(process.env.SERPAPI_API_KEY?.trim());
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Fetches one ASIN via SerpApi `engine=amazon_product`. Uses default caching (no_cache=false) so
 * identical queries within SerpApi’s cache window may not bill as new searches — see SerpApi pricing docs.
 */
export async function fetchAmazonProductFromSerpApi(asin: string): Promise<{
  ok: true;
  data: ProductResults;
} | { ok: false; error: string }> {
  const apiKey = process.env.SERPAPI_API_KEY!.trim();
  const domain = process.env.SERPAPI_AMAZON_DOMAIN?.trim() || "amazon.com";

  const url = new URL(SERPAPI_SEARCH);
  url.searchParams.set("engine", "amazon_product");
  url.searchParams.set("asin", asin.toUpperCase());
  url.searchParams.set("amazon_domain", domain.replace(/^www\./, ""));
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("language", process.env.SERPAPI_LANGUAGE?.trim() || "en_US");

  const res = await fetch(url.toString(), { cache: "no-store" });
  const json = (await res.json()) as SerpApiResponse;

  if (!res.ok) {
    return { ok: false, error: json.error || `HTTP ${res.status}` };
  }
  if (json.error) {
    return { ok: false, error: json.error };
  }
  if (!json.product_results || !json.product_results.title) {
    return { ok: false, error: "No product_results in SerpApi response" };
  }

  return { ok: true, data: json.product_results };
}

type ProductWithMerchant = Product & { merchant: Merchant };

async function persistSerpApiResult(
  product: ProductWithMerchant,
  pr: ProductResults,
  tag: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const asin = product.externalId;
  const thumb = pr.thumbnails?.[0] ?? null;
  const price = pr.extracted_price;
  if (price == null || Number.isNaN(price)) {
    return { ok: false, error: "missing extracted_price" };
  }

  const listPrice = pr.extracted_old_price ?? null;
  const dealParts = (pr.badges ?? []).slice(0, 2);
  const dealLabel = dealParts.length ? dealParts.join(" · ") : null;
  const affiliateUrl = buildAmazonProductUrl(asin, { partnerTag: tag });
  const now = new Date();

  try {
    await prisma.$transaction([
      prisma.product.update({
        where: { id: product.id },
        data: {
          title: pr.title ?? product.title,
          description: pr.description ?? product.description,
          imageUrl: thumb ?? product.imageUrl,
          imageSource: thumb ? "serpapi" : product.imageSource,
          serpapiSyncedAt: now,
        },
      }),
      prisma.offer.create({
        data: {
          productId: product.id,
          merchantId: product.merchantId,
          priceAmount: price,
          currency: "USD",
          listPriceAmount: listPrice,
          dealLabel,
          affiliateUrl,
          fetchedAt: now,
          source: "serpapi",
          availabilityNote: "Price from SerpApi Amazon Product engine; verify on Amazon before purchase.",
          lastSyncedAt: now,
        },
      }),
      prisma.priceHistory.create({
        data: {
          productId: product.id,
          priceAmount: price,
          currency: "USD",
          source: "serpapi",
        },
      }),
    ]);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * After seed: if nothing is ingest-visible yet and SerpApi is configured, fetch up to `max` Amazon stubs.
 * Set SERPAPI_BOOTSTRAP_ON_SEED=0 to skip (e.g. avoid API use on local seed).
 */
export async function bootstrapSerpApiIfEmpty(max = 5): Promise<{
  updated: number;
  errors: string[];
  skipped: boolean;
  reason?: string;
}> {
  const errors: string[] = [];
  if (process.env.SERPAPI_BOOTSTRAP_ON_SEED === "0") {
    return { updated: 0, errors, skipped: true, reason: "disabled" };
  }
  if (!serpApiConfigured()) {
    return { updated: 0, errors, skipped: true, reason: "no_api_key" };
  }

  const ingested = await prisma.product.count({ where: ingestedProductWhere });
  if (ingested > 0) {
    return { updated: 0, errors, skipped: true, reason: "already_ingested" };
  }

  const delayMs = Math.max(0, Number(process.env.SERPAPI_REQUEST_DELAY_MS || 400));
  const cap = Math.min(25, Math.max(1, max));
  const candidates = await prisma.product.findMany({
    where: { merchant: { slug: "amazon" }, serpapiSyncedAt: null },
    orderBy: { updatedAt: "asc" },
    take: cap,
    include: { merchant: true },
  });

  if (candidates.length === 0) {
    return { updated: 0, errors, skipped: true, reason: "no_stub_products" };
  }

  const tag = getPartnerTagOrPlaceholder();
  let updated = 0;

  for (const product of candidates) {
    const asin = product.externalId;
    const result = await fetchAmazonProductFromSerpApi(asin);
    if (!result.ok) {
      errors.push(`${asin}: ${result.error}`);
      if (delayMs) await sleep(delayMs);
      continue;
    }

    const saved = await persistSerpApiResult(product, result.data, tag);
    if (!saved.ok) {
      errors.push(`${asin}: ${saved.error}`);
    } else {
      updated += 1;
    }

    if (delayMs) await sleep(delayMs);
  }

  return { updated, errors, skipped: false };
}

/**
 * DB-first refresh: only products stale by TTL, capped per run. Never call from page render.
 */
export async function syncStaleProductsFromSerpApi(): Promise<{
  updated: number;
  skippedStaleOk: number;
  errors: string[];
}> {
  const errors: string[] = [];
  const refreshHours = Math.max(6, Number(process.env.SERPAPI_REFRESH_HOURS || 48));
  const maxPerRun = Math.min(25, Math.max(1, Number(process.env.SERPAPI_MAX_PER_RUN || 5)));
  const delayMs = Math.max(0, Number(process.env.SERPAPI_REQUEST_DELAY_MS || 400));

  const cutoff = new Date(Date.now() - refreshHours * 60 * 60 * 1000);

  const neverSynced = await prisma.product.findMany({
    where: { merchant: { slug: "amazon" }, serpapiSyncedAt: null },
    orderBy: { updatedAt: "asc" },
    take: maxPerRun,
    include: { merchant: true },
  });

  const remaining = maxPerRun - neverSynced.length;
  const outdated =
    remaining > 0
      ? await prisma.product.findMany({
          where: {
            merchant: { slug: "amazon" },
            serpapiSyncedAt: { lt: cutoff },
          },
          orderBy: { serpapiSyncedAt: "asc" },
          take: remaining,
          include: { merchant: true },
        })
      : [];

  const stale = [...neverSynced, ...outdated];
  const skippedStaleOk = 0;
  let updated = 0;
  const tag = getPartnerTagOrPlaceholder();

  for (const product of stale) {
    const asin = product.externalId;
    const result = await fetchAmazonProductFromSerpApi(asin);
    if (!result.ok) {
      errors.push(`${asin}: ${result.error}`);
      if (delayMs) await sleep(delayMs);
      continue;
    }

    const saved = await persistSerpApiResult(product, result.data, tag);
    if (!saved.ok) {
      errors.push(`${asin}: ${saved.error}`);
    } else {
      updated += 1;
    }

    if (delayMs) await sleep(delayMs);
  }

  return { updated, skippedStaleOk, errors };
}
