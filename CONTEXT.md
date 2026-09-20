# PackagePro — Context

Dynamic tour packages: pick a package, swap individual stops and hotels, watch the
exact price walk up or down line by line, then generate a deterministic, explained
itinerary. Built on the PS-04 travel dataset (`../data/PS-04.db`, read-only) with a
separate writable store (`../data/packagepro.db`) for the plans you generate.

## Domain vocabulary

- **Package** — a bundled tour (`tour_packages`): a city, a theme, a tier, a duration,
  and a base price in one currency. 45 of the 60 serve INR (which is what every engine
  here can price exactly).
- **Package component / line** — a row in `package_components`: a POI, entry ticket,
  meal, transfer, hotel, or guide, owned by exactly one package, ordered by
  `day_index`+`slot`, with a `price_delta` (its contribution to the package total).
- **Swap group** — components that are interchangeable alternatives. **Package-local**:
  a swap never leaves the package. Swapping a line replaces it with an alternative and
  the delta changes; everything else is untouched.
- **Base price + deltas = selection total.** Money is *TEXT* end to end and only becomes
  arithmetic inside `src/lib/money.ts` (decimal.js). The configurator reprises live:
  `selectionTotal = base + Σ kept deltas`.
- **Traveller** — a seeded profile in `users`/`user_preferences`. Three ones drive the
  demo, selectable in the header (cookie `pp_user`):
  - **Diya Novak** (`usr_6afe5712`) — `cold_start`, luxury/adventure/friends
  - **Sneha Pillai** (`usr_f855344d`) — `heavy`, premium/comfort/solo, `guide_language=hi`
  - **Ananya Das** (`usr_aa216995`) — `light`, mid/adventure/family
- **Recommendation strategy** — `cold_start` (popularity-ranked, honest "we know little
  about you yet") vs `preference` (interest · pace · budget-proximity scoring). Gated on
  `users.segment`, so by design the top pick differs between profiles.
- **Guide availability** — only September 2026 exists in `guide_availability`
  (`GUIDE_WINDOW` 2026-09-01 → 2026-09-30). The planner only ever books a guide free on
  every requested date.
- **Itinerary / plan** — the planner's output: hotel + kept lines + guide, each item
  carrying an *explanation key* and params, persisted to `packagepro.db` with a version.

## Hard rules that hold everywhere

1. **R3 — never float a price.** Prices are TEXT in the DB, `Decimal` in engines,
   and only formatted at the UI. `formatMoney` scales to the currency's
   `minor_unit_exponent`, rounds, then formats.
2. **Planner is deterministic and explainable.** It never calls an LLM. Every line has a
   reason (`reason.hotel|guide|poi|transfer|meal|entry|droppedOptional`). Gemini
   (optional, key in `.env.local`) only *rephrases* those same structured facts and is
   bypassed the moment anything looks off — the fallback is the template phrase.
3. **Locale parity.** `messages/en|hi|ta.json` are key-for-key identical (enforced by
   `src/messages/parity.test.ts`). All three routes render the same flows.
4. **INR-only engines.** The planner prices INR packages, INR rooms, INR guides, so the
   Decimal arithmetic is exact in a single currency. Non-INR packages still browse and
   swap in the configurator (their deltas sum in the package currency).
5. **Node `node:sqlite` rows come back with a `null` prototype.** Anything that crosses
   the RSC→client boundary (like the `currency` prop fed to the client `Configurator`)
   must be a plain object — never a raw row. Notebook: `web/src/app/[locale]/packages`
   rehydrates exactly the fields the client needs.

## Layout

```
web/
  src/
    lib/          money.ts (Decimal layer), planText.ts (isomorphic summary), demo.ts, motion.ts
    i18n/         routing.ts, request.ts, navigation.ts, proxy.ts (Next 16 middleware)
    messages/     en/hi/ta.json (parity-tested) + index.ts
    server/
      db/         client.ts (two DBs), catalogue.ts (typed reads), store.ts (writes), types.ts
      engine/     recommender.ts, price.ts, planner.ts, hotelStats.ts
      ai/         explainer.ts (Gemini + template fallback)
      user.ts     cookie → traveller identity
      actions.ts  server actions the client components call
    components/   Header, LocaleSwitcher, UserPicker, PackageCard, Configurator, PlanWizard, ItineraryView
    app/[locale]/ page.tsx (home), packages/[packageId]/page.tsx, plan/page.tsx, layout.tsx
  data/           ../data/PS-04.db (read-only) ← engines read from here
  tests/          vitest setup (redirects writable store)
```

Commands: `pnpm dev | build | start | lint | test | typecheck | verify`.