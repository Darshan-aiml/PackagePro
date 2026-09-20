"use client";

import { useTranslations } from "next-intl";
import { MapPin } from "lucide-react";
import { Link, usePathname } from "@/i18n/navigation";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";
import { ThemeToggle } from "@/components/ThemeToggle";
import { UserPicker } from "@/components/UserPicker";

export function Header({ currentUserId }: { currentUserId: string }) {
  const t = useTranslations();
  const pathname = usePathname();

  const tab = (label: string, href: string, active: boolean) => (
    <Link
      href={href}
      className={`rounded-full px-3 py-1 text-sm transition-colors ${
        active ? "text-ink" : "text-muted hover:text-ink"
      }`}
      aria-current={active ? "page" : undefined}
    >
      {label}
    </Link>
  );

  return (
    <header className="sticky top-0 z-40 backdrop-blur-xl bg-paper/75 border-b hairline">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <Link
          href="/"
          className="flex items-center gap-2 rounded-full text-sm font-semibold tracking-tight"
        >
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-ink text-paper">
            <MapPin className="h-3.5 w-3.5" strokeWidth={2.25} />
          </span>
          {t("app.name")}
        </Link>

        <nav className="hidden items-center gap-1 sm:flex">
          {tab(t("nav.browse"), "/", pathname === "/")}
          {tab(t("nav.plan"), "/plan", pathname.startsWith("/plan"))}
          <a
            href="mailto:hello@packagepro.travel"
            className="ml-2 rounded-full bg-accent px-3 py-1.5 text-sm font-semibold text-accent-ink transition-colors hover:bg-accent-deep"
          >
            {t("nav.contact")}
          </a>
        </nav>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          <LocaleSwitcher />
          <UserPicker currentUserId={currentUserId} />
        </div>
      </div>
    </header>
  );
}
