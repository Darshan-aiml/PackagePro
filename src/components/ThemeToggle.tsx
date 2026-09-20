"use client";

import { useTheme } from "next-themes";
import { useTranslations } from "next-intl";
import { Moon, Sun } from "lucide-react";

/**
 * The markup never varies between server and client. CSS selects the visible
 * icon from `data-theme`, avoiding a hydration mismatch when the saved theme
 * is discovered before React mounts.
 *
 * Reduced motion: next-themes `disableTransitionOnChange` + globals'
 * `transition-duration: 0.01ms` guard mean the swap is instant for anyone who
 * asks — no cross-fade, no shimmer.
 */
export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const t = useTranslations();

  const isDark = resolvedTheme === "dark";

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label={t("nav.themeToggle")}
      title={t("nav.themeToggle")}
      className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full text-muted transition-colors hover:bg-accent-soft hover:text-accent"
    >
      <Sun className="theme-icon-sun h-4 w-4" strokeWidth={2} />
      <Moon className="theme-icon-moon h-4 w-4" strokeWidth={2} />
    </button>
  );
}
