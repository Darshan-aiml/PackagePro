# PackagePro — Design System (MASTER)

Source of truth for the UI-ux-pro-max re-theme. Derived from the ui-ux-pro-max
search for `travel tour packages adventure luxury` (pattern: Immersive/Interactive +
Motion-Driven), adapted to the user's direction from the design consultation.

## Product & Persona

- **What**: Adaptive travel packages — a recommender, an exact-money configurator
  (swap lines → live re-price), and an explainable plan wizard. Every number is real
  and deterministic; every choice has a reason in en/hi/ta.
- **Who**: "PackagePro" travellers who want **unseen, extraordinary India** — heritage,
  wildlife, adventure, wellness. The brand voice is *a trusted, obsessive travel
  concierge*: confident, warm, zero hype, every INR justified.

## Brand direction (from consultation answers)

| Axis | Choice |
|------|--------|
| Vibe | Warm adventure-luxury: **"Adventure luxe with a soul"** |
| Palette (index) | **Sky-light + adventure-orange**, warm-natural neutrals; light default + dark toggle |
| Type | Rounded-geometric display (Montserrat, bold) paired with a humanist body (system) |
| Motion | Immersive interactive, animated on entrance; 150–350ms; respects `prefers-reduced-motion` |
| Chips | Rounded pill ([11px] uppercase tracking-wide, `hairline` border) |

## Design tokens (Tailwind v4 — `@theme inline` in `globals.css`)

Light is the default; dark is a first-class toggle with equal contrast, not an afterthought.

### Color — light (default)
| Token | Value | Role |
|-------|-------|------|
| `--paper` | `#f6f4ef` | page background (warm paper) |
| `--paper-raised` | `#fdfcf9` | cards / raised surfaces |
| `--ink` | `#171310` | headings + primary text (near-black warm) |
| `--ink-muted` | `#5f5a52` | secondary text (≥ slate-600 equiv, 4.5:1) |
| `--hairline` | `rgba(23,19,16,0.10)` | 1px borders / dividers |
| `--accent` | `#e8590c` | adventure-orange — CTAs, selected swaps, active badges |
| `--accent-ink` | `#7a2d05` | text-on-orange (darkened for contrast) |
| `--link` | `#0b5e8a` | sky-ink — inline links, focus |

### Color — dark (toggle)
| Token | Value | Role |
|-------|-------|------|
| `--paper` | `#0f0e0c` | page background (warm near-black) |
| `--paper-raised` | `#181613` | cards / raised surfaces |
| `--ink` | `#f4f1ea` | headings + primary text |
| `--ink-muted` | `#a8a29a` | secondary text |
| `--hairline` | `rgba(244,241,234,0.12)` | borders / dividers |
| `--accent` | `#ff7d2e` | adventure-orange (lifted for dark) |
| `--accent-ink` | `#241004` | text-on-orange |
| `--link` | `#6ec3f5` | sky-ink (lifted for dark) |

### Motion
| Token | Value |
|-------|-------|
| spring tap | `stiffness 600 damping 30` (in `lib/motion.ts`) |
| sheet / entrance | `stiffness 380 damping 32`, spring |
| entrance stagger | `staggerChildren 0.06`, dur 0.35 |
| duration | 150–350ms micro; 300–400ms entrances |
| reduced motion | disabled in `globals.css` `@media (prefers-reduced-motion)` — opacity-only |

## Typography

| Role | Family | Style |
|------|--------|-------|
| Display (hero / h1) | **Montserrat** (Bold 700 → Extrabold 800), rounded-geometric | tracking-[-0.04em], tight |
| Headings (h2/h3) | Montserrat 600/700 | tracking-tight |
| UI + body | system sans (`ui-sans-serif, system-ui`, + Devanagari/Tamil fallbacks) | 16px min, leading relaxed |
| Labels / chips | 11px uppercase tracking-wider | `hairline` pill |

Use Montserrat via `next/font` (`--font-montserrat`) and thread through `--font-sans`.

## Iconography
- **Lucide** icons only (already the pattern); **no emoji** anywhere.
- Fixed `h-4 w-4` / `h-5 w-5`, `strokeWidth 1.75` for brand marks.
- SVG inline (lucide-react), consistent set across components.

## Component thesaurus (for the redesign)

| Component | Current | Target (vibe) |
|-----------|---------|----------------|
| Header | sticky simple bar | minimal sticky, backdrop-blur, floating nav pill on desktop, distinct "Contact" CTA |
| Search bar | — (none on home) | rounded-3xl pill: Location · Guests · Dates + CTA over hero imagery |
| Hero | text-only paper | layered misty-mountain imagery + parallax, entrance stagger, supporting tagline |
| PackageCard | boxed list | rounded-3xl raised card, hover lift + shadow, chip row, reason strip, `cursor-pointer` |
| Configurator swap | border row | swap group panels with AnimatePresence, re-price motion, sticky total |
| PlanWizard / Itinerary | bordered steps | timeline itinerary with day chips, budget meter, motion-entered days |
| Buttons | bg-ink | accent CTA (`bg-accent text-accent-ink`), hover brightness, `cursor-pointer`, focus ring |
| Toggle (dark) | — | `next-themes`, sun/moon, prefers-color-scheme initial, no FOUC |

## Anti-patterns (don't)
- **No emoji icons** — Lucide only.
- **No huge hero text on flat paper** — pair with imagery/motion.
- **Don't sacrifice INR tabular-nums/`Decimal` exactness** for layout flair.
- **Don't ship hover states that rely on color alone** — add border/shadow/lift.
- **Don't animate layout-affecting props** on the budget-total readout — keep numbers stable.

## Accessibility gates (from ui-ux-pro-max)
- AA contrast ≥ 4.5:1 **both** themes (dark tokens lifted above).
- Visible focus rings (accent outline) on all interactive elements.
- 44px touch targets; `cursor-pointer` on clickables; stable hover (no layout shift).
- Icon-only buttons get `aria-label` + `title`.
- Keyboard order = visual order; tab nav + search all reachable.
- `prefers-reduced-motion` respected (opacity-only fallback).
- Responsive from 375px: no horizontal scroll; nav/search collapse with menu.

## Stacks
Implementation lives with the **`nextjs` + `tailwind` (v4) + `next-themes`** stack;
`next-intl` for copy. See `docs/architecture.md` for engine details, per ADRs 0001–0004.
