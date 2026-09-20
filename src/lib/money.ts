import Decimal from "decimal.js";

// Money is a pair: a 2-place decimal (stored as TEXT) + an ISO-4217 code.
// Rule R3 of the dataset: never let a float near a price you will display.
// This module is the only place prices become arithmetic. Everything upstream
// keeps money as strings.

Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

export type { Decimal };

export function d(value: string | number | Decimal): Decimal {
  return value instanceof Decimal ? value : new Decimal(value);
}

export function sumDecimal(values: (string | number | Decimal)[]): Decimal {
  return values.reduce<Decimal>(
    (acc, v) => acc.plus(d(v)),
    new Decimal(0),
  );
}

/** base + every kept delta, to fixed 2 places — the live selection total. */
export function selectionTotal(
  base: string | Decimal,
  deltas: (string | Decimal)[],
): string {
  return d(base).plus(sumDecimal(deltas)).toFixed(2);
}

export function toTwo(value: string | Decimal): string {
  return d(value).toFixed(2);
}

interface CurrencySpec {
  iso4217: string;
  minor_unit_exponent: number;
}

/** Locale-aware money with the dataset's minor-unit exponent as source of truth. */
export function formatMoney(
  value: string | Decimal,
  currency: CurrencySpec,
  locale = "en-IN",
): string {
  const digits = currency.minor_unit_exponent;
  const mag = Math.pow(10, digits);
  const rounded = d(value).times(mag).round().div(mag); // scale then round, avoids float drift
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: currency.iso4217,
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(rounded.toNumber());
}

/** Format an absolute delta with +/− sign. */
export function formatDelta(
  value: string | Decimal,
  currency: CurrencySpec,
  locale = "en-IN",
): string {
  const magnitude = formatMoney(d(value).abs().toFixed(2), currency, locale);
  return d(value).isNegative() ? `−${magnitude}` : `+${magnitude}`;
}

/** Compare two textual amounts without ever crossing into float. */
export function amountEquals(a: string | Decimal, b: string | Decimal): boolean {
  return d(a).eq(d(b));
}

export function amountGt(a: string | Decimal, b: string | Decimal): boolean {
  return d(a).gt(d(b));
}