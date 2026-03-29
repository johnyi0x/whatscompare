/**
 * Append Amazon Associates tag for outbound product links (server-side).
 * Set AMAZON_ASSOCIATES_TAG in env (e.g. yourstore-20). Skips if tag already present.
 */
export function affiliateOutboundUrl(store: string, rawUrl: string): string {
  if (!rawUrl || rawUrl === "#") return rawUrl;
  const tag = process.env.AMAZON_ASSOCIATES_TAG?.trim();
  if (store !== "amazon" || !tag) return rawUrl;
  try {
    const u = new URL(rawUrl);
    if (!/amazon\./i.test(u.hostname)) return rawUrl;
    if (u.searchParams.has("tag")) return rawUrl;
    u.searchParams.set("tag", tag);
    return u.toString();
  } catch {
    return rawUrl;
  }
}
