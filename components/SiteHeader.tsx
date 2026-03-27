import Link from "next/link";
import { SearchForm } from "./SearchForm";

export function SiteHeader() {
  return (
    <header className="border-b border-ink/10 bg-surface">
      <div className="mx-auto flex max-w-5xl flex-col gap-4 px-4 py-5 sm:flex-row sm:items-center sm:justify-between">
        <Link href="/" className="font-display text-xl font-semibold tracking-tight text-ink">
          WhatsCompare
        </Link>
        <div className="w-full sm:max-w-md">
          <SearchForm />
        </div>
        <nav className="flex flex-wrap gap-4 text-sm font-medium text-ink-muted">
          <Link href="/search" className="hover:text-ink">
            Browse
          </Link>
          <Link href="/posts" className="hover:text-ink">
            Deal write-ups
          </Link>
          <Link href="/compare" className="hover:text-ink">
            Compare (soon)
          </Link>
        </nav>
      </div>
    </header>
  );
}
