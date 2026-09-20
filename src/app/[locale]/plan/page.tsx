import { setRequestLocale, getTranslations } from "next-intl/server";
import { selectedUserId } from "@/server/user";
import { plannerCities, guideLanguages } from "@/server/actions";
import { GUIDE_WINDOW } from "@/server/engine/planner";
import { Header } from "@/components/Header";
import { PlanWizard } from "@/components/PlanWizard";

export default async function PlanPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const sp = await searchParams;
  const t = await getTranslations({ locale, namespace: "plan" });

  const userId = await selectedUserId();
  const cities = await plannerCities();
  const guideWindow = GUIDE_WINDOW;

  const rawCity = sp.city?.toString();
  const cityId = cities.some((c) => c.cityId === rawCity) ? rawCity : undefined;
  const resolvedCity = cityId ?? cities[0]?.cityId;

  const languages = await guideLanguages(resolvedCity ?? "");
  const start = sp.start?.toString();
  const end = sp.end?.toString();
  const keep = sp.keep?.toString().split(",").filter(Boolean);

  return (
    <>
      <Header currentUserId={userId} />
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 pb-20 sm:px-6">
        <header className="pt-10 pb-6">
          <h1 className="text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">
            {t("title")}
          </h1>
          <p className="mt-2 max-w-xl text-sm text-muted">{t("subtitle")}</p>
        </header>

        <PlanWizard
          locale={locale}
          userId={userId}
          cities={cities}
          languages={languages}
          guideWindow={guideWindow}
          initial={{
            cityId: resolvedCity,
            packageId: sp.packageId?.toString(),
            keep: keep?.length ? keep : undefined,
            startDate: start,
            endDate: end,
          }}
        />
      </main>
    </>
  );
}