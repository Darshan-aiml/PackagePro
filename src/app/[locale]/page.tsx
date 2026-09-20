import { setRequestLocale, getTranslations } from "next-intl/server";
import { Calendar, MapPin, Search, Users, type LucideIcon } from "lucide-react";
import { selectedUser, selectedUserId } from "@/server/user";
import { recommend, type Recommendation } from "@/server/engine/recommender";
import { listPackages, getCurrency, getPackage, getCity } from "@/server/db/catalogue";
import { Header } from "@/components/Header";
import { PackageCard, type PackageCardData } from "@/components/PackageCard";
import { Link } from "@/i18n/navigation";

export default async function Home({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const user = await selectedUser();
  const userId = await selectedUserId();
  const t = await getTranslations({ locale, namespace: "home" });
  const tTheme = await getTranslations({ locale, namespace: "theme" });
  const tBand = await getTranslations({ locale, namespace: "band" });
  const tPace = await getTranslations({ locale, namespace: "pace" });

  const coldStart = user.segment === "cold_start";
  const { recommendations, strategy } = recommend({ userId });

  const currency = getCurrency(user.home_currency)!;
  const forYou: PackageCardData[] = recommendations.map((r) =>
    toCard(r, { theme: tTheme, band: tBand, pace: tPace }),
  );

  const browse: PackageCardData[] = listPackages().map((p) => ({
    packageId: p.package_id,
    name: p.name,
    city: getCity(p.city_id)?.name ?? p.city_id,
    theme: p.theme,
    tier: p.tier,
    durationDays: p.duration_days,
    durationNights: p.duration_nights,
    basePrice: p.base_price,
    currency: p.currency,
    reasonVisible: false,
  }));

  return (
    <>
      <Header currentUserId={userId} />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-20 sm:px-6">
        {/* Hero */}
        <section
          aria-labelledby="hero-title"
          className="relative isolate min-h-[620px] overflow-hidden rounded-3xl bg-ink py-14 sm:py-20"
          style={{
            backgroundImage:
              "linear-gradient(90deg, rgba(14, 18, 18, 0.88) 0%, rgba(14, 18, 18, 0.54) 48%, rgba(14, 18, 18, 0.14) 100%), url('https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&w=2400&q=85')",
            backgroundPosition: "center",
            backgroundSize: "cover",
          }}
        >
          {/* The image is deliberate decoration only. Every actual trip choice
              still enters PackagePro's deterministic planner. */}
          <div
            aria-hidden="true"
            className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-ink/55 to-transparent"
          />

          <div className="max-w-xl px-5 sm:px-8">
          <p className="text-sm font-medium text-paper/70 motion-safe:animate-[rise_420ms_ease-out_both]">
            {t("strategy")}:{" "}
            {strategy === "cold_start" ? t("cold") : t("forYou")}
          </p>
          <h1
            id="hero-title"
            className="mt-4 text-5xl font-semibold leading-[0.96] tracking-[-0.06em] text-paper motion-safe:animate-[rise_560ms_ease-out_both] sm:text-7xl"
          >
            {t("heroTitle")}
          </h1>
          <p className="mt-6 max-w-md text-base leading-relaxed text-paper/80 motion-safe:animate-[rise_700ms_ease-out_both] sm:text-lg">
            {t("heroSub")}
          </p>
          </div>

          {/* Reservation panel remains a shortcut into the real planner, not a
              fake search form. */}
          <div className="mt-10 px-5 sm:absolute sm:right-8 sm:top-1/2 sm:mt-0 sm:w-[420px] sm:-translate-y-1/2 sm:px-0">
            <div
              role="search"
              className="flex flex-col gap-1 rounded-3xl bg-paper-raised p-3 shadow-[0_24px_80px_-28px_rgba(0,0,0,0.7)] motion-safe:animate-[rise_840ms_ease-out_both]"
            >
              <p className="px-2 pt-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
                {t("search.cta")}
              </p>
              <SearchField
                label={t("search.where")}
                icon={MapPin}
                className="border hairline"
              />
              <div className="grid grid-cols-2 gap-1">
                <SearchField label={t("search.date")} icon={Calendar} className="border hairline" />
                <SearchField label={t("search.guests")} icon={Users} className="border hairline" />
              </div>
              <Link
                href="/plan"
                className="mt-2 flex items-center justify-center gap-2 rounded-2xl bg-ink px-5 py-3 text-sm font-semibold text-paper transition-colors hover:bg-accent-deep"
              >
                <Search className="h-4 w-4" strokeWidth={2.25} />
                {t("search.cta")}
              </Link>
            </div>
          </div>
        </section>

        {/* For you */}
        <section className="mt-2">
          <div className="flex items-baseline justify-between">
            <h2 className="text-xl font-semibold tracking-tight">
              {coldStart ? t("cold") : t("forYou")}
            </h2>
            <span className="text-xs text-muted">{user.display_name}</span>
          </div>
          {forYou.length === 0 ? (
            <p className="mt-4 rounded-3xl border hairline bg-raised p-8 text-sm text-muted">
              {t("empty")}
            </p>
          ) : (
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {forYou.map((card) => (
                <PackageCard
                  key={card.packageId}
                  card={card}
                  currency={currency}
                  locale={locale}
                />
              ))}
            </div>
          )}
        </section>

        {/* Browse all */}
        <section className="mt-12">
          <h2 className="text-xl font-semibold tracking-tight">{t("browseAll")}</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {browse.map((card) => (
              <PackageCard
                key={card.packageId}
                card={card}
                currency={getCurrency(card.currency)!}
                locale={locale}
              />
            ))}
          </div>
        </section>
      </main>
    </>
  );
}

function SearchField({
  label,
  icon: Icon,
  className,
}: {
  label: string;
  icon: LucideIcon;
  className?: string;
}) {
  return (
    <Link
      href="/plan"
      className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-2xl px-3 text-sm font-medium text-ink transition-colors hover:bg-accent-soft hover:text-accent sm:rounded-full ${className ?? ""}`}
    >
      <Icon className="h-4 w-4 shrink-0 text-sky" strokeWidth={2} />
      <span>{label}</span>
    </Link>
  );
}

function toCard(
  r: Recommendation,
  t: { theme: (k: string) => string; band: (k: string) => string; pace: (k: string) => string },
): PackageCardData {
  const pkg = getPackage(r.packageId);
  const fullKey = r.reasonKey;
  return {
    packageId: r.packageId,
    name: r.name,
    city: r.city,
    theme: r.theme,
    tier: r.tier,
    durationDays: r.durationDays,
    durationNights: pkg?.duration_nights ?? r.durationDays - 1,
    basePrice: r.basePrice,
    currency: r.currency,
    reasonKey: fullKey.replace("reason.", ""),
    reasonParams: paramsForReason(fullKey, r, t),
    reasonVisible: true,
  };
}

function paramsForReason(
  key: string,
  r: Recommendation,
  t: { theme: (k: string) => string; band: (k: string) => string; pace: (k: string) => string },
): Record<string, string> {
  switch (key) {
    case "reason.interest":
      return { interest: t.theme(r.theme) };
    case "reason.budget":
      return { band: t.band(r.tier) };
    case "reason.pace":
      return { pace: t.pace(r.fit.paceFit ? "relaxed" : "packed") };
    default:
      return {};
  }
}
