import Link from "next/link";
import { SearchForm } from "./SearchForm";
import { ThemeToggle } from "./ThemeToggle";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-surface/80 backdrop-blur-md dark:bg-surface/90">
      <div className="mx-auto flex max-w-5xl flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
        <Link href="/" className="shrink-0 font-display text-xl font-semibold tracking-tight">
          <span className="text-whats">Whats</span>
          <span className="text-compare">Compare</span>
        </Link>
        <div className="order-3 w-full sm:order-none sm:max-w-md">
          <SearchForm />
        </div>
        <div className="flex flex-wrap items-center justify-end gap-3">
          <ThemeToggle />
          <nav className="flex flex-wrap gap-x-4 gap-y-1 text-sm font-medium text-ink-muted">
            <Link href="/search" className="transition hover:text-ink">
              Browse
            </Link>
            <Link href="/posts" className="transition hover:text-ink">
              Deal write-ups
            </Link>
            <Link href="/about" className="transition hover:text-ink">
              About
            </Link>
            <Link href="/compare" className="transition hover:text-ink">
              Compare (soon)
            </Link>
          </nav>
        </div>
      </div>
    </header>
  );
}
