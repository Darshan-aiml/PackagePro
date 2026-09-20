# PackagePro — DESIGN.md (project design system)

The long-form, skill-generated version with rationale lives in
`design-system/packagepro/MASTER.md` (run via the `ui-ux-pro-max` skill). This file
is the short in-tree reference so the direction is discoverable without leaving the
repo衛生.

## Direction (locked)

**Warm adventure-luxury.** "Explore the Unseen" — misty-mountain imagery, an immersive
rounded Location/Date/Guest search bar, bold sans display, one adventure-orange CTA at a
time, editorial white space. Patriotic: en/hi/ta localised, INR-exact money locked to
`tabular-nums`.

## Palette

Default **light**; full **dark** toggle (same 4.5:1 discipline). Warm sky + adventure orange.

| Token (light) | Value | Role |
|---------------|-------|------|
| `--paper` | `#F6F4F0` | page bg, warm misty sand |
| `--paper-raised` | `#FEFCF9` | cards / raised |
| `--ink` | `#1A1512` | text, near-black warm |
| `--ink-muted` | `#6B6256` | secondary (`--ink` @ ~68%) |
| `--hairline` | `rgba(26,21,18,0.10)` | 1px dividers |
| `--accent` | `#E8590C` | adventure-orange: CTAs, re-price deltas |
| `--accent-deep` | `#C2410C` | orange press/hover |
| `--accent-soft` | `#FDE8D7` | orange wash / chips |
| `--sky` | `#0EA5E9` | secondary brand accent (badges, links) |

| Token (dark) | Value | Role |
|--------------|-------|------|
| `--paper` | `#14110E` | page bg, warm ink |
| `--paper-raised` | `#1E1A16` | cards |
| `--ink` | `#F5F1E9` | text |
| `--ink-muted` | `#A79E8F` | secondary |
| `--hairline` | `rgba(245,241,233,0.12)` | dividers |
| `--accent` | `#FF8C3E` | lifted adventure-orange |
| `--accent-deep` | `#E8590C` | press |
| `--accent-soft` | `#3A2414` | orange wash |
| `--sky` | `#38BDF8` | lifted sky |

## Type

- **Display:** Montserrat 700 (headings, hero, package names) — `tracking-tighter`.
- **Body / UI:** system sans stack (Geist-variable body already installed; keep for body,
  Montserrat for display).
- Money: `tabular-nums` everywhere a ₹ is rendered; never a float (`Decimal`),
  dead simple.

## Motion

Motion-driven but **needs permission**: 150–350 ms micro, `spring` tap + list swaps in
the Configurator (live re-price), day-by-day itinerary reveal with `prefers-reduced-motion`
→ opacity-only fallback (already in `globals.css`). Entrance animations set `once`.

## Rules (non-negotiables, match skill checklist)

- `cursor-pointer` on every clickable (buttons are `<button>`/`<a>`, which get it via
  `button default` — still verify links).
- Hover ≠ color-only: add border/shadow/color lift.
- Visible focus rings on interactive elements.
- 44px touch targets; forms labelled; keyboard order = visual order.
- No emoji as icons — Lucide SVGs only.
- 4.5:1 min contrast in both themes; test `prefers-color-scheme` + toggle.

## Implementation corners

- `next-themes` `ThemeProvider` (attribute-based, light default, persisted via localStorage,
  `system` fallback) — toggle in the Header.
- Dark palette lives in `globals.css` `@theme` (same CSS variables, `[data-theme=dark]`).
- Fonts: swap `--font-geist-sans` body → keep; add Montserrat as `--font-display`
  via `next/font`.
