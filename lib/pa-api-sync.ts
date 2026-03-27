import { createHash, createHmac } from "crypto";
import { prisma } from "./prisma";
import { buildAmazonProductUrl, getPartnerTagOrPlaceholder } from "./amazon-affiliate";

type GetItemsPayload = {
  ItemIds: string[];
  Resources: string[];
  PartnerTag: string;
  PartnerType: "Associates";
  Marketplace: string;
  LanguagesOfPreference?: string[];
};

function sha256Hex(body: string): string {
  return createHash("sha256").update(body, "utf8").digest("hex");
}

function hmac(key: Buffer | string, data: string): Buffer {
  return createHmac("sha256", key).update(data, "utf8").digest();
}

/**
 * AWS Signature Version 4 for Product Advertising API 5 (US marketplace host).
 * Confirmed against Amazon PA-API 5 signing docs; verify host/region for your marketplace.
 */
function signPaapiRequest(opts: {
  accessKey: string;
  secretKey: string;
  region: string;
  host: string;
  amzTarget: string;
  body: string;
}): Record<string, string> {
  const { accessKey, secretKey, region, host, amzTarget, body } = opts;
  const method = "POST";
  const canonicalUri = "/paapi5/getitems";
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);

  const payloadHash = sha256Hex(body);
  const canonicalHeaders =
    `content-encoding:amz-1.0\n` +
    `content-type:application/json; charset=UTF-8\n` +
    `host:${host}\n` +
    `x-amz-content-sha256:${payloadHash}\n` +
    `x-amz-date:${amzDate}\n` +
    `x-amz-target:${amzTarget}\n`;
  const signedHeaders = "content-encoding;content-type;host;x-amz-content-sha256;x-amz-date;x-amz-target";
  const canonicalRequest = [
    method,
    canonicalUri,
    "",
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join("\n");

  const algorithm = "AWS4-HMAC-SHA256";
  const credentialScope = `${dateStamp}/${region}/ProductAdvertisingAPI/aws4_request`;
  const stringToSign = [
    algorithm,
    amzDate,
    credentialScope,
    sha256Hex(canonicalRequest),
  ].join("\n");

  const kDate = hmac(`AWS4${secretKey}`, dateStamp);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, "ProductAdvertisingAPI");
  const kSigning = hmac(kService, "aws4_request");
  const signature = createHmac("sha256", kSigning).update(stringToSign, "utf8").digest("hex");

  const authorization = `${algorithm} Credential=${accessKey}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  return {
    "Content-Type": "application/json; charset=UTF-8",
    "Content-Encoding": "amz-1.0",
    Host: host,
    "X-Amz-Date": amzDate,
    "X-Amz-Target": amzTarget,
    "X-Amz-Content-Sha256": payloadHash,
    Authorization: authorization,
  };
}

function parsePriceAmount(value: unknown): string | null {
  if (value && typeof value === "object" && "DisplayAmount" in value) {
    const d = (value as { DisplayAmount?: string }).DisplayAmount;
    if (typeof d === "string") {
      const n = d.replace(/[^0-9.]/g, "");
      return n || null;
    }
  }
  return null;
}

export function paApiConfigured(): boolean {
  return Boolean(
    process.env.PAAPI_ACCESS_KEY?.trim() &&
      process.env.PAAPI_SECRET_KEY?.trim() &&
      process.env.AMAZON_PARTNER_TAG?.trim()
  );
}

/**
 * Fetches item metadata/prices from PA-API and upserts the latest Offer + PriceHistory.
 * Returns counts and any API errors (partial success possible).
 */
export async function syncAmazonOffersFromPaApi(asins: string[]): Promise<{
  updated: number;
  errors: string[];
}> {
  const accessKey = process.env.PAAPI_ACCESS_KEY!.trim();
  const secretKey = process.env.PAAPI_SECRET_KEY!.trim();
  const partnerTag = getPartnerTagOrPlaceholder();
  const host = process.env.PAAPI_HOST?.trim() || "webservices.amazon.com";
  const region = process.env.PAAPI_REGION?.trim() || "us-east-1";
  const marketplace = process.env.PAAPI_MARKETPLACE?.trim() || "www.amazon.com";
  const amzTarget = "com.amazon.paapi5.v1.ProductAdvertisingAPIv1.GetItems";

  const errors: string[] = [];
  let updated = 0;

  const merchant = await prisma.merchant.findUnique({ where: { slug: "amazon" } });
  if (!merchant) {
    errors.push("Merchant amazon not found; run seed/migrations.");
    return { updated, errors };
  }

  const chunkSize = 10;
  for (let i = 0; i < asins.length; i += chunkSize) {
    const chunk = asins.slice(i, i + chunkSize);
    const payload: GetItemsPayload = {
      ItemIds: chunk,
      PartnerTag: partnerTag,
      PartnerType: "Associates",
      Marketplace: marketplace,
      LanguagesOfPreference: ["en_US"],
      Resources: [
        "ItemInfo.Title",
        "Images.Primary.Large",
        "Offers.Listings.Price",
        "Offers.Listings.SavingBasis",
      ],
    };
    const body = JSON.stringify(payload);
    const headers = signPaapiRequest({
      accessKey,
      secretKey,
      region,
      host,
      amzTarget,
      body,
    });

    const url = `https://${host}/paapi5/getitems`;
    const { Host: _h, ...fetchHeaders } = headers;
    const res = await fetch(url, { method: "POST", headers: fetchHeaders, body });
    const json = (await res.json()) as Record<string, unknown>;

    if (!res.ok) {
      errors.push(`HTTP ${res.status}: ${JSON.stringify(json).slice(0, 500)}`);
      continue;
    }

    const itemsResult = json.ItemsResult as { Items?: unknown[] } | undefined;
    const items = itemsResult?.Items ?? [];

    for (const item of items) {
      if (!item || typeof item !== "object") continue;
      const rec = item as Record<string, unknown>;
      const asin = rec.ASIN as string | undefined;
      if (!asin) continue;

      const product = await prisma.product.findFirst({
        where: { merchantId: merchant.id, externalId: asin },
      });
      if (!product) continue;

      const listings = (rec.Offers as { Listings?: unknown[] } | undefined)?.Listings;
      const firstListing = listings?.[0] as Record<string, unknown> | undefined;
      const priceObj = firstListing?.Price as Record<string, unknown> | undefined;
      const display = priceObj?.DisplayAmount as string | undefined;
      const amount = parsePriceAmount(priceObj) ?? (display ? display.replace(/[^0-9.]/g, "") : null);
      if (!amount) {
        errors.push(`No price for ASIN ${asin}`);
        continue;
      }

      const listBasis = firstListing?.SavingBasis as Record<string, unknown> | undefined;
      const listAmount = listBasis?.DisplayAmount
        ? String(listBasis.DisplayAmount).replace(/[^0-9.]/g, "")
        : null;

      const imageUrl =
        ((rec.Images as { Primary?: { Large?: { URL?: string } } } | undefined)?.Primary?.Large
          ?.URL as string | undefined) ?? product.imageUrl;

      const now = new Date();
      const affiliateUrl = buildAmazonProductUrl(asin, { partnerTag });

      await prisma.$transaction([
        prisma.product.update({
          where: { id: product.id },
          data: {
            imageUrl: imageUrl ?? undefined,
            imageSource: imageUrl ? "pa_api" : product.imageSource,
          },
        }),
        prisma.offer.create({
          data: {
            productId: product.id,
            merchantId: merchant.id,
            priceAmount: amount,
            currency: "USD",
            listPriceAmount: listAmount,
            dealLabel: null,
            affiliateUrl,
            fetchedAt: now,
            source: "pa_api",
            availabilityNote: "Price from Product Advertising API; verify on Amazon before purchase.",
            lastSyncedAt: now,
          },
        }),
        prisma.priceHistory.create({
          data: {
            productId: product.id,
            priceAmount: amount,
            currency: "USD",
            source: "pa_api",
          },
        }),
      ]);
      updated += 1;
    }

    const errs = json.Errors as unknown[] | undefined;
    if (errs?.length) {
      for (const e of errs) {
        errors.push(JSON.stringify(e).slice(0, 300));
      }
    }
  }

  return { updated, errors };
}
