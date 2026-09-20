"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { useTranslations } from "next-intl";
import { Wand2 } from "lucide-react";
import { planTrip } from "@/server/actions";
import { springTap } from "@/lib/motion";
import { ItineraryView } from "@/components/ItineraryView";
import type { Plan, PlanRequest } from "@/server/engine/planner";

export interface PlanWizardProps {
  locale: string;
  userId: string;
  cities: { cityId: string; name: string }[];
  languages: string[];
  guideWindow: { start: string; end: string };
  initial: {
    cityId?: string;
    packageId?: string;
    keep?: string[];
    startDate?: string;
    endDate?: string;
  };
}

export function PlanWizard({
  locale,
  userId,
  cities,
  languages,
  guideWindow,
  initial,
}: PlanWizardProps) {
  const t = useTranslations("plan");
  const tCommon = useTranslations("common");
  const [cityId, setCity] = useState(initial.cityId ?? cities[0]?.cityId ?? "");
  const [budget, setBudget] = useState("85000");
  const [adults, setAdults] = useState(2);
  const [start, setStart] = useState(initial.startDate ?? guideWindow.start);
  const [end, setEnd] = useState(initial.endDate ?? "2026-09-18");
  const [guideLanguage, setGuideLanguage] = useState("");
  const [working, setWorking] = useState(false);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [error, setError] = useState(false);

  const generate = async () => {
    setWorking(true);
    setError(false);
    try {
      const req: PlanRequest = {
        userId,
        cityId,
        startDate: start,
        endDate: end,
        adults,
        children: 0,
        budgetINR: budget,
        guideLanguage: guideLanguage || undefined,
        selection: initial.keep?.length
          ? { packageId: initial.packageId!, keptComponentIds: initial.keep }
          : undefined,
      };
      const result = await planTrip(req);
      setPlan(result);
    } catch {
      setError(true);
    } finally {
      setWorking(false);
    }
  };

  return (
    <div className="flex flex-col gap-8">
      <motion.form
        onSubmit={(e) => {
          e.preventDefault();
          void generate();
        }}
        className="grid gap-3 rounded-3xl border hairline bg-raised p-5 sm:grid-cols-2 lg:grid-cols-6"
      >
        <Field label={t("city")} className="lg:col-span-2">
          <select value={cityId} onChange={(e) => setCity(e.target.value)} className={selectCls}>
            {cities.map((c) => (
              <option key={c.cityId} value={c.cityId}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>

        <Field label={t("budget")}>
          <input
            type="number"
            min="1"
            step="500"
            value={budget}
            onChange={(e) => setBudget(e.target.value)}
            className={selectCls}
          />
        </Field>

        <Field label={t("adults")}>
          <input
            type="number"
            min="1"
            max="9"
            value={adults}
            onChange={(e) => setAdults(Number(e.target.value))}
            className={selectCls}
          />
        </Field>

        <Field label={t("start")}>
          <input type="date" value={start} min={guideWindow.start} max={guideWindow.end} onChange={(e) => setStart(e.target.value)} className={selectCls} />
        </Field>

        <Field label={t("end")}>
          <input type="date" value={end} min={guideWindow.start} max={guideWindow.end} onChange={(e) => setEnd(e.target.value)} className={selectCls} />
        </Field>

        <Field label={t("guideLanguage")} className="lg:col-span-2">
          <select value={guideLanguage} onChange={(e) => setGuideLanguage(e.target.value)} className={selectCls}>
            <option value="">—</option>
            {languages.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
        </Field>

        <div className="flex items-end lg:col-span-4">
          <motion.button
            {...springTap}
            type="submit"
            disabled={working}
            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-ink px-4 py-3 text-sm font-semibold text-paper disabled:opacity-60"
          >
            <Wand2 className="h-4 w-4" />
            {working ? t("working") : t("generate")}
          </motion.button>
        </div>
      </motion.form>

      <p className="text-center text-xs text-muted">— {t("septOnly")} —</p>

      {initial.keep && initial.keep.length > 0 && !plan && (
        <p className="rounded-2xl bg-accent/10 px-4 py-3 text-sm text-accent">
          {t("selectionHandoff")}
        </p>
      )}

      {error && <p className="text-sm text-[#c2421f]">{tCommon("error")}</p>}

      {plan && <ItineraryView plan={plan} locale={locale} />}
    </div>
  );
}

const selectCls =
  "w-full rounded-xl border hairline bg-paper px-3 py-2 text-sm outline-none focus:border-ink/40 transition-colors";

function Field({
  label,
  className = "",
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={`flex flex-col gap-1 ${className}`}>
      <span className="text-[11px] uppercase tracking-wider text-muted">{label}</span>
      {children}
    </label>
  );
}