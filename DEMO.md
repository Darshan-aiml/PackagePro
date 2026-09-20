# DEMO.md — the 5-minute walkthrough

Everything here is the **live**, deterministic engine output from the current seed
dataset. No floats, no invented hotels, no hard-coded demo strings. This is the run
sheet for the ≤5-minute demo gate.

## Recommended cast (all three rationales on screen in one pass)

| Step | Who | What you show |
| --- | --- | --- |
| 1 | **Diya Novak** (cold start, no prefs) | The honest cold-start surface |
| 2 | **Sneha Pillai** (heavy, interested in heritage) | The preference surface |
| 3 | **Ananya Das** (light / INR budget) | The budget-bander |

> The recommender is **segment-gated by design**: Diya (cold start) always gets a
> **popularity-ranked** top pick with the `reason.coldStart` explanation — *not* a
> fake personalisation. Sneha (heavy) gets a **taste-scored** pick with
> `reason.interest`. That "cold ≠ heavy" difference is the product.

---

## The script

### 0:00–1:30 — Cold start (Diya Novak)

Open `http://localhost:3000/en` (clear cookies first) → **Diya** is selected by
default.

- **"For you"** shows a top pick with the badge **"We know little about you yet"**
  (en) / `सबसे लोकप्रिय` (hi). The `reason.coldStart` string is what makes that
  honest — we recommend on **popularity + languages + currency**, and we say so.
- Scroll to **Browse all** and open **Jodhpur Heritage — 3 Days** (₹10,921.73 base).

### 1:30–3:00 — Configurator (swap, live re-price, swap back)

- Every line is a real component with its exact INR price and a **swap** target:
  - D1 **hotel** Garden Palms Boutique Stay — Premier Suite ×2 nights
  - D1 **POI** Hot Springs (optional, ₹385.31)
  - D2 **transfer** Airport transfer (₹1,216.82)
  - D2 **POI** Jazz Cellar, Jodhpur (optional, ₹551.86)
  - D3 **meal** Dinner at a local kitchen (optional, ₹593.83)
  - D3 **guide** Aarav Patel — 2 days (₹4,500.00)
- Click **Swap** on the D1 POI → pick "Jazz Cellar" → **the sticky total re-prices
  exactly**: ₹10,921.73 → ₹11,088.28. The delta shows as `+₹166.55`.
- Click **Swap** again (back to Hot Springs) → total returns to ₹10,921.73. Every
  swap is reversible in one tap and never recomputes to a float.

### 3:00–4:30 — The planner (budget-gated, explained, Gemini-optional)

Click **Plan this selection** → the wizard carries over city + packages + dates.

- Set budget **₹40,000**, adults 2, dates **14–16 Sep 2026**, guide language `hi`.
- **Generate** → itinerary renders deterministically:
  - **Day 1** hotel 1 night + Hot Springs + guide
  - **Day 2** transfer + Jazz Cellar + guide
  - Total **₹9,895.55**, **within** the ₹40,000 budget (`overBudget: false`).
- Press **Rephrase with Gemini** → the summary is rephrased by Gemini (source badge
  `gemini-3.6-flash`); hit it again and the badge flips back to **template**.
- Now set budget **₹4,000** → Generate → planner shows **over budget**, drops
  non-locked optional lines (Hot Springs, Jazz Cellar), and every ``reason.…`` line
  explains why.

### 4:30–5:00 — The three packages view (language parity + segment)

- Switch to **Sneha Pillai** (heavy; hi/tamil) → home top pick **changes** and now
  carries `reason.interest` (not `coldStart`).
- Flip locale **en → hi → ta** from the header → the whole page re-renders; the
  `parity.test.ts` gate guarantees all three message files stay key-for-key identical
  (no missing-translation fallbacks in any route).

---

## What the engine guarantees (the 5 DoD things)

1. **Exact money** — `Decimal` end to end; `selectionTotal` never sees a float.
2. **Deterministic recommend / plan / price** — same input → same output (tests:
   `recommender.test.ts`, `planner.test.ts`).
3. **Every number / line explained** — `reason.*` strings + optionally Gemini phrasing.
4. **Budget-constrained** — planner keeps total ≤ budget or says why not, drops
   optional fee lines first, and labels it.
5. **Cold-start ≠ heavy** — the two segments demonstrably return different top picks,
   and the UI says *which* strategy it used.

Run `pnpm verify` (`typecheck`, `lint`, `test`, build) as the final gate before the
audience arrives.