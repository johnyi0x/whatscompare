import { Prisma } from "@prisma/client";
import { ALLOWED_RETAIL_KEYS } from "./retail-listings";
import { prisma } from "./prisma";

function mean(nums: number[]): number | null {
  if (!nums.length) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function stdev(nums: number[]): number | null {
  if (nums.length < 2) return null;
  const m = mean(nums);
  if (m == null) return null;
  const v = nums.reduce((s, x) => s + (x - m) ** 2, 0) / (nums.length - 1);
  return Math.sqrt(v);
}

/**
 * Recompute deal score, trends, volatility, cheapest-store stats from append-only PriceSnapshot rows.
 */
export async function recomputeProductMetrics(productId: string): Promise<void> {
  const now = new Date();
  const d90 = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
  const d14 = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

  const snaps = await prisma.priceSnapshot.findMany({
    where: {
      productId,
      recordedAt: { gte: d90 },
      store: { in: [...ALLOWED_RETAIL_KEYS] },
    },
    orderBy: { recordedAt: "asc" },
  });

  const listings = await prisma.productStoreListing.findMany({
    where: { productId, store: { in: [...ALLOWED_RETAIL_KEYS] } },
  });

  const currentLow =
    listings.length > 0
      ? Math.min(...listings.map((l) => Number(l.currentPrice)))
      : null;

  // Daily minimum price (across stores) for each calendar day in UTC
  const dayToMin = new Map<string, number>();
  for (const s of snaps) {
    const day = s.recordedAt.toISOString().slice(0, 10);
    const p = Number(s.price);
    const prev = dayToMin.get(day);
    if (prev == null || p < prev) dayToMin.set(day, p);
  }
  const dailyMins = Array.from(dayToMin.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([, v]) => v);

  const avg90 = mean(dailyMins);
  let dealScore: number | null = null;
  if (avg90 != null && currentLow != null && avg90 > 0) {
    dealScore = ((avg90 - currentLow) / avg90) * 100;
    if (dealScore < 0) dealScore = 0;
  }

  // Trend: compare mean daily min first half vs second half of last 14d of snapshots
  const snaps14 = snaps.filter((s) => s.recordedAt >= d14);
  const dayToMin14 = new Map<string, number>();
  for (const s of snaps14) {
    const day = s.recordedAt.toISOString().slice(0, 10);
    const p = Number(s.price);
    const prev = dayToMin14.get(day);
    if (prev == null || p < prev) dayToMin14.set(day, p);
  }
  const days14 = Array.from(dayToMin14.keys()).sort();
  const mins14 = days14.map((d) => dayToMin14.get(d)!);
  let trendDirection: string | null = null;
  if (mins14.length >= 6) {
    const half = Math.floor(mins14.length / 2);
    const a = mean(mins14.slice(0, half));
    const b = mean(mins14.slice(half));
    if (a != null && b != null) {
      const diff = (b - a) / (a || 1);
      if (diff < -0.02) trendDirection = "dropping";
      else if (diff > 0.02) trendDirection = "rising";
      else trendDirection = "stable";
    }
  } else if (mins14.length >= 2) {
    trendDirection = "stable";
  }

  const vol = dailyMins.length >= 3 ? stdev(dailyMins) : null;

  // Cheapest store: per snapshot timestamp bucket, who had min price?
  const timeStoreMins = new Map<string, Map<string, number>>();
  for (const s of snaps) {
    const t = s.recordedAt.toISOString();
    if (!timeStoreMins.has(t)) timeStoreMins.set(t, new Map());
    const m = timeStoreMins.get(t)!;
    const p = Number(s.price);
    const prev = m.get(s.store);
    if (prev == null || p < prev) m.set(s.store, p);
  }
  const wins = new Map<string, number>();
  let totalRounds = 0;
  for (const [, byStore] of Array.from(timeStoreMins.entries())) {
    let bestStore: string | null = null;
    let bestP = Infinity;
    for (const [st, pr] of Array.from(byStore.entries())) {
      if (pr < bestP) {
        bestP = pr;
        bestStore = st;
      }
    }
    if (bestStore) {
      totalRounds++;
      wins.set(bestStore, (wins.get(bestStore) ?? 0) + 1);
    }
  }
  let cheapestStoreMostOften: string | null = null;
  let cheapestStoreWinPct: number | null = null;
  if (totalRounds > 0) {
    let top = "";
    let topN = 0;
    for (const [st, c] of Array.from(wins.entries())) {
      if (c > topN) {
        topN = c;
        top = st;
      }
    }
    cheapestStoreMostOften = top || null;
    cheapestStoreWinPct = (topN / totalRounds) * 100;
  }

  // Deal confidence: current basket low vs all recorded prices (90d)
  let dealConfidence: string | null = null;
  const allPrices = snaps.map((s) => Number(s.price));
  if (currentLow != null && allPrices.length >= 10) {
    const aboveFrac = allPrices.filter((x) => x > currentLow).length / allPrices.length;
    if (aboveFrac >= 0.9) dealConfidence = "high";
    else if (aboveFrac >= 0.75) dealConfidence = "medium";
    else dealConfidence = "low";
  }

  // Tier from deal score (traffic not modeled yet)
  let tier = 3;
  if (dealScore != null && dealScore > 10) tier = 1;
  else if (dealScore != null && dealScore > 3) tier = 2;

  await prisma.product.update({
    where: { id: productId },
    data: {
      dealScorePercent: dealScore != null ? new Prisma.Decimal(dealScore.toFixed(2)) : null,
      avgPrice90d: avg90 != null ? new Prisma.Decimal(avg90.toFixed(2)) : null,
      lowestPriceCurrent: currentLow != null ? new Prisma.Decimal(currentLow.toFixed(2)) : null,
      trendDirection,
      cheapestStoreMostOften,
      cheapestStoreWinPct:
        cheapestStoreWinPct != null ? new Prisma.Decimal(cheapestStoreWinPct.toFixed(2)) : null,
      volatilityScore: vol != null ? new Prisma.Decimal(vol.toFixed(4)) : null,
      dealConfidence,
      tier,
    },
  });
}
