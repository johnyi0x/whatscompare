import Link from "next/link";
import { BrandWordmark } from "./BrandWordmark";
import { NavDrawer } from "./NavDrawer";
import { SearchForm } from "./SearchForm";
import { ThemeToggle } from "./ThemeToggle";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-surface/85 backdrop-blur-md dark:bg-surface/90">
      <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
        <Link href="/" className="shrink-0 font-display text-lg font-semibold tracking-tight sm:text-xl">
          <BrandWordmark />
        </Link>

        <SearchForm className="min-w-0 flex-1" />

        <div className="flex shrink-0 items-center gap-2">
          <ThemeToggle />
          <NavDrawer />
        </div>
      </div>
    </header>
  );
}
