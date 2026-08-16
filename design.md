---
date: 2026-08-15
description: "Zanshin design bible — full primitive→semantic→component token architecture (OKLCH), motion system, component specs, contrast audit, and the AI design-prompt knowledge base. Target architecture; Visual-UI-Spec.md records shipped truth."
tags:
  - reference
  - design-system
  - project/second-brain-dashboard
---

# design.md — Zanshin Design Architecture

**The focus that stays after the strike.**

This is the design bible for **Zanshin**, the brand skin of the Second Brain OS dashboard. It defines the *full* design architecture — token primitives, semantic layer, component tokens, motion, and the AI prompt knowledge base used to generate UI against this system.

**How this document relates to `Visual-UI-Spec.md`** (single-source rule): `Visual-UI-Spec.md` stays the record of **what is shipped in code today**; this file is the **architecture the system is converging on**. Every item here is marked:

- `[SHIPPED]` — live in `src/index.css` / `src/App.jsx` as of 2026-08-15
- `[LOCKED]` — decided and non-negotiable (see the project decision log), but not yet in code
- `[PROPOSED]` — this document's recommendation; not yet ratified by Natasha

When something ships, update `Visual-UI-Spec.md` and flip the marker here. Never let the two disagree silently.

---

## 1. Brand Foundation

Source: the project's brand and mood-board work.

- **Concept**: a training ground, not a database. "Divine Cyberpunk Electro Static" — sleek, dark, atomic, precise. Minimalist structure, maximalist soul.
- **Brand pillars** `[LOCKED]`: Anti-Corporate / Craft-First · Active Mastery / The Dojo · Tactile & Expressive.
- **Tagline** `[LOCKED 2026-08-02]`: *"The focus that stays after the strike"* — Zanshin is the sustained awareness held after a technique; the name and tagline are the same concept.
- **Naming** `[LOCKED 2026-08-15]`: "Second Brain OS" is the umbrella; "Zanshin" is this dashboard's brand skin. Keep the compound header.
- **Panel language** `[SHIPPED]`: Active Projects → *Active Arcs*, tasks → *Missions*, open loops → *Open Threads*. Visual identity + language only — **no gamification mechanics** (XP, streaks, levels) per `branding/Gamification & Reward Psychology Research.md`.

## 2. Design Principles

1. **One interactive color.** Violet is the *sole* interactive accent. Every other color is informational, never clickable-looking. `[LOCKED — Pass 01, reaffirmed Pass 07]`
2. **Calm is gray, not orange.** The counterweight to the violet-forward direction is minimal gray/outline utility controls, not a second hot color. `[LOCKED — Pass 06]`
3. **Borderless panels; separation by tint and elevation.** Stacking borders reads as noisy. Panels separate from the void by background + shadow; nested rows separate by background tint (`bg-void/40`), not their own borders. `[SHIPPED]`
4. **Shape encodes kind.** Badges/pills = fully rounded (`rounded-full`); buttons = rounded rectangle (`rounded-lg`/`rounded-xl`), never full-circle. A reader should know "label vs. control" from silhouette alone. `[LOCKED — Pass 09]`
5. **Atmosphere through tokens, not decoration.** The dojo mood lives in color, motion, and language — no mascots or ornament embedded in the working surface (companion character was built, then deliberately pulled out and parked).
6. **Drag-and-drop outranks polish.** Freely reorderable lists are the core value driver; when prioritizing, interaction quality beats new visual work. `[LOCKED — Product Strategy Brief]`
7. **Cinematic at rest, legible in use.** The void ground is for drama; every text/background pair must still clear WCAG AA (see §9 audit).

## 3. Token Architecture — Three Tiers

```
PRIMITIVE  →  SEMANTIC  →  COMPONENT
raw OKLCH     purpose        specific usage
--violet-500  --color-interactive  --button-primary-bg
```

Components never reference primitives directly — always through the semantic layer, so the skin can be re-themed (or a future "Origami" calm mode added) without touching component code. Primitives are defined in OKLCH (perceptually uniform lightness; scales generate predictably); sRGB hex fallbacks listed since values were locked as hex.

### 3.1 Color Primitives

Named palette `[LOCKED]` (OKLCH computed from the locked hex, 2026-08-15):

| Primitive | Hex | OKLCH | Origin |
|---|---|---|---|
| `--void` | `#07060d` | `oklch(12.8% 0.017 292)` | Midnight Void — hybrid Option C ground |
| `--aubergine` | `#1f1129` | `oklch(21.0% 0.049 310)` | validated panel surface |
| `--violet-500` | `#9b7bf0` | `oklch(66.5% 0.169 294)` | the validated accent — **never revert to Neon Orchid `#B14AED`** |
| `--orange` | `#ff8c37` | `oklch(75.3% 0.168 53)` | Action Orange — static due-date tag ONLY |
| `--gold` | `#ffd700` | `oklch(88.7% 0.182 95)` | Divine Gold — rare milestones / mission-clear only |
| `--crimson` | `#e63946` | `oklch(61.2% 0.208 22)` | Tactical Crimson — the single optional "Critical" flag only |

**Primary scale** `[SHIPPED 2026-08-15 — in src/index.css @theme]` (direction locked at Direction Log Pass 08). 10-step OKLCH scale, hue held at 294, chroma peaking at the anchor; `--violet-500` **is** the shipped `#9b7bf0` exactly, and `--color-brand` is now an alias of it so all existing classes hold:

| Step | OKLCH | sRGB |
|---|---|---|
| `--violet-100` | `oklch(95% 0.078 294)` | `#f1e5ff` |
| `--violet-200` | `oklch(88% 0.101 294)` | `#dbcbff` |
| `--violet-300` | `oklch(80% 0.126 294)` | `#c2adff` |
| `--violet-400` | `oklch(72% 0.152 294)` | `#ab90fa` |
| `--violet-500` | `oklch(67% 0.169 294)` | `#9b7bf0` ← anchor |
| `--violet-600` | `oklch(56% 0.136 294)` | `#7a62bb` |
| `--violet-700` | `oklch(48% 0.110 294)` | `#624f95` |
| `--violet-800` | `oklch(39% 0.081 294)` | `#483b6c` |
| `--violet-900` | `oklch(30% 0.053 294)` | `#2f2846` |
| `--violet-1000` | `oklch(21% 0.047 294)` | `#1a132c` |

**Neutral scale** `[SHIPPED as raw Tailwind — intentional, not drift]`: the text scale is Tailwind `slate-*` (`slate-200` body-bright, `slate-400` muted/headers, `slate-500` tertiary, `slate-600` disabled/handles). `[PROPOSED]`: keep slate values but alias them as primitives (`--neutral-*`) at adoption time so the semantic layer never names a Tailwind class.

**Status accents** `[SHIPPED as raw Tailwind]`: `amber-400` (in-progress), `rose-400` (blocked). Same aliasing proposal applies.

### 3.2 Non-color Primitives

| Group | Tokens | Status |
|---|---|---|
| Spacing | 8pt scale — `--space-1..8` = 4/8/12/16/24/32/48/64px (Tailwind `p-2 p-4 gap-6` usage already conforms) | `[SHIPPED convention]` |
| Radii | `--radius-row: 8px` · `--radius-panel: 12px` (`rounded-xl`) · `--radius-pill: 9999px` | `[SHIPPED]` |
| Elevation | `--shadow-panel: 0 10px 15px -3px rgb(0 0 0 / .4), 0 4px 6px -4px rgb(0 0 0 / .4)` (`shadow-lg shadow-black/40`) | `[SHIPPED]` |
| Hairlines | internal row dividers `rgba(255,255,255,.10)` — 5% was invisible on void, bumped 2026-08-02 | `[LOCKED]` |
| Durations | `--duration-instant: 100ms` · `--duration-fast: 140ms` · `--duration-settle: 180ms` · `--duration-base: 200ms` · `--duration-deliberate: 320ms` | `[SHIPPED 2026-08-15 — carried from Field Notes motion system; --default-transition-duration = base]` |
| Easing | `--ease-standard: cubic-bezier(0.32, 0.72, 0, 1)` (open/expand — confident settle, zero overshoot) · `--ease-out-quick: cubic-bezier(0.4, 0, 0.2, 1)` (close/dismiss) | `[SHIPPED 2026-08-15 — --default-transition-timing-function = standard, so bare transition-* utilities inherit the system feel]` |

### 3.3 Semantic Tokens

| Semantic token | → Primitive | Rule |
|---|---|---|
| `--color-bg-canvas` | `--void` | page ground only |
| `--color-bg-surface` | `--aubergine` | panels, at `/90` opacity over void |
| `--color-bg-sunken` | `--void` at 40% | nested rows, inputs inside panels |
| `--color-ink-primary` | `--neutral-200` | body text |
| `--color-ink-muted` | `--neutral-400` | panel headers, secondary text |
| `--color-ink-tertiary` | `--neutral-500` | metadata, placeholders |
| `--color-interactive` | `--violet-500` | THE interactive color: CTAs, active states, live indicators, focus rings |
| `--color-interactive-quiet` | `--violet-300` | secondary-button border+text (`--violet-200` = quieter alt) |
| `--color-interactive-hover-glow` | `--violet-500` | hover-glow on secondary buttons (Pass 07: glow is violet, never orange) |
| `--color-due-date` | `--orange` | static due-date tag ONLY. No hover, no interactive role, ever |
| `--color-critical` | `--crimson` | single optional "Critical" flag. The 3-tier priority ramp is retired (Pass 10) — no Standard/Low badges |
| `--color-milestone` | `--gold` | rare milestones / mission-clear flash only; freed from priority duty by Pass 10 |
| `--color-status-progress` | `amber-400` | project execution stage only |
| `--color-status-blocked` | `rose-400` | project execution stage only |
| `--color-status-done` | `--neutral-500` | project execution stage only |

**The two status axes stay distinct** `[LOCKED]`: task `urgency` (high/medium/low + optional `dueDate`) vs. project `status` (started/in-progress/blocked/done). Only `status` has a shipped badge; urgency badges are an unbuilt gap tracked in `memory-bank/PROGRESS.md` — do not invent a treatment ad hoc.

### 3.4 Component Tokens

| Token | Value | Status |
|---|---|---|
| `--panel-bg` | `--color-bg-surface` at 90% | `[SHIPPED]` |
| `--panel-radius` / `--panel-shadow` | `--radius-panel` / `--shadow-panel` | `[SHIPPED]` |
| `--button-primary-bg` | `--color-interactive`, hover 90% | `[SHIPPED]` |
| `--button-primary-ink` | `--void` — **not white**: void-on-brand = 6.2:1 (AA), white-on-brand = 3.2:1 (fails AA). See §9 | `[SHIPPED 2026-08-15 — Capture button `text-void`]` |
| `--button-secondary` | outline only, border+text `--color-interactive-quiet`, no fill; hover-glow `--color-interactive` | `[LOCKED — Pass 07/08]` |
| `--button-utility` | gray, minimal, icon-based — the calm counterweight | `[LOCKED — Pass 06]` |
| `--badge-shape` | `--radius-pill`, tinted bg (`color/10`) + matching text, no border | `[SHIPPED]` |
| `--focus-ring` | 2px `--color-interactive` at 50% (`ring-brand/50`) | `[SHIPPED]` |
| `--row-hover` | `rgba(255,255,255,.05)` bg tint | `[SHIPPED]` |

## 4. Typography

Voice is **mono-forward structural** `[LOCKED — Pass 01]`: structural/system text (labels, counts, metadata, timestamps) reads as machine text; prose stays humanist.

`[SHIPPED 2026-08-15]` stack — self-hosted variable fonts (@fontsource, no external requests), wired in `src/index.css` and applied across `App.jsx` (all 10px micro-labels, panel titles, header wordmark):

| Role | Face | Token |
|---|---|---|
| Structural: panel headers, badges, metadata, counts | **JetBrains Mono** (variable) — uppercase micro-labels pair with `--tracking-structural: 0.08em` | `--font-structural` (alias of `--font-mono`) |
| Body / task text | **Schibsted Grotesk** (variable) — replaces the earlier Inter proposal: Inter is the retired default-UI-sans cliché (typography-expert §0), and Schibsted's grotesque skeleton harmonizes with the mono | `--font-sans` (app default) |
| Display (header wordmark) | same mono, heavier weight — no third face | use `--font-structural` |

Type scale `[PROPOSED]`: minor-third-ish app scale — 12 (metadata) / 13 (badges) / 14 (body) / 16 (panel titles) / 20 (page header) / 28 (display). Line-height 1.5 body, 1.2 headers.

## 5. Motion System

Signature interactions `[LOCKED — built in the 2026-08-02 Dashboard *artifact* (Pass 02); NOT implemented in this app as of 2026-08-15]`. Natasha's directive (2026-08-15, relayed via the strategy session): combine the old animated Zanshin design into this build — the port is the next code task for this phase. `framer-motion@12` is already installed and currently has zero uses; port with it, pulling durations/easings from the §3.2 tokens (shipped). Note the Void ground was chosen *because* it serves the Euthymia mode — landing it retroactively justifies the palette decision. **Pre-port fix required**: `reorder()` in `App.jsx` has an off-by-one on downward drags (`toIndex` computed pre-removal) — fix before animating the drop, or the motion polishes a wrong landing slot.

- **"Plane of Euthymia" focus mode** — deep focus dims ambient UI toward absolute void; a subtle pulsing electro-glow remains around only the active panel/task. Dim: `--duration-deliberate`, `--ease-standard`.
- **Sword-draw hover glow** — trailing glow on hover/drag of interactive rows; violet only.
- **Mission-clear lightning strike** — crisp one-shot flash on completion; may use `--gold`. The only place gold animates.

**Primitive CSS classes `[SHIPPED 2026-08-15 — src/index.css]`**: the structure-independent primitives exist as plain CSS classes built on the tokens — `.motion-press`, `.glow-draw` (+ `.is-dragging`), `.strike-flash`, `.pulse-live`, `.drop-line` — with a `prefers-reduced-motion` block killing glow/flash/pulse. **Application to `App.jsx` is intentionally pending**: the wireframes session is restructuring the shell from the original artifact (Natasha's directive); classes get wired to the new panel set on its go signal, along with the `reorder()` off-by-one fix. Euthymia (hover-driven per the artifact: dim rail/strip/other panels, focused panel keeps full aubergine + violet border-glow, headline stays bright) is held until the panel set lands.

Baseline patterns (all pull from §3.2 duration/easing tokens — no one-off values):

- **Press** (buttons, rows): down `scale(0.97)` + shadow collapse, `--duration-instant` linear; release `--duration-settle`, `--ease-standard`.
- **Surface** (menus, popovers): open `scale(0.96→1) + translateY(-4px→0) + fade`, `--duration-base`; close reverses at `--duration-fast`, `--ease-out-quick` — closing is always faster than opening.
- **Reveal** (accordions/expanding buckets): `grid-template-rows 0fr→1fr` (never `max-height`), `--duration-deliberate`; content fades ~40ms behind; chevron rotates synced.
- **Drag reorder**: lifted item gets sword-draw glow + slight scale; drop-line indicator in `--color-interactive`; settle on drop at `--duration-settle`.
- **Pulse** (live/in-progress dots): opacity 0.5↔1, 2000ms ease-in-out, infinite. Breathing, not urgent. No scale.
- **No bounce, ever.** Zero-overshoot easing is a brand rule, not a preference.
- `prefers-reduced-motion`: kill Euthymia dimming, glows, lightning, pulse; keep instant state changes.

## 6. Component Specs

- **Panel**: `rounded-xl bg-panel/90 shadow-lg shadow-black/40`, borderless (exception: `WhatMattersNow` may carry `border-brand/20` as the emphasis panel — the only bordered panel). Header in `--font-structural`, `--color-ink-muted`. `[SHIPPED]`
- **Primary button**: filled `--color-interactive`, ink per §3.4 a11y fix, `rounded-lg`, no glow/shadow. Big/key actions only (e.g. Capture). `[SHIPPED, ink fix PROPOSED]`
- **Secondary button**: outline, `--violet-300` border+text, transparent fill, violet hover-glow. `[LOCKED]`
- **Utility button**: icon-based, `--color-ink-muted`, no border until hover (`--row-hover` tint). `[LOCKED]`
- **Project status badge**: `rounded-full`, `{color}/10` tinted bg + matching text, no border — `text-brand bg-brand/10` (started/active) · `amber-400` (in-progress) · `rose-400` (blocked) · `slate-500` (done). `[SHIPPED]`
- **Critical flag**: single optional crimson pill, shown only when true. On panel surfaces use large/bold text or tinted-bg treatment — crimson small text on panel is 4.3:1 (below AA). `[LOCKED, contrast note PROPOSED]`
- **Due-date tag**: static orange text/tag. Never a button, never glows. `[LOCKED — final, Pass 07]`
- **Count pills** (buckets, workspaces): `rounded-full bg-brand/15 text-brand`. `[SHIPPED]`
- **Status pills beyond "Active"**: values needed (In Progress / Testing / Blocked / Done for the pill system) — colors TBC, do not improvise; propose against this doc first. `[OPEN]`
- **Task row**: checkbox + text + optional note; separation `bg-void/40` + 10%-white divider; ≥44px hit area. Urgency badge intentionally unbuilt. `[SHIPPED]`

## 7. Layout & Structure

`[SHIPPED conventions — repo CLAUDE.md]`: mobile-first CSS Grid (4 cols mobile / 8 tablet / 12 desktop); vertical heights bounded with `min-h` + `overflow`; 8pt spacing scale; all touch targets ≥44×44px; semantic HTML (`<button>`, `<nav>`, `<main>`, `<article>`); container borders for dividers, never empty `<div>`s; semantic tokens over arbitrary pixel values in main layout flow.

## 8. Voice & Microcopy

Panel language is part of the design system: Missions, Active Arcs, Open Threads, Codex. Confident, sharp, zero corporate filler ("Sync your productivity journey" is banned). Empty states get dojo framing, one line max. Honest-data rule `[LOCKED]`: mocked panels say so (e.g. Mail count reads a seed and admits it) — never imply a capture/sync happened when it didn't.

## 9. Accessibility — Contrast Audit (computed 2026-08-15, WCAG 2.1)

| Pair | Ratio | Verdict |
|---|---|---|
| brand `#9b7bf0` on void | 6.23 | AA pass (all text sizes) |
| brand on panel | 5.54 | AA pass |
| slate-200 on panel | 14.55 | AAA |
| slate-400 on panel | 7.00 | AAA-normal pass |
| slate-500 on void | 4.24 | large-text/metadata only |
| orange on void | 8.70 | pass |
| gold on void | 14.38 | pass |
| crimson on void | 4.84 | AA-normal pass (borderline — prefer bold) |
| crimson on panel | 4.30 | **below AA normal** — use large/bold or tinted-bg pill |
| **void ink on brand button** | **6.23** | **pass — use this** |
| white ink on brand button | 3.24 | **fails AA — don't use** |
| violet-300 on panel | 9.15 | pass (secondary buttons comfortable) |

Focus: every interactive element shows the `--focus-ring` token; focus is never color-only (ring + existing shape). Keyboard: drag-reorder needs a keyboard path (move up/down) before Zanshin is showcased as a11y-clean. `[OPEN]`

## 10. Hard Rules — Never Do

1. **Never** revert the accent to Neon Orchid `#B14AED` (rejected twice: hybrid resolution + Gemini token-conflict rejection).
2. **Never** give orange an interactive/hover/CTA role (retired three times; Pass 07 is final).
3. **Never** reintroduce the 3-tier priority ramp or Standard/Low badges.
4. **Never** use white text on the brand fill (fails AA — §9).
5. **Never** add borders to panels for separation (tint + elevation only) or draw badges as anything but pills / buttons as anything but rounded rects.
6. **Never** add gamification mechanics (XP/streaks/levels) — evidence-based standing decision.
7. **Never** use bounce/overshoot easing, or `max-height` transitions for reveals.
8. **Never** introduce a new color/shadow/shape token without updating this doc and `Visual-UI-Spec.md` in the same change.
9. **Never** hardcode a raw hex/pixel in components once the semantic layer ships — primitives are referenced only by semantic tokens.

## 11. AI Prompt Knowledge Base

Curated 2026-08-15 (web research, all URLs + star counts verified against the GitHub API that day; ~figures approximate). Selection bias, on purpose: repos with an explicit primitive→semantic→component token layer and a *mechanized* anti-generic-UI stance (checklists, detectors, scores) — matching the positioning: tokenized UI frameworks + AI-accelerated frontend, zero "AI slop."

**Tier 1 — install/use as working skills:**

1. **[educlopez/ui-craft](https://github.com/educlopez/ui-craft)** (~266★, pushed 2026-08-13) — design-engineering system with the *same* 3-layer token spine as §3, motion duration/easing scales, a 43-rule anti-slop detector (CLI + MCP), and a deterministic `UICraftScore` (0–100). Best structural match to this doc; use its reviewer agents to score Zanshin passes instead of vibes. *(fit judgment inferred from README, not test-driven yet)*
2. **[Trystan-SA/claude-design-system-prompt](https://github.com/Trystan-SA/claude-design-system-prompt)** (~1.9k★) — 20-chapter system prompt + 5 review skills incl. an explicit `ai-slop-check` (flags aggressive gradients, emoji decoration, Inter-everywhere) and OKLCH-aware "respect the medium" framing. Use as the critique pass on generated UI.
3. **[rohitg00/awesome-claude-design](https://github.com/rohitg00/awesome-claude-design)** (~988★) — `DESIGN.md` library organized by aesthetic family; the **"Cinematic Dark"** family (RunwayML, ElevenLabs, NVIDIA) is the closest published cousin to Zanshin's void/violet direction. Use its remix recipes + Anti-Slop Kit ("teal accent everywhere," "container soup," "three-column feature grid") as a banned-defaults list.

**Tier 2 — reference corpus & specialized:**

4. **[leonxlnx/taste-skill](https://github.com/leonxlnx/taste-skill)** (~76.7k★, verified — legitimately viral) — portable taste skills with adjustable dials (`DESIGN_VARIANCE`, `MOTION_INTENSITY`, `VISUAL_DENSITY`) and GSAP motion skeletons. Strongest on expressive/cinematic motion; weaker on token-schema rigor. Good for pushing §5's signature interactions further.
5. **[plugin87/ux-ui-agent-skills](https://github.com/plugin87/ux-ui-agent-skills)** (~498★) — DTCG-standard 3-tier tokens across 14 token files, 42+ component specs, WCAG 2.2 validation scripts + CI. The formal-spec end of the spectrum; crib its validation-script pattern for §12 step 5.
6. **[Khalidabdi1/design-ai](https://github.com/Khalidabdi1/design-ai)** (~228★) — 285+ `DESIGN.md` files reverse-engineered from production sites (Stripe, Linear, Netflix…), fixed 9-section schema. Grounding corpus: drop one file in as context to anchor an agent to a specific system.
7. **[microsoft/skills → frontend-design-review](https://github.com/microsoft/skills/blob/main/.github/skills/frontend-design-review/SKILL.md)** (parent ~2.9k★) — concise, authoritative review skill that scores design-token compliance and penalizes generic AI aesthetics. Lightweight PR-review bolt-on.

**How this KB is used**: when generating Zanshin UI with an agent, the prompt stack is (a) this design.md as system context, (b) one Tier-1 generation/taste layer, (c) one critique pass (ui-craft score or `ai-slop-check`) before anything ships. Locally, `.claude/skills/` already carries `design-system-creator`, `frontend-design`, `ui-ux-pro-max`, and `no-ai-slop` — evaluate Tier-1 installs against those before adding overlap.

## 12. Adoption Plan — from 3 tokens to the full architecture

To land this architecture without a big-bang rewrite:

1. ~~**Extend `@theme`** with the OKLCH primary scale~~ **Done 2026-08-15** — `--color-violet-100..1000` in `src/index.css`; `--color-brand` aliases `--color-violet-500`, nothing broke (build verified).
2. ~~**Add semantic aliases**~~ **Done 2026-08-15** — `--color-interactive`, `--color-interactive-quiet`, `--color-due-date`, `--color-critical`, `--color-milestone` shipped. Still open from this step: neutral (`--neutral-*` ← slate) and status (`amber-400`/`rose-400`) aliases.
3. ~~**Fix the button ink**~~ **Done 2026-08-15** — Capture button `text-white` → `text-void`.
4. ~~**Add duration/easing tokens** and refit existing transitions~~ **Done 2026-08-15** — tokens shipped; existing `transition-*` utilities inherit them via the `--default-transition-*` variables. Typography tokens shipped in the same pass (§4). New `[OPEN]` a11y flag for the showcase pass: the app's 10px micro-labels sit below the 12px eyebrow floor (§9 rules) — revisit sizes when the badge/showcase work happens, not silently here.
5. **Migrate `App.jsx` classes** panel-by-panel from raw slate/amber/rose to semantic utilities; `Visual-UI-Spec.md`'s "Legacy Tailwind Colors Still Live" section shrinks as each lands — update it per step (law: no silent drift).
6. Status pills value-set + keyboard reorder are the two `[OPEN]` design decisions — resolve with Natasha before building.

## Related

- `Visual-UI-Spec.md` — shipped truth record (this directory)
- `CLAUDE.md` §UI & Styling, §Code Generation Conventions — working rules this doc absorbs
