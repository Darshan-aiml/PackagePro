"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useTranslations } from "next-intl";
import { Sparkles, BedDouble, User2, CloudRainWind } from "lucide-react";
import { formatMoney } from "@/lib/money";
import { planToTemplate } from "@/lib/planText";
import { springTap } from "@/lib/motion";
import { planSummary } from "@/server/actions";
import type { Plan } from "@/server/engine/planner";
import type { ExplainResult } from "@/server/ai/explainer";

const INR = { iso4217: "INR", minor_unit_exponent: 2 };
const loc = (locale: string) => (locale === "hi" ? "hi-IN" : locale === "ta" ? "ta-IN" : "en-IN");

export function ItineraryView({ plan, locale }: { plan: Plan; locale: string }) {
  const t = useTranslations();
  const tPlan = useTranslations("plan");
  const aiInitial = (): ExplainResult => ({ ...planToTemplate(plan), source: "template" });
  const [ai, setAi] = useState<ExplainResult>(aiInitial);
  const [thinking, setThinking] = useState(false);
  const [geminiOn, setGeminiOn] = useState(ai.source === "gemini");

  const ask = async () => {
    if (geminiOn) return;
    setThinking(true);
    const res = await planSummary(plan);
    setThinking(false);
    setAi(res);
    setGeminiOn(res.source === "gemini");
  };

  const statusBadge =
    plan.overBudget
      ? t("plan.overBudget")
      : plan.hotel && plan.guide
        ? t("plan.withinBudget")
        : t("plan.withinBudget");

  return (
    <div className="flex flex-col gap-4">
      {/* Summary card */}
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-3xl border hairline bg-raised p-5"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold tracking-tight">
                {plan.title}
              </h2>
              <span className="rounded-full px-2 py-0.5 text-[11px] text-muted border hairline">
                {tPlan("version", { v: plan.version })}
              </span>
            </div>
            <p className="mt-1 text-sm text-muted">
              {plan.startDate} → {plan.endDate} · {statusBadge}
            </p>
          </div>
          <p className="shrink-0 text-2xl font-semibold tracking-tight tabular-nums">
            {formatMoney(plan.totalCost, INR, loc(locale))}
          </p>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          <KeyStat label={t("plan.totalCost")} value={formatMoney(plan.budget, INR, loc(locale))} />
          <KeyStat label={t("plan.carbon")} value={`${plan.totalCarbonKg} kg`} />
          <KeyStat label={t("plan.duration")} value={`${Math.round(plan.totalDurationMinutes / 60)}h`} />
        </div>

        <div className="mt-4 flex flex-col gap-2">
          {(plan.hotel || plan.guide) && (
            <div className="flex flex-wrap gap-2">
              {plan.hotel && (
                <span className="flex items-center gap-1.5 rounded-full bg-paper px-3 py-1.5 text-xs">
                  <BedDouble className="h-3.5 w-3.5 text-muted" />
                  {plan.hotel.name} · {plan.hotel.room}
                </span>
              )}
              {plan.guide && (
                <span className="flex items-center gap-1.5 rounded-full bg-paper px-3 py-1.5 text-xs">
                  <User2 className="h-3.5 w-3.5 text-muted" />
                  {plan.guide.name} · {plan.guide.languages}
                </span>
              )}
            </div>
          )}

          {plan.warnings.length > 0 && (
            <ul className="flex flex-col gap-1 rounded-2xl bg-paper p-3 text-xs text-muted">
              {plan.warnings.map((w, i) => (
                <li key={i}>
                  <CloudRainWind className="mr-1 inline h-3.5 w-3.5" />
                  {w.key.startsWith("reason.") ? t(w.key, w.params ?? {}) : w.key}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Explainability: deterministic template + optional Gemini phrasing */}
        <div className="mt-4 border-t hairline pt-4">
          <p className="text-[11px] uppercase tracking-wider text-muted">
            {tPlan("explainedBy")}
          </p>
          <AnimatePresence mode="wait">
            <motion.div
              key={ai.summary}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <p className="mt-2 text-sm leading-relaxed">{ai.summary}</p>
              {ai.bullets.length > 0 && (
                <ul className="mt-2 flex flex-col gap-1">
                  {ai.bullets.map((b, i) => (
                    <li key={i} className="text-xs text-muted">
                      · {b}
                    </li>
                  ))}
                </ul>
              )}
            </motion.div>
          </AnimatePresence>
          <div className="mt-3">
            {ai.source === "gemini" ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#1a73e8]/10 px-3 py-1 text-xs font-medium text-[#1a73e8]">
                <Sparkles className="h-3 w-3" /> Gemini{ai.model ? ` · ${ai.model}` : ""}
              </span>
            ) : (
              <motion.button
                {...springTap}
                onClick={ask}
                disabled={thinking}
                className="inline-flex items-center gap-1.5 rounded-full border hairline px-3 py-1.5 text-xs font-medium transition-colors hover:bg-paper disabled:opacity-60"
              >
                <Sparkles className="h-3 w-3" />
                {thinking ? t("common.loading") : tPlan("rephrase")}
              </motion.button>
            )}
          </div>
        </div>
      </motion.section>

      {/* Days */}
      {plan.days.map((day, di) => (
        <motion.section
          key={day.index}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.03 * di }}
          className="rounded-3xl border hairline bg-raised p-5"
        >
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted">
            {tPlan("day", { day: day.index })}
          </h3>
          <div className="mt-3 flex flex-col divide-y divide-hairline">
            {day.items.map((item) => (
              <div key={item.sortOrder + item.title} className="flex items-center gap-3 py-2.5">
                <span
                  className={`shrink-0 rounded-lg px-2 py-1 text-[10px] font-semibold uppercase tracking-wide ${
                    item.itemType === "hotel"
                      ? "bg-ink text-paper"
                      : item.itemType === "guide"
                        ? "bg-accent/10 text-accent"
                        : "bg-paper text-muted"
                  }`}
                >
                  {item.itemType}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{item.title}</p>
                  <p className="truncate text-xs text-muted">
                    {t(item.explanationKey.startsWith("reason.") ? item.explanationKey : `reason.${item.explanationKey}`, item.explanationParams ?? {})}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-sm font-medium tabular-nums">
                    {item.cost === "0.00" ? "—" : formatMoney(item.cost, INR, loc(locale))}
                  </p>
                  {item.durationMinutes > 0 && (
                    <p className="text-[11px] text-muted tabular-nums">
                      {item.itemType === "guide" ? tPlan("guideDays", { n: plan.nights }) : `${item.durationMinutes}m`}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </motion.section>
      ))}
    </div>
  );
}

function KeyStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-paper px-2 py-2.5">
      <p className="text-[11px] uppercase tracking-wider text-muted">{label}</p>
      <p className="mt-0.5 text-sm font-medium tabular-nums">{value}</p>
    </div>
  );
}