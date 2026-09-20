import { notFound } from "next/navigation";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { selectedUserId } from "@/server/user";
import {
  getPackage,
  getCity,
  getCurrency,
  listComponents,
  listSwapAlternatives,
} from "@/server/db/catalogue";
import { Header } from "@/components/Header";
import { Configurator, type ConfigLine } from "@/components/Configurator";
import { Link } from "@/i18n/navigation";
import { ArrowLeft } from "lucide-react";

export default async function PackagePage({
  params,
}: {
  params: Promise<{ locale: string; packageId: string }>;
}) {
  const { locale, packageId } = await params;
  setRequestLocale(locale);

  const pkg = getPackage(packageId);
  if (!pkg) notFound();
  const city = getCity(pkg.city_id);
  const currency = getCurrency(pkg.currency)!;
  const t = await getTranslations({ locale, namespace: "configurator" });
  const tCommon = await getTranslations({ locale, namespace: "common" });
  const currentUserId = await selectedUserId();

  const lines: ConfigLine[] = listComponents(packageId).map((c) => {
    const alternatives = c.swap_group
      ? listSwapAlternatives(packageId, c.swap_group)
          .filter((a) => a.component_id !== c.component_id)
          .map((a) => toLine(a, []))
      : [];
    return toLine(c, alternatives);
  });

  return (
    <>
      <Header currentUserId={currentUserId} />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-20 sm:px-6">
        <Link
          href="/"
          className="mt-6 inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-ink"
        >
          <ArrowLeft className="h-4 w-4" />
          {tCommon("back")}
        </Link>

        <header className="mt-4 pb-6">
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
            <span className="rounded-full border hairline px-2 py-0.5 uppercase tracking-wide">
              {pkg.theme}
            </span>
            <span className="rounded-full border hairline px-2 py-0.5 uppercase tracking-wide">
              {pkg.tier}
            </span>
            <span className="rounded-full border hairline px-2 py-0.5 uppercase tracking-wide">
              {pkg.difficulty}
            </span>
            <span className="rounded-full border hairline px-2 py-0.5 uppercase tracking-wide">
              {pkg.duration_days}d / {pkg.duration_nights}n
            </span>
          </div>
          <h1 className="mt-3 text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">
            {pkg.name}
          </h1>
          <p className="mt-2 max-w-2xl text-muted">{pkg.description}</p>
        </header>

        <section>
          <div className="mb-4">
            <h2 className="text-xl font-semibold tracking-tight">{t("title")}</h2>
            <p className="mt-1 text-sm text-muted">{t("subtitle")}</p>
          </div>
          <Configurator
            packageId={pkg.package_id}
            basePrice={pkg.base_price}
            currency={{
              iso4217: currency.iso4217,
              minor_unit_exponent: currency.minor_unit_exponent,
            }}
            lines={lines}
            handoff={{ city: city?.name ?? "" }}
            locale={locale}
          />
        </section>
      </main>
    </>
  );

  function toLine(c: {
    component_id: string;
    component_type: string;
    day_index: number;
    title: string;
    price_delta: string;
    is_optional: number;
    is_swappable: number;
    swap_group: string;
  }, alts: ConfigLine[]): ConfigLine {
    return {
      componentId: c.component_id,
      title: c.title,
      componentType: c.component_type,
      dayIndex: c.day_index,
      priceDelta: c.price_delta,
      isOptional: c.is_optional === 1,
      isSwappable: c.is_swappable === 1,
      swapGroup: c.swap_group,
      alternatives: alts,
    };
  }
}