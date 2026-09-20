# 0003 — Deterministic planner, Gemini as a phraser only

**Status:** adopted

## Context

The "AI planner" needs to fit a real budget, respect *real* guide availability, pick a
real room, and — for a demo and for trust — explain every line. A free-form LLM call
that dreams up prices or stops would violate R3 and the honesty bar.

## Decision

Two layers, kept strictly separate:

1. **Planner (`src/server/engine/planner.ts`) — deterministic, no network.**
   - Buy the cheapest INR room that fits the party (prefer a higher-rated hotel within
     +30% of that rate).
   - Book an INR guide free on *every* date (`guide_availability.is_available=1,
     slots_available≥1`), preferring the language and the package's theme specialisation.
   - Assemble hotel + kept lines + guide, total = `Σ items` (the double-count bug this
     exact invariant caught). If over budget: step down by dropping the highest
     non-locked, non-hotel, non-guide deltas first, recording `reason.droppedOptional`
     per drop.
   - Every `PlanItem` carries `explanationKey` + `explanationParams`; warnings carry
     reasons too (`reason.noPackage|noHotel|noGuide`). Plans persist to `packagepro.db`
     with a `version` for the hypothetical diff feature.
2. **Explainer (`src/server/ai/explainer.ts`) — phraser only.**
   - `planToTemplate` (in `lib/planText.ts`, isomorphic) derives a summary + bullets
     purely from plan facts — zero hallucination surface, works offline and in tests.
   - `explainPlan` optionally asks Gemini (key → `GEMINI_API_KEY`) to *rephrase the exact
     supplied facts*, with a 4 s timeout and strict JSON contract; any failure (no key,
     non-200, malformed JSON, missing `summary`) falls back to `source: "template"`.

## Consequences

- The creative AI is decorative; the facts are always the deterministic planner's.
  "Rephrase with Gemini" is visibly tagged with the model, and the button only appears
  when `source === "template"` (i.e. after a successful call the badge replaces it).
- Guide availability is only Sept 2026 — the wizard states it explicitly and clamps the
  date inputs to `GUIDE_WINDOW`.
- Engines stay unit-testable without any network or key (planner.test.ts covers budget
  stepping, guide matching, locked/locked-free dropping, and per-item explanations).