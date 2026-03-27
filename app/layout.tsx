import type { Metadata } from "next";

/** Prerender requires a live DB; keep routes dynamic until build-time DB is configured. */
export const dynamic = "force-dynamic";
import { DM_Sans, Fraunces } from "next/font/google";
import { AffiliateDisclosure } from "@/components/AffiliateDisclosure";
import { SiteHeader } from "@/components/SiteHeader";
import "./globals.css";

const sans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-geist-sans",
  display: "swap",
});

const display = Fraunces({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "WhatsCompare — curated product deals",
    template: "%s · WhatsCompare",
  },
  description:
    "Search curated Amazon deals from our database. Editorial roundups and transparent affiliate disclosures.",
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"),
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${display.variable}`}>
      <body className="min-h-screen font-sans antialiased">
        <SiteHeader />
        <main className="mx-auto max-w-5xl px-4 py-10">{children}</main>
        <footer className="border-t border-ink/10 bg-surface-subtle py-10">
          <div className="mx-auto max-w-5xl space-y-4 px-4">
            <AffiliateDisclosure />
            <p className="text-xs text-ink-muted">
              © {new Date().getFullYear()} WhatsCompare. Not affiliated with Amazon. Amazon and related marks are
              trademarks of Amazon.com, Inc. or its affiliates.
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
