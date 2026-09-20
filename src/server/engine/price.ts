import { listComponents, listSwapAlternatives, getPackage } from "@/server/db/catalogue";
import type { ComponentRow, CurrencyRow } from "@/server/db/types";
import { selectionTotal, d, formatDelta, formatMoney, toTwo } from "@/lib/money";

// PS-04's core: a package decomposed into swappable lines. Swapping edits a
// *selection* (which lines the traveller keeps) — never the catalogue. The
// selection total is base_price + Σ kept deltas, computed in Decimal.

export interface Line {
  componentId: string;
  packageId: string;
  componentType: string;
  entityType: string | null;
  entityId: string | null;
  title: string;
  dayIndex: number;
  slot: string;
  quantity: number;
  priceDelta: string;
  currency: string;
  isOptional: boolean;
  isSwappable: boolean;
  swapGroup: string;
}

export function toLine(row: ComponentRow): Line {
  return {
    componentId: row.component_id,
    packageId: row.package_id,
    componentType: row.component_type,
    entityType: row.entity_type,
    entityId: row.entity_id,
    title: row.title,
    dayIndex: row.day_index,
    slot: row.slot,
    quantity: row.quantity,
    priceDelta: row.price_delta,
    currency: row.currency,
    isOptional: row.is_optional === 1,
    isSwappable: row.is_swappable === 1,
    swapGroup: row.swap_group,
  };
}

export interface Engine {
  listLines(packageId: string): Line[];
  getBase(packageId: string): string;
  getCurrency(packageId: string): string;
  alternatives(line: Line): Line[];
  selectionTotal(base: string, keep: Line[]): string;
  includedTotal(packageId: string): string;
}

export function createPriceEngine(): Engine {
  return {
    listLines(packageId: string): Line[] {
      return listComponents(packageId).map(toLine);
    },

    getBase(packageId: string): string {
      const pkg = getPackage(packageId);
      if (!pkg) throw new Error(`unknown package ${packageId}`);
      return pkg.base_price;
    },

    getCurrency(packageId: string): string {
      const pkg = getPackage(packageId);
      if (!pkg) throw new Error(`unknown package ${packageId}`);
      return pkg.currency;
    },

    alternatives(line: Line): Line[] {
      return listSwapAlternatives(line.packageId, line.swapGroup)
        .map(toLine)
        .filter((alt) => alt.componentId !== line.componentId);
    },

    selectionTotal(base: string, keep: Line[]): string {
      return selectionTotal(base, keep.map((l) => l.priceDelta));
    },

    /** Base + every non-optional delta (Starter Query 3's shape). */
    includedTotal(packageId: string): string {
      const pkg = getPackage(packageId);
      if (!pkg) throw new Error(`unknown package ${packageId}`);
      const deltas = listComponents(packageId)
        .filter((c) => c.is_optional === 0)
        .map((c) => c.price_delta);
      return selectionTotal(pkg.base_price, deltas);
    },
  };
}

/** Pure, data-free recompute — unit-test friendly. */
export function computeSelectionTotal(
  base: string,
  deltas: string[],
): string {
  return selectionTotal(base, deltas);
}

/** A human “why did this total move” summary for a single swap. */
export function describeSwap(
  from: Line,
  to: Line,
  currency: { iso4217: string; minor_unit_exponent: number },
  locale = "en-IN",
): { delta: string; label: string } {
  const effect = toTwo(d(to.priceDelta).minus(d(from.priceDelta)));
  return {
    delta: formatDelta(effect, currency, locale),
    label: `${from.title} → ${to.title}`,
  };
}

export function linePrice(
  line: Line,
  currency: CurrencyRow,
  locale = "en-IN",
): string {
  return formatDelta(line.priceDelta, currency, locale);
}

export function basePrice(
  base: string,
  currency: CurrencyRow,
  locale = "en-IN",
): string {
  return formatMoney(base, currency, locale);
}