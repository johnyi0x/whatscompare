import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { paApiConfigured, syncAmazonOffersFromPaApi } from "@/lib/pa-api-sync";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Vercel Cron: set CRON_SECRET in project env; Vercel sends `Authorization: Bearer <CRON_SECRET>`.
 * Schedule via vercel.json (e.g. every 6 hours). Without PA-API keys, job logs `skipped` and exits 200.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const products = await prisma.product.findMany({
      where: { merchant: { slug: "amazon" } },
      select: { externalId: true },
    });
    const asins = products.map((p) => p.externalId);

    if (!paApiConfigured()) {
      await prisma.syncJobLog.create({
        data: {
          job: "sync-amazon",
          status: "skipped",
          detail:
            "PA-API credentials not set (PAAPI_ACCESS_KEY, PAAPI_SECRET_KEY, AMAZON_PARTNER_TAG). No prices updated.",
          itemCount: 0,
          finishedAt: new Date(),
        },
      });
      return NextResponse.json({
        ok: true,
        skipped: true,
        reason: "pa_api_not_configured",
        asinCount: asins.length,
      });
    }

    const { updated, errors } = await syncAmazonOffersFromPaApi(asins);

    const status =
      errors.length && updated === 0 ? "error" : errors.length ? "partial" : "success";

    await prisma.syncJobLog.create({
      data: {
        job: "sync-amazon",
        status,
        detail: errors.length ? errors.join(" | ").slice(0, 8000) : "ok",
        itemCount: updated,
        finishedAt: new Date(),
      },
    });

    return NextResponse.json({ ok: true, updated, errors, asinCount: asins.length });
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
