import type { Offer } from "@prisma/client";

export function formatPriceDisclaimer(offer: Offer | undefined): string {
  if (!offer) {
    return "Price not on file—open Amazon for current price and availability.";
  }
  const fetched = offer.fetchedAt.toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });
  return `Price shown reflects our records as of ${fetched}. Amazon’s live price and stock may differ—verify before checkout.`;
}
