import { NextResponse } from "next/server";
import { searchProductsWithOffers } from "@/lib/search";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim() ?? "";
  if (!q) {
    return NextResponse.json({ query: "", products: [] });
  }
  const products = await searchProductsWithOffers(q, 48);
  return NextResponse.json({
    query: q,
    products: products.map((p) => ({
      id: p.id,
      slug: p.slug,
      title: p.title,
      brand: p.brand,
      externalId: p.externalId,
      merchant: p.merchant.slug,
      offer: p.offers[0]
        ? {
            priceAmount: p.offers[0].priceAmount.toString(),
            currency: p.offers[0].currency,
            fetchedAt: p.offers[0].fetchedAt.toISOString(),
            source: p.offers[0].source,
          }
        : null,
    })),
  });
}
