import { buildAmazonAsinImageUrl, getPartnerTagOrPlaceholder } from "@/lib/amazon-affiliate";

export const dynamic = "force-dynamic";

const ASIN_RE = /^B[0-9A-Z]{9}$/i;

/**
 * Server-side proxy for Amazon AsinImage widget. Browsers often block the widget URL
 * (referrer / Next/Image); fetching from Vercel usually returns the JPEG.
 */
export async function GET(request: Request) {
  const asin = new URL(request.url).searchParams.get("asin")?.trim().toUpperCase() ?? "";
  if (!ASIN_RE.test(asin)) {
    return new Response("Invalid ASIN", { status: 400 });
  }

  const tag = getPartnerTagOrPlaceholder();
  const widgetUrl = buildAmazonAsinImageUrl(asin, tag, 600);

  const upstream = await fetch(widgetUrl, {
    redirect: "follow",
    headers: {
      Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    },
  });

  if (!upstream.ok) {
    return new Response(null, { status: 404 });
  }

  const ct = upstream.headers.get("content-type") ?? "";
  if (!ct.startsWith("image/")) {
    return new Response(null, { status: 502 });
  }

  return new Response(upstream.body, {
    headers: {
      "Content-Type": ct,
      "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800",
    },
  });
}
