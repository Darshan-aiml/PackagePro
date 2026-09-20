"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useTranslations } from "next-intl";
import { Lock, RotateCw } from "lucide-react";
import { selectionTotal, formatMoney, formatDelta, d } from "@/lib/money";
import { springTap, listSpring } from "@/lib/motion";
import { Link } from "@/i18n/navigation";

export interface ConfigLine {
  componentId: string;
  title: string;
  componentType: string;
  dayIndex: number;
  priceDelta: string;
  isOptional: boolean;
  isSwappable: boolean;
  swapGroup: string;
  alternatives: ConfigLine[];
}

export interface ConfiguratorProps {
  packageId: string;
  basePrice: string;
  currency: { iso4217: string; minor_unit_exponent: number };
  lines: ConfigLine[];
  handoff: { city: string };
  locale: string;
}

export function Configurator({
  packageId,
  basePrice,
  currency,
  lines,
  handoff,
  locale,
}: ConfiguratorProps) {
  const [picked, setPicked] = useState<Record<string, ConfigLine>>({});
  const [toast, setToast] = useState<string | null>(null);

  // For each group: the currently displayed line is the original or a swap.
  const current: ConfigLine[] = lines.map((l) => picked[l.componentId] ?? l);
  const total = selectionTotal(basePrice, current.map((l) => l.priceDelta));
  const moved = d(total).minus(d(basePrice));

  const swap = (from: ConfigLine, to: ConfigLine) => {
    setPicked((prev) => ({ ...prev, [from.componentId]: to }));
    setToast(`${from.title} → ${to.title}`);
    window.setTimeout(() => setToast(null), 2200);
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div className="flex flex-col gap-3">
        {lines.map((original) => {
          const line = picked[original.componentId] ?? original;
          // Available options: the whole group, minus what's shown right now —
          // so any swap (including back to the original) is always one tap away.
          const options = [original, ...original.alternatives].filter(
            (o) => o.componentId !== line.componentId,
          );
          return (
            <SwapGroup
              key={original.componentId}
              line={line}
              options={options}
              currency={currency}
              onSwap={swap}
            />
          );
        })}
      </div>

      <StickyTotal
        basePrice={basePrice}
        total={total}
        moved={moved}
        currency={currency}
        locale={locale}
        linkTo={`/plan?city=${handoff.city}&packageId=${packageId}&keep=${current
          .map((l) => l.componentId)
          .join(",")}`}
      />

      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full bg-ink px-4 py-2 text-sm text-paper shadow-xl"
          >
            <span className="tabular-nums">{toast}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function SwapGroup({
  line,
  options,
  currency,
  onSwap,
}: {
  line: ConfigLine;
  options: ConfigLine[];
  currency: ConfiguratorProps["currency"];
  onSwap: (from: ConfigLine, to: ConfigLine) => void;
}) {
  const t = useTranslations("configurator");
  const [open, setOpen] = useState(false);
  const hasAlternatives = options.length > 0;

  return (
    <motion.div
      layout
      transition={listSpring}
      className="rounded-3xl border hairline bg-raised p-4"
    >
      <div className="flex items-center gap-3">
        <span className="w-12 shrink-0 text-right text-[11px] font-medium uppercase tracking-wide text-muted">
          D{line.dayIndex}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{line.title}</p>
          <p className="text-xs text-muted">
            {line.isOptional ? t("optional") : t("allIncluded")} ·{" "}
            {formatDelta(line.priceDelta, currency, "en-IN")}
          </p>
        </div>
        {!line.isSwappable && (
          <span className="flex items-center gap-1 rounded-full px-2 py-1 text-[11px] text-muted border hairline">
            <Lock className="h-3 w-3" /> {t("lock")}
          </span>
        )}
        {hasAlternatives && (
          <motion.button
            {...springTap}
            onClick={() => setOpen((o) => !o)}
            className="flex items-center gap-1 rounded-full bg-paper px-3 py-1.5 text-xs font-medium border hairline"
            aria-expanded={open}
          >
            <RotateCw className="h-3 w-3" strokeWidth={2} />
            {t("swap")}
            <span className="text-muted">({options.length})</span>
          </motion.button>
        )}
      </div>

      <AnimatePresence initial={false}>
        {open && hasAlternatives && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: "spring", stiffness: 350, damping: 34 }}
            className="overflow-hidden"
          >
            <div className="mt-3 flex flex-col gap-1 border-t hairline pt-3">
              <p className="px-1 text-[11px] uppercase tracking-wider text-muted">
                {t("alternatives")}
              </p>
              {options.map((alt) => (
                <motion.button
                  key={alt.componentId}
                  {...springTap}
                  onClick={() => onSwap(line, alt)}
                  className="flex items-center justify-between gap-2 rounded-2xl px-3 py-2 text-left text-sm hover:bg-paper transition-colors"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                    <span className="truncate">{alt.title}</span>
                  </span>
                  <span className="shrink-0 text-xs text-muted tabular-nums">
                    {formatDelta(alt.priceDelta, currency, "en-IN")}
                  </span>
                </motion.button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function StickyTotal({
  basePrice,
  total,
  moved,
  currency,
  locale,
  linkTo,
}: {
  basePrice: string;
  total: string;
  moved: ReturnType<typeof d>;
  currency: { iso4217: string; minor_unit_exponent: number };
  locale: string;
  linkTo: string;
}) {
  const t = useTranslations("configurator");
  const loc = locale === "hi" ? "hi-IN" : locale === "ta" ? "ta-IN" : "en-IN";
  const diff = moved.isZero() ? null : formatDelta(moved.toFixed(2), currency, loc);

  return (
    <aside className="lg:sticky lg:top-24 h-fit rounded-3xl border hairline bg-raised p-5">
      <p className="text-[11px] uppercase tracking-wider text-muted">
        {t("total")}
      </p>
      <p className="mt-1 text-3xl font-semibold tracking-tight tabular-nums">
        {formatMoney(total, currency, loc)}
      </p>
      <div className="mt-2 flex items-center gap-2 text-sm">
        <span className="text-muted">{formatMoney(basePrice, currency, loc)}</span>
        {diff && (
          <span className={moved.isNegative() ? "text-[#0e9f6e]" : "text-[#c2421f]"}>
            {diff}
          </span>
        )}
      </div>

      <Link href={linkTo} className="mt-5 block w-full">
        <motion.button
          {...springTap}
          type="button"
          className="w-full rounded-2xl bg-ink px-4 py-3 text-sm font-semibold text-paper"
        >
          {t("planFromSelection")}
        </motion.button>
      </Link>
    </aside>
  );
}