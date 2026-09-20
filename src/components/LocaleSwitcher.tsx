"use client";

import { useLocale, useTranslations } from "next-intl";
import { Globe } from "lucide-react";
import { Link, usePathname } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";

export function LocaleSwitcher() {
  const t = useTranslations("locale");
  const locale = useLocale();
  const pathname = usePathname();

  return (
    <div className="flex items-center gap-0.5 rounded-full px-1 py-1 bg-[color:var(--paper)] border hairline">
      <Globe className="ml-2 h-3.5 w-3.5 text-muted" strokeWidth={1.75} />
      {routing.locales.map((loc) => (
        <Link
          key={loc}
          href={pathname}
          locale={loc}
          aria-label={t("label")}
          className={`px-2 py-0.5 rounded-full text-xs transition-colors ${
            loc === locale
              ? "bg-ink text-paper"
              : "text-muted hover:text-ink"
          }`}
        >
          {t(loc)}
        </Link>
      ))}
    </div>
  );
}