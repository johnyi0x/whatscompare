import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { runTieredCatalogSync, serpApiConfigured } from "@/lib/serpapi-catalog-sync";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

function authorize(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

/** Daily (or manual): tier-priority SerpApi refresh with SERPAPI_MAX_CALLS_PER_RUN budget. */
export async function GET(request: Request) {
  if (!authorize(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!serpApiConfigured()) {
    await prisma.syncJobLog.create({
      data: {
        job: "sync-catalog",
        status: "skipped",
        detail: "SERPAPI_API_KEY not set.",
        itemCount: 0,
        finishedAt: new Date(),
      },
    });
    return NextResponse.json({ ok: true, skipped: true, reason: "no_api_key" });
  }

  try {
    const { processed, apiCalls, errors } = await runTieredCatalogSync();
    const status =
      errors.length && processed === 0 ? "error" : errors.length ? "partial" : "success";
    await prisma.syncJobLog.create({
      data: {
        job: "sync-catalog",
        status,
        detail: errors.length ? errors.join(" | ").slice(0, 8000) : `apiCalls=${apiCalls}`,
        itemCount: processed,
        finishedAt: new Date(),
      },
    });
    return NextResponse.json({ ok: true, processed, apiCalls, errors });
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
