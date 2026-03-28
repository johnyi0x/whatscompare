import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { paApiConfigured, syncAmazonOffersFromPaApi } from "@/lib/pa-api-sync";
import { serpApiConfigured, syncStaleProductsFromSerpApi } from "@/lib/serpapi-sync";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

function authorize(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

/**
 * Daily ingest (Vercel Cron): PA-API when eligible, then SerpApi for stale products (DB-first; no user-request calls).
 */
export async function GET(request: Request) {
  if (!authorize(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body: Record<string, unknown> = { ok: true };

  try {
    const products = await prisma.product.findMany({
      where: { merchant: { slug: "amazon" } },
      select: { externalId: true },
    });
    const asins = products.map((p) => p.externalId);

    /* —— Amazon PA-API (Creators API path; requires qualifying sales) —— */
    if (!paApiConfigured()) {
      await prisma.syncJobLog.create({
        data: {
          job: "sync-amazon-paapi",
          status: "skipped",
          detail:
            "PA-API / Creators API credentials not set or not eligible. Skipped.",
          itemCount: 0,
          finishedAt: new Date(),
        },
      });
      body.paApi = { skipped: true, reason: "pa_api_not_configured", asinCount: asins.length };
    } else {
      const { updated, errors } = await syncAmazonOffersFromPaApi(asins);
      const status =
        errors.length && updated === 0 ? "error" : errors.length ? "partial" : "success";
      await prisma.syncJobLog.create({
        data: {
          job: "sync-amazon-paapi",
          status,
          detail: errors.length ? errors.join(" | ").slice(0, 8000) : "ok",
          itemCount: updated,
          finishedAt: new Date(),
        },
      });
      body.paApi = { updated, errors, asinCount: asins.length };
    }

    /* —— SerpApi Amazon Product (paid 3rd party; TTL + cap; fills DB for site) —— */
    if (!serpApiConfigured()) {
      await prisma.syncJobLog.create({
        data: {
          job: "sync-serpapi",
          status: "skipped",
          detail: "SERPAPI_API_KEY not set.",
          itemCount: 0,
          finishedAt: new Date(),
        },
      });
      body.serpApi = { skipped: true, reason: "serpapi_not_configured" };
    } else {
      const { updated, errors } = await syncStaleProductsFromSerpApi();
      const status =
        errors.length && updated === 0 ? "error" : errors.length ? "partial" : "success";
      await prisma.syncJobLog.create({
        data: {
          job: "sync-serpapi",
          status,
          detail: errors.length ? errors.join(" | ").slice(0, 8000) : "ok",
          itemCount: updated,
          finishedAt: new Date(),
        },
      });
      body.serpApi = { updated, errors };
    }

    return NextResponse.json(body);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await prisma.syncJobLog.create({
      data: {
        job: "sync-amazon",
        status: "error",
        detail: message.slice(0, 8000),
        finishedAt: new Date(),
      },
    });
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
