/**
 * Amazon Associates URLs and product images.
 * Use your exact store tag from SiteStripe in AMAZON_PARTNER_TAG.
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
 * Product detail link — always https://www.amazon.com/dp/{ASIN}?tag=…&linkCode=ll1
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

/** AsinImage widget URL (fetch server-side via /api/amazon-img, not always reliable in browsers). */
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

function isPlaceholderUrl(url: string | null): boolean {
  if (!url) return true;
  return PLACEHOLDER_HOSTS.some((h) => url.toLowerCase().includes(h.toLowerCase()));
}

/**
 * Only use stored https image URLs from feeds (SerpApi, PA-API). The AsinImage proxy is unreliable in production
 * and is not used for catalog thumbnails.
 */
export function resolveProductImageUrl(
  product: {
    imageUrl: string | null;
    merchant: { slug: string };
    externalId: string;
  },
  _partnerTag: string
): string | null {
  const url = product.imageUrl;
  if (url && !isPlaceholderUrl(url) && url.startsWith("http")) {
    return url;
  }
  return null;
}
