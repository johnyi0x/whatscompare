/**
 * Amazon Associates URLs and product images.
 * Use your exact store tag from SiteStripe (e.g. whatscompar0e-20) in AMAZON_PARTNER_TAG.
 * See COMPLIANCE.md and current Program policies.
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

/**
 * Text CTA link: always https://www.amazon.com/dp/{ASIN} with Associates params.
 * linkCode=ll1 is the standard text-link format (SiteStripe often uses ll2 for image links).
 */
export function buildAmazonProductUrl(
  asin: string,
  options?: { partnerTag?: string; marketplaceHost?: AmazonMarketplace }
): string {
  const tag = options?.partnerTag ?? getPartnerTagOrPlaceholder();
  const host = options?.marketplaceHost ?? DEFAULT_HOST;
  const params = new URLSearchParams({
    tag,
    linkCode: "ll1",
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

/**
 * Associates-compliant product image from Amazon (AsinImage widget).
 * Requires a valid ASIN; tag must match your Associates account.
 */
export function buildAmazonAsinImageUrl(asin: string, partnerTag: string, size = 500): string {
  const q = new URLSearchParams({
    _encoding: "UTF8",
    ASIN: asin,
    Format: `_SL${size}_`,
    ID: "AsinImage",
    MarketPlace: "US",
    ServiceVersion: "20070822",
    WS: "1",
    tag: partnerTag,
  });
  return `https://ws-na.amazon-adsystem.com/widgets/q?${q.toString()}`;
}

const PLACEHOLDER_HOSTS = ["placehold.co", "via.placeholder", "placeholder"];

export function resolveProductImageUrl(
  product: {
    imageUrl: string | null;
    merchant: { slug: string };
    externalId: string;
  },
  partnerTag: string
): string | null {
  const url = product.imageUrl;
  const isPlaceholder =
    !url || PLACEHOLDER_HOSTS.some((h) => url.toLowerCase().includes(h.toLowerCase()));

  if (product.merchant.slug === "amazon" && isPlaceholder) {
    return buildAmazonAsinImageUrl(product.externalId, partnerTag);
  }

  return url;
}
