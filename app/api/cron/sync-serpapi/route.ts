import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serpApiConfigured, syncStaleProductsFromSerpApi } from "@/lib/serpapi-sync";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/** Manual / secondary cron: SerpApi only (same CRON_SECRET). Site always reads the database. */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!serpApiConfigured()) {
    return NextResponse.json({ ok: true, skipped: true, reason: "serpapi_not_configured" });
  }

  try {
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
    return NextResponse.json({ ok: true, updated, errors });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
