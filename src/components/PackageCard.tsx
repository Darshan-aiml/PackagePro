import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { formatMoney } from "@/lib/money";
import type { CurrencyRow } from "@/server/db/types";
import {
  Compass,
  Fish,
  Flower2,
  Footprints,
  Heart,
  Leaf,
  Mountain,
  Utensils,
  type LucideIcon,
} from "lucide-react";

const THEME_ICON: Record<string, LucideIcon> = {
  wildlife: Fish,
  heritage: Compass,
  pilgrimage: Flower2,
  adventure: Mountain,
  wellness: Leaf,
  food_trail: Utensils,
  honeymoon: Heart,
  family: Footprints,
};

export interface PackageCardData {
  packageId: string;
  name: string;
  city: string;
  theme: string;
  tier: string;
  durationDays: number;
  durationNights: number;
  basePrice: string;
  currency: string;
  reasonKey?: string;
  reasonParams?: Record<string, string>;
  reasonVisible?: boolean;
}

export async function PackageCard({
  card,
  currency,
  locale,
}: {
  card: PackageCardData;
  currency: CurrencyRow;
  locale: string;
}) {
  const tCard = await getTranslations({ locale, namespace: "packageCard" });
  const tReason = await getTranslations({ locale, namespace: "reason" });
  const Icon = THEME_ICON[card.theme] ?? Compass;

  const reason = card.reasonVisible
    ? tReason(card.reasonKey ?? "popular", card.reasonParams ?? {})
    : null;
  const price = formatMoney(card.basePrice, currency, localeFor(locale));

  return (
    <Link
      href={`/packages/${card.packageId}`}
      className="group flex cursor-pointer flex-col rounded-3xl border hairline bg-raised p-5 transition-[transform,box-shadow,border-color] motion-safe:hover:-translate-y-1 hover:border-accent/30 hover:shadow-[0_18px_48px_-18px_rgba(22,19,14,0.24)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
    >
      <div className="flex items-start justify-between">
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-soft text-sky transition-colors group-hover:bg-accent-soft group-hover:text-accent">
          <Icon className="h-5 w-5" strokeWidth={1.75} />
        </span>
        <span className="rounded-full px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-muted border hairline">
          {card.tier}
        </span>
      </div>

      <h3 className="mt-4 text-lg font-semibold tracking-tight leading-snug">
        {card.name}
      </h3>
      <p className="mt-0.5 text-sm text-muted">
        {tCard("in", { city: card.city })} ·{" "}
        {tCard("days", { days: card.durationDays })} ·{" "}
        {tCard("nights", { nights: card.durationNights })}
      </p>

      <div className="mt-4 flex items-end justify-between">
        <div>
          <p className="text-xl font-semibold tracking-tight tabular-nums">
            {tCard("from", { price })}
          </p>
        </div>
        <span className="rounded-full bg-accent px-3 py-1.5 text-xs font-semibold text-accent-ink transition-transform motion-safe:group-hover:scale-[1.04]">
          {tCard("view")}
        </span>
      </div>

      {reason && (
        <p className="mt-3 rounded-2xl bg-paper px-3 py-2 text-xs text-muted">
          {reason}
        </p>
      )}
    </Link>
  );
}

function localeFor(locale: string): string {
  if (locale === "hi") return "hi-IN";
  if (locale === "ta") return "ta-IN";
  return "en-IN";
}
