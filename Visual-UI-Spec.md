---
date: 2026-07-28
description: "Zanshin — the shipped void/panel/brand design spec for the Second Brain OS dashboard app. Supersedes Lightning Dojo (2026-07-28–2026-08-15) and the earlier coastal Field Notes palette."
tags:
  - reference
  - design-system
  - project/second-brain-dashboard
---

# Visual UI Spec — Zanshin

Design guidelines for the Second Brain OS dashboard app. This document was originally written for an intermediate palette, **"Lightning Dojo"** (monochromatic purple/amber), which itself superseded the earlier coastal Field Notes - Design System. As of **2026-08-15**, the app actually ships a different, later palette — **Zanshin** — confirmed current in 2026-08-15 Decision - Dashboard Reconciliation (Tabs, Zanshin Naming, Dead Fork). This rewrite brings the spec in line with what's shipped in `src/index.css`/`src/App.jsx`; Lightning Dojo's values are kept below only where they're still genuinely live in the code (not blanket-replaced — see the Legacy Tailwind Colors Still Live section).

## Canvas & Panels

| Element | Token | Class | Hex |
|---|---|---|---|
| Canvas (page background) | `--color-void` | `bg-void` | `#07060d` |
| Panels | `--color-panel` | `bg-panel/90` | `#1f1129` |

Borders are reserved for the outer Panel container only where used (e.g. `WhatMattersNow`'s `border-brand/20`) — most panels are borderless, using the panel background tint alone for separation. Rows and badges nested inside a panel use background-tint (`bg-void/40`, `bg-white/5` on hover) rather than their own border, consistent with the original "stacking borders reads as noisy" rule.

## Primary Theme — Brand Accent

| Token | Class | Hex |
|---|---|---|
| `--color-brand` | `text-brand` / `bg-brand` / `border-brand` | `#9b7bf0` — now an alias of `--color-violet-500` (2026-08-15), same value |

CTA buttons (e.g. the header "Capture" button) use solid `bg-brand` fill (hover `bg-brand/90`), no shadow/glow — consistent with the original monochromatic-fill call, just on the current token. **Button ink is `text-void`, not white** (changed 2026-08-15 — white-on-brand measured 3.24:1, below WCAG AA; void-on-brand is 6.23:1; see design.md §9). `text-brand` also marks active/live indicators (e.g. "● Live Claude ranking," active agent counts, focus-ring accents on inputs).

**Focus rings are `focus-visible:`, never `focus:` — and 1px on text inputs** (changed 2026-08-17). A mouse click into an input must not ring it: the caret already signals focus unambiguously, and a 2px full-perimeter brand ring on the widest element on the page spends the emphasis budget on a place the user is already looking. Keyboard users still get the ring. Shipped as `focus:outline-none focus-visible:border-brand/60 focus-visible:ring-1 focus-visible:ring-brand/40` on the quick-capture input and its destination `<select>`; checkboxes keep `ring-2` (a 16px box at 1px reads as noise) but are likewise gated on `focus-visible`. Governing rule and Natasha's verbatim reasoning: [[Design Laws]] Law 1 — *emphasis is a fixed budget, and a focus state is not an announcement*.

## Typography & Motion Tokens (shipped 2026-08-15)

Two self-hosted variable fonts (@fontsource imports in `src/index.css`, no external requests): **Schibsted Grotesk** is the app default via `--font-sans`; **JetBrains Mono** carries the mono-forward structural voice via `--font-structural` (alias of `--font-mono`) — applied in `App.jsx` to all `text-[10px]` micro-labels, panel `h2` titles, and the header wordmark. `--tracking-structural: 0.08em` exists for uppercase micro-labels. Motion: named `--duration-*` / `--ease-*` tokens shipped, and `--default-transition-duration`/`--default-transition-timing-function` are set to them, so every existing bare `transition-*` utility inherits the system feel with no per-class refit. Values and usage rules: design.md §4–5.

## Token Scale & Semantic Aliases (shipped 2026-08-15)

`src/index.css` `@theme` now carries the full 10-step OKLCH primary scale (`--color-violet-100..1000`, `500` = `#9b7bf0` exactly) plus semantic aliases: `--color-interactive`, `--color-interactive-quiet` (`violet-300`), `--color-due-date` (`#ff8c37`), `--color-critical` (`#e63946`), `--color-milestone` (`#ffd700`). Values, rationale, and usage rules live in design.md §3 — this section records only that they're shipped. `App.jsx` still uses `bg-brand`/`text-brand` classes (unchanged, alias-backed); no component uses the new aliases yet — the neutral (`slate-*`) and status (`amber-400`/`rose-400`) colors remain raw Tailwind per the Legacy section above.

## Legacy Tailwind Colors Still Live

Not everything from the prior "Lightning Dojo" pass was replaced — these raw Tailwind classes are still genuinely used in the shipped app today (verified against `App.jsx`), mixed in alongside the void/panel/brand tokens above:

| Color | Where used |
|---|---|
| `amber-400` | `PROJECT_STATUS_STYLES['in-progress']` |
| `rose-400` | `PROJECT_STATUS_STYLES.blocked` |
| `slate-500` / `slate-200` / `slate-400` / `slate-600` | Body text, muted text, panel headers, drag-handle icons — the neutral/grayscale text scale never moved off Tailwind's default `slate-*` |

Treat these as intentional, not drift — only the base canvas/panel/accent tokens moved to the named `--color-*` variables; the neutral text scale and status-specific accent colors are still raw Tailwind.

## Task Urgency Badges — built 2026-08-15

Two static row-level tags in `TaskTable`, rendered inline after the task text only when their data exists. The 3-tier priority ramp stays retired (design.md Pass 10): `medium`/`low` render **nothing** — absence is the default state, not a third badge.

- **Critical flag** — only `urgency: "high"` renders anything: a single crimson pill, `rounded-full bg-critical/10 text-critical`, `font-structural` uppercase `text-[11px] font-semibold tracking-structural`. Bold + tinted-bg deliberately, per design.md's AA note (plain crimson small text on panel is 4.30:1, below AA).
- **Due-date tag** — static orange pill, `rounded-full bg-due-date/10 text-due-date`, `font-structural text-[11px] tracking-structural`. No hover, no interactive role, ever (`--color-due-date`'s own rule).

Both are pills per the shape-encodes-kind rule (badge = `rounded-full`), background-tint only, no borders. They sit in the text cell's flex row (`shrink-0`, text keeps `truncate` via `min-w-0`), so the table's column structure is unchanged. Distinct from `ProjectStatusBadge` by palette and label register, keeping the two status axes visually separate.

`ACTIVE_PROJECTS.status` is the one status-like field that *does* have a shipped badge — see Components below.

## Components

- **Cards / panels**: `rounded-xl`, `bg-panel/90`, `shadow-lg shadow-black/40` — see `Panel` in `App.jsx`.
- **Status badges** (`ProjectStatusBadge`): `rounded-full`, background-tint + matching text color, no border — `text-brand bg-brand/10` (active/started), `text-amber-400 bg-amber-400/10` (in-progress), `text-rose-400 bg-rose-400/10` (blocked), `text-slate-500 bg-slate-500/10` (done).
- **Life bucket / count pills**: `rounded-full`, `bg-brand/15`, `text-brand` — see the Active Arcs lifeBucket tag and Workspaces tile counts.

## Related

- `design.md` (this directory, added 2026-08-15) — the full target design architecture (primitive→semantic→component tokens, motion, prompt knowledge base). This spec records *shipped* truth; design.md marks everything beyond it `[LOCKED]`/`[PROPOSED]`. Update both in the same change when tokens land.
- `ARCHITECTURE.md` (this directory) — real file map and data flow this UI renders
- `CLAUDE.md` (this directory) — working rules, including the urgency-badge gap noted above
