import { NextResponse } from "next/server";
import { searchProductsWithListings } from "@/lib/search";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim() ?? "";
  if (!q) {
    return NextResponse.json({ query: "", products: [] });
  }
  const products = await searchProductsWithListings(q, 48);
  return NextResponse.json({
    query: q,
    products: products.map((p) => {
      const low = p.listings[0];
      return {
        id: p.id,
        slug: p.slug,
        title: p.title,
        brand: p.brand,
        category: p.category,
        lowestPrice: low ? low.currentPrice.toString() : null,
        currency: p.currency,
        storeCount: p.listings.length,
      };
    }),
  });
}
