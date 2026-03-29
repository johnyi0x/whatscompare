"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { BrandWordmark } from "./BrandWordmark";

const links = [
  { href: "/search", label: "Browse catalog" },
  { href: "/posts", label: "Deal blog posts" },
  { href: "/about", label: "About" },
  { href: "/compare", label: "compare (soon)" },
];

export function NavDrawer() {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, close]);

  const overlay = open && mounted && (
    <div className="fixed inset-0 z-[100] flex justify-end">
      {/* Dim scrim only — no backdrop-blur (avoids color fringing / “glow” next to the header’s blur) */}
      <button
        type="button"
        className="absolute inset-0 z-[1] bg-transparent dark:bg-black/70"
        aria-label="Close menu"
        onClick={close}
      />
      {/* Same idea as SiteHeader: frosted bar using surface + light blur — portaled to body so parent header blur doesn’t erase opacity */}
      <nav
        id="site-nav-drawer"
        className="relative z-[2] flex h-full w-[min(20rem,88vw)] flex-col border-l border-line bg-surface/85 py-6 shadow-2xl shadow-black/15 backdrop-blur-md dark:bg-surface/90 dark:shadow-black/40"
      >
        <div className="flex items-center justify-between border-b border-line px-5 pb-4">
          <span className="font-display text-lg font-semibold">
            <BrandWordmark />
          </span>
          <button
            type="button"
            onClick={close}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-line text-ink-muted transition hover:border-accent hover:text-ink"
            aria-label="Close"
          >
            <span className="relative block h-4 w-4">
              <span className="absolute left-1/2 top-1/2 block h-0.5 w-4 -translate-x-1/2 -translate-y-1/2 rotate-45 rounded-full bg-current" />
              <span className="absolute left-1/2 top-1/2 block h-0.5 w-4 -translate-x-1/2 -translate-y-1/2 -rotate-45 rounded-full bg-current" />
            </span>
          </button>
        </div>
        <ul className="flex flex-1 flex-col gap-0.5 px-3 pt-3">
          {links.map(({ href, label }) => (
            <li key={href}>
              <Link
                href={href}
                onClick={close}
                className="block rounded-lg px-4 py-3 text-sm font-medium text-ink transition hover:bg-black/[0.04] hover:text-accent dark:hover:bg-white/[0.06]"
              >
                {label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-line bg-surface text-ink shadow-sm transition hover:border-accent hover:text-accent"
        aria-expanded={open}
        aria-controls="site-nav-drawer"
        aria-label="Open menu"
      >
        <span className="flex h-3.5 w-[1.125rem] flex-col justify-between" aria-hidden>
          <span className="h-0.5 w-full rounded-full bg-current transition-opacity" />
          <span className="h-0.5 w-full rounded-full bg-current" />
          <span className="h-0.5 w-full rounded-full bg-current transition-opacity" />
        </span>
      </button>

      {mounted && overlay ? createPortal(overlay, document.body) : null}
    </>
  );
}
