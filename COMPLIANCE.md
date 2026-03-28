# Compliance notes (Amazon Associates & PA-API)

This project implements **common technical patterns** for disclosures, sponsored outbound links, and price freshness messaging. **You** remain responsible for complying with the agreements you signed, including locale-specific rules.

## Official documents to read and follow

Review the **current** versions (they change over time):

- [Amazon Associates Program Operating Agreement](https://affiliate-program.amazon.com/help/operating/agreement) (US hub; use your enrolled locale’s equivalent).
- [Associates Program Policies](https://affiliate-program.amazon.com/help/operating/policies) (product claims, promotions, trademarks, etc.).
- [Product Advertising API License Agreement](https://webservices.amazon.com/paapi5/documentation/register-for-pa-api.html) and PA-API documentation for your marketplace.

## What this codebase does

- **Disclosure**: A single `AffiliateDisclosure` appears in the **site footer** on every page (via `app/layout.tsx`), plus the footer links to the Operating Agreement.
- **Outbound links**: Product CTAs use `rel="sponsored noopener noreferrer"` where we link to Amazon with your tag.
- **Pricing**: UI copy stresses that displayed prices are **from your database / PA-API snapshot** and may differ from live checkout; users are directed to **verify on Amazon**.
- **Images**: Seed data uses neutral placeholders. In production, prefer images obtained through **PA-API** (or other methods your agreement allows) rather than hotlinking without authorization.
- **PA-API eligibility**: Access can depend on **sales thresholds**, account standing, and region. If PA-API is unavailable, run on **manual/seed prices** only and keep compliance-oriented disclaimers—or use approved linking patterns without displaying API-sourced prices.

## What you must configure

1. Set `AMAZON_PARTNER_TAG` to your **approved** Associates ID for the marketplace you target.
2. Only enable `PAAPI_*` variables after you confirm you are **eligible** for PA-API in your locale.
3. Keep `CRON_SECRET` set on Vercel so scheduled syncs are not publicly callable.

## Not legal advice

This file is engineering guidance, not legal advice. Consult Amazon’s published terms and, if needed, qualified counsel for your jurisdiction and business model.
