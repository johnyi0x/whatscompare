/** Stable key per retailer for listings + snapshots. */
export function storeKeyFromSerpName(name: string): string {
  const n = name.toLowerCase();
  if (n.includes("amazon")) return "amazon";
  if (n.includes("best buy") || n.includes("bestbuy")) return "bestbuy";
  if (n.includes("target")) return "target";
  if (n.includes("newegg")) return "newegg";
  if (n.includes("b&h") || n.includes("b and h")) return "bhphoto";
  if (n.includes("micro center")) return "microcenter";
  if (n.includes("costco")) return "costco";
  if (n.includes("apple")) return "apple";
  return n
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48) || "unknown";
}

export function inferInStockFromDetails(details?: string[]): boolean {
  if (!details?.length) return true;
  const t = details.join(" ").toLowerCase();
  if (t.includes("out of stock")) return false;
  if (t.includes("sold out")) return false;
  return true;
}
