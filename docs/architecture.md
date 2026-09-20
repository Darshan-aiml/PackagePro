# Architecture — PackagePro web

```mermaid
flowchart LR
  subgraph Client
    UI[Header / LocaleSwitcher / UserPicker]
    CFG[Configurator — swap + live reprice]
    WIZ[PlanWizard]
    ITV[ItineraryView]
  end

  subgraph Server
    PG[app/[locale] pages — RSC]
    ACT[actions.ts — server actions]
    ENG[Engine layer]
    DB[(PS-04.db framework read-only)]
    DB2[(packagepro.db writable store)]
    RP[recommender.ts]
    PR[price.ts]
    PL[planner.ts]
    HS[hotelStats.ts]
    AX[explainer.ts — Gemini + template]
    MT[money.ts — decimal.js]
  end

  UI --> PG
  CFG --> PG
  WIZ --> ACT
  ITV --> ACT
  PG --> ENG
  ACT --> ENG
  ENG --> DB & DB2
  RP --> MT
  PR --> MT
  PL --> MT
  AX --> MT
  ITV --> AX
```

## Data-flow notes

1. **Browse** — RSC pages call the engines directly (`recommend()`, `listPackages`,
   `getPackage`, `listComponents`, `listSwapAlternatives`). Nothing leaves the server for
   home or package pages until the configurator's client component is fed a *plain*
   prop payload (see ADR 0002's serialization rule: never hand raw `node:sqlite` rows to
   a client component).
2. **Configure** — the client `Configurator` owns the swap state (one picked line per
   original component id, alternatives recomputed as *the group minus the current pick*,
   so every swap is reversible in one tap). It reprises live via
   `selectionTotal(base, kept deltas)` and hands `packageId + kept ids + city` to the
   plan route as a query handoff.
3. **Plan** — `PlanWizard` posts a `PlanRequest` to the `planTrip` action; `planFor`
   returns a fully explained `Plan`. `ItineraryView` renders the template summary
   immediately (pure `planToTemplate`) and only hits Gemini when asked, tagging the
   result `source: "gemini"`.
4. **Identity** — one cookie (`pp_user`, set by the client `UserPicker`) selects the
   traveller; server side it is read asynchronously via `next/headers` (Next 16 made
   `cookies()` a Promise — ADR 0004 tracks the convention drift). Read-only; writes are
   client-side + reload.

## Boundaries

- Server-only modules (`"server-only"`): the top of `explainer.ts`. The isomorphic
  pure core (`planText.ts`, `money.ts`) has no server imports so tests and the client
  share it.
- Every engine returns serializable plan data; no `Decimal` or row objects cross a
  client boundary.
- Money: DB TEXT → engine `Decimal` → display string. No float in the middle.
- Locale: reason keys are stable strings; translation is a presentation concern only.