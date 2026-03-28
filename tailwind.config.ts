import type { Config } from "tailwindcss";
import typography from "@tailwindcss/typography";

const config: Config = {
  darkMode: "class",
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: { DEFAULT: "var(--color-ink)", muted: "var(--color-ink-muted)" },
        surface: { DEFAULT: "var(--color-surface)", subtle: "var(--color-surface-subtle)" },
        accent: { DEFAULT: "var(--color-accent)", hover: "var(--color-accent-hover)" },
        whats: "var(--color-whats)",
        compare: "var(--color-compare)",
        line: "var(--color-line)",
      },
      fontFamily: {
        sans: ["var(--font-geist-sans)", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "system-ui", "sans-serif"],
      },
      boxShadow: {
        sleek: "0 1px 2px rgb(15 23 42 / 0.04), 0 4px 24px rgb(15 23 42 / 0.06)",
        "sleek-dark": "0 1px 2px rgb(0 0 0 / 0.2), 0 4px 24px rgb(0 0 0 / 0.35)",
      },
    },
  },
  plugins: [typography],
};

export default config;
