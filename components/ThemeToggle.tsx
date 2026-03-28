"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

export function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <span className="inline-flex h-9 w-[7.5rem] rounded-md border border-line bg-surface-subtle" aria-hidden />
    );
  }

  const cycle = () => {
    if (theme === "system") setTheme("light");
    else if (theme === "light") setTheme("dark");
    else setTheme("system");
  };

  const label =
    theme === "system" ? `System (${resolvedTheme === "dark" ? "dark" : "light"})` : theme === "dark" ? "Dark" : "Light";

  return (
    <button
      type="button"
      onClick={cycle}
      className="inline-flex h-9 min-w-[7.5rem] items-center justify-center rounded-md border border-line bg-surface px-2.5 text-xs font-medium text-ink-muted transition hover:border-accent hover:text-ink"
      title="Theme: click to cycle system → light → dark"
    >
      {label}
    </button>
  );
}
