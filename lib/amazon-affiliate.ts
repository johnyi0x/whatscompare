/**
 * Build Amazon Associates destination URLs. Tag must be your approved Partner / Associate tag.
 * See COMPLIANCE.md and current Amazon Associates / PA-API documentation for your locale.
 */
export type AmazonMarketplace = "www.amazon.com" | "www.amazon.co.uk" | "www.amazon.de";

const DEFAULT_HOST: AmazonMarketplace = "www.amazon.com";

export function getPartnerTag(): string {
  const tag = process.env.AMAZON_PARTNER_TAG?.trim();
  if (!tag) {
    throw new Error("AMAZON_PARTNER_TAG is not set");
  }
  return tag;
}

export function getPartnerTagOrPlaceholder(): string {
  return process.env.AMAZON_PARTNER_TAG?.trim() || "YOURSTORETAG-20";
}

export function buildAmazonProductUrl(
  asin: string,
  options?: { partnerTag?: string; marketplaceHost?: AmazonMarketplace }
): string {
  const tag = options?.partnerTag ?? getPartnerTagOrPlaceholder();
  const host = options?.marketplaceHost ?? DEFAULT_HOST;
  const params = new URLSearchParams({
    tag,
    linkCode: "ogi",
    language: "en_US",
  });
  return `https://${host}/dp/${encodeURIComponent(asin)}?${params.toString()}`;
}

export function buildAmazonSearchUrl(
  keywords: string,
  options?: { partnerTag?: string; marketplaceHost?: AmazonMarketplace }
): string {
  const tag = options?.partnerTag ?? getPartnerTagOrPlaceholder();
  const host = options?.marketplaceHost ?? DEFAULT_HOST;
  const params = new URLSearchParams({
    tag,
    linkCode: "sl2",
    keywords,
    index: "aps",
  });
  return `https://${host}/s?${params.toString()}`;
}
