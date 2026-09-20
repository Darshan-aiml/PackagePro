# PackagePro — demo app

Adaptive travel packages over the **PS-04** dataset. Three travellers, three engines
(deterministic, money-exact, explainable), Chroma-vector-free — every "smart" number is
either read from the database or derived by pure functions. Gemini is wired in but
exists only as a phraser over the planner's facts; the core never depends on it.

## Stack

Next.js 16.3.5 (App Router, Turbopack, RSC) · React 19 · Tailwind CSS v4 · next-intl 4 ·
next-intl + next-intl 5 plugin · decimal.js (money) · node:sqlite (read-only PS-04;
writable packagepro.db) · vitest 3 + React Testing Library · pnpm 10.

## Commands

```bash
pnpm install        # install deps
cp .env.example .env.local   # then add your GEMINI_API_KEY if you want phrasing
pnpm dev            # dev server on :3000
pnpm test           # unit + integration tests (pure engines, no DB, no network)
pnpm verify         # typecheck + lint + test  (see package.json "verify")
pnpm build && pnpm start   # production build + serve
```

## DoD gates (all enforced)

| Gate | Proof |
| --- | --- |
| Money stays exact | TEXT in DB → `Decimal` in engines → formatted at UI. `src/lib/money.ts`; see ADR 0001. |
| Hyper-personalisation is real | recommender is score-based, tier-gated, language-matched; cold-start (`segment=cold_start`) and heavy (`segment=heavy`) profiles return *different* ranked sets and reasons. |
| Live re-price, per line | configurator deltas are exact Decimal swaps; `selectionTotal` re-derives from kept lines only. |
| Budget fit, deterministic | planner steps hotel→guide→optional drops with per-item `reason.*` explanations and a warnings list. |
| Every line is explained | every `PlanItem` carries `explanationKey` + params; `planSummary` (server action) rephrases with Gemini, falling back to the deterministic template text. |
| Planned ≠ truly heavy results | planner solves the *chosen* package city; recommender ranks across cities. Tests assert both. |
| 3 locales | en/hi/ta with key-for-key-identical message sets (`messages/parity.test.ts`), proxy-based locale switching. |
| 5-locale parity note | `ta/notes.md` contains parity ADR notes for the 3-locale decision. |

## Where the "AI" sits

- **Deterministic engines** (`src/server/engine/`): recommend → plan → explain. No LLM.
  Unit-tested, pure (no DB in hot path), and the source of every rendered number.
- **Gemini (`src/server/ai/explainer.ts` + `src/server/ai/explainerServer.ts`)**: only
  rephrases the template. Timeout-gated (3500ms), JSON-only, strict error fallback.
- **`src/lib/gemini.ts`**: isomorphic Gemini REST client (fetch), importable from
  engine + tests without server-only.
- **`src/lib/planText.ts`** + **`src/server/ai/explainer.ts`**: `planToTemplate` +
  `explainPlan` — a single `ExplainResult {summary, bullets, source}` the plan UI
  renders regardless of whether Gemini answered.

## Project layout

See `docs/architecture.md` for the full map.

```
src/
  app/[locale]/             en · hi · ta routes (home, packages/[id], plan)
  app/[locale]/packages     package detail + Configurator (client)
  components/               Configurator, PlanWizard, ItineraryView, Header, etc.
  lib/                      money, money format, gemini, motion, planText
  i18n·messages/            next-intl 4 app-router routing + json messages
  server/
    db/                     node:sqlite read path (catalogue) + writable store
    engine/                 recommender, planner, price — pure functions + tests
    actions.ts              server actions (planTrip, planSummary, plannerCities…)
```

## Estimating & demo

See `DEMO.md` — a 5-minute scripted walkthrough with the exact demo profiles and the
numbers the engine produces today.