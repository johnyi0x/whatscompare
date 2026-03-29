/**
 * Amazon Associates / partner ID for outbound links.
 * Supports AMAZON_PARTNER_TAG (preferred), AMAZON_ASSOCIATES_TAG, or AMAZON_ASSOCIATE_TAG.
 */
export function amazonAssociatesTag(): string | undefined {
  const t =
    process.env.AMAZON_PARTNER_TAG?.trim() ||
    process.env.AMAZON_ASSOCIATES_TAG?.trim() ||
    process.env.AMAZON_ASSOCIATE_TAG?.trim();
  return t || undefined;
}

/**
 * Append the Associates `tag` query param on Amazon product URLs (server-side, e.g. product page buy links).
 * Skips if a non-empty `tag` is already present.
 */
export function affiliateOutboundUrl(store: string, rawUrl: string): string {
  if (!rawUrl || rawUrl === "#") return rawUrl;
  const tag = amazonAssociatesTag();
  if (store !== "amazon" || !tag) return rawUrl;
  try {
    let href = rawUrl.trim();
    if (href.startsWith("//")) href = `https:${href}`;
    const u = new URL(href);
    if (!/amazon\./i.test(u.hostname)) return rawUrl;
    const existing = u.searchParams.get("tag");
    if (existing != null && existing.trim() !== "") return rawUrl;
    u.searchParams.set("tag", tag);
    return u.toString();
  } catch {
    return rawUrl;
  }
}
