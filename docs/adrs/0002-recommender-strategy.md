# 0002 — Two recommender strategies, gated on `users.segment`

**Status:** adopted

## Context

A recommender that treats a brand-new traveller like a loyal one fabricates confidence
the data doesn't have. `users.segment` (`cold_start | light | heavy`) lets the product
say *why* it recommends.

## Decision

`recommend()` branches on the segment:

- **cold_start** — hard-filter to the traveller's currency and any known language, then
  sort by *popularity* (review-weighted guest score of the package's signature hotels,
  cached per process). Every row gets the explicit reason `reason.coldStart`
  ("top pick for brand-new travellers") instead of a fake preference match. This is the
  honest cold-start path and it is a DoD gate that cold- and heavy-path results differ.
- **light / heavy** — hard filters first (currency, languages, budget band → allowed
  tier), then score via `recommendationScore`: up to 2 interest-theme matches (40 each),
  budget proximity to the band's daily reference (≤35% = `budgetFit`), pace fit, and a
  duration nudge. `topReason` reports `reason.interest | reason.budget | reason.pace |
  reason.popular` — the visible "why" is the winning signal, not a composite.

Tie-break favours the package covering more of the traveller's languages.

## Consequences

- Testable pure scoring functions (`recommendationScore`, `topReason`, `languagesMatch`,
  `tierAllowed`, `interestToThemes`) with no DB in the hot path.
- The demo narrative (cold first, then heavy) demonstrably changes the top row and its
  reason — the product-level proof of personalisation.
- Hard filters can legitimately empty a traveller's "for you" list; the home page shows
  an honest empty state for that.