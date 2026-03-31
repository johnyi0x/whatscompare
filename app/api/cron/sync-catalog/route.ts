import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { anthropicConfigured, runClaudeCatalogCron } from "@/lib/claude-catalog-sync";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

function authorize(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

/** Daily: enrich SKUs (web search) + refresh prices (web fetch / official APIs) under CLAUDE_DAILY_BUDGET_USD. */
export async function GET(request: Request) {
  if (!authorize(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!anthropicConfigured()) {
    await prisma.syncJobLog.create({
      data: {
        job: "sync-catalog",
        status: "skipped",
        detail: "ANTHROPIC_API_KEY not set.",
        itemCount: 0,
        finishedAt: new Date(),
      },
    });
    return NextResponse.json({ ok: true, skipped: true, reason: "no_api_key" });
  }

  try {
    const { enriched, priceBatches, productsPriceTouched, estimatedUsd, errors } =
      await runClaudeCatalogCron();
    const nothingDone = enriched === 0 && productsPriceTouched === 0;
    const status =
      errors.length && nothingDone ? "error" : errors.length ? "partial" : "success";
    await prisma.syncJobLog.create({
      data: {
        job: "sync-catalog",
        status,
        detail: errors.length
          ? errors.join(" | ").slice(0, 8000)
          : `usd~${estimatedUsd.toFixed(4)} enriched=${enriched} batches=${priceBatches} priced=${productsPriceTouched}`,
        itemCount: enriched + productsPriceTouched,
        finishedAt: new Date(),
      },
    });
    return NextResponse.json({
      ok: true,
      enriched,
      priceBatches,
      productsPriceTouched,
      estimatedUsd,
      errors,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await prisma.syncJobLog.create({
      data: {
        job: "sync-catalog",
        status: "error",
        detail: message.slice(0, 8000),
        finishedAt: new Date(),
      },
    });
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
