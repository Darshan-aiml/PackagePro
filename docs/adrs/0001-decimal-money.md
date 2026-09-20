# 0001 — Money is `Decimal`, end to end

**Status:** adopted

## Context

PS-04 stores prices as real decimals in TEXT columns (`base_price`, `price_delta`,
`base_rate`, `day_rate`, …). The dataset rule "never coerce a displayed price through a
float" is non-negotiable: a swap delta like `0.10` and a base like `10921.73` must add
exactly, and displayed totals must survive `-0.0099…` float artifacts.

## Decision

- Prices stay **TEXT** in the database and through every module boundary (engines take
  and return strings).
- Arithmetic happens in exactly one place: `src/lib/money.ts`, on `decimal.js`
  (`precision 20, ROUND_HALF_UP`).
- `formatMoney` scales by the currency's `minor_unit_exponent`, rounds, then hands the
  scaled value to `Intl.NumberFormat` — never the raw quote.
- `formatDelta` derives a signed display from the same rounded magnitude.
- `selectionTotal = base + Σ kept deltas` is the only total the configurator trusts.

## Consequences

- Exactness is testable (`money.test.ts`, `price.test.ts`: totals match `^\d+\.\d{2}$`
  and swap movements equal the delta difference exactly).
- New engines pick up the invariants by importing `money.ts` rather than re-deriving
  bespoke arithmetic.
- Cost: two representations exist (TEXT and `Decimal`); the boundary is tiny and typed.