# Architecture — Second Brain OS / Zanshin Dashboard

**Second Brain OS** is the umbrella/infrastructure name; **Zanshin** is this dashboard's brand skin. Naming locked 2026-08-15. This file describes what is actually built — engineering reality, not intent. For the visual spec, see `Visual-UI-Spec.md`; for the design system, `design.md`.

## What this is

A real, deployed, single-page Vite + React 19 app — not a mock prototype. Core value driver: freely reorderable drag-and-drop task lists, persisted to `localStorage`. No backend beyond one serverless function (`api/what-matters.js`), no router, no state library.

## Stack

- **Vite 8 + React 19.2** (`create-vite` origin — some unused scaffold leftovers remain, see Known Gaps)
- **Tailwind CSS 4.3**, CSS-first `@theme` block in `src/index.css` (no `tailwind.config.js`, no PostCSS config)
- `lucide-react` (icons, used); `framer-motion`, `clsx`, `tailwind-merge` installed but not currently used in `App.jsx`
- No router, no state library, no test runner
- Deploy: Vercel, project linked (`.vercel/project.json`)

## Real file map

| File | Status |
|---|---|
| `src/App.jsx` | Real, shipped — the entire app. No `src/components/` split (deliberate). |
| `src/index.css` | Real — Tailwind v4 `@theme` block, 3 color tokens (void/panel/brand). See `Visual-UI-Spec.md`. |
| `src/data/vaultApi.js` | Real — sole data module. Reads the five fixtures below and shapes them for the UI; a few exports are still honestly-labeled mock (see Known Gaps). |
| `src/data/generated/*.json` | **Synthetic demo fixtures** in this repo — real schema, invented content. Tracked deliberately; see the callout below. |
| `scripts/sync-vault-data.mjs` | **Not shipped in this repo.** In the private source it reads one specific vault's folder layout and writes the five files above. Excluded because it is vault-specific and carries a privacy boundary that only makes sense against that layout. |
| `api/what-matters.js` | Real — Vercel serverless function, live Claude call (see Data Flow). |
| `README.md` | Real — written for this public repo. |
| `src/assets/vite.svg` | Dead — unused create-vite scaffold default. |

**Note on generated-data pattern**: this app's `src/data/generated/*.json` files are committed rather than gitignored. There is no server-side vault access at deploy time, so a deploy ships whatever data was last committed — worth knowing before assuming a live site reflects current vault state.

> [!important] In this public repo, every file in `src/data/generated/` is a **synthetic demo fixture.**
>
> They carry the real schema with invented content — a fictional solo developer shipping a product called Meridian. No real vault data is present in this repository, and the sync script that would produce real data is deliberately not shipped here (see below).
>
> They are tracked rather than gitignored for one reason: `src/data/vaultApi.js` imports them **statically** (`import openTasks from './generated/openTasks.json'`), so a fresh clone with no fixtures cannot build. Tracking them is what makes `git clone && npm install && npm run dev` work with no vault present. This is safe precisely because nothing in this repo can regenerate them from a real vault.
>
> To run it against a real Obsidian vault you supply your own sync step that writes these five files in the documented shapes. That script is intentionally absent — it read one specific private vault's folder layout, so it would be neither useful nor safe to publish.

## Real panel list (as of 2026-08-15)

Rendered by `App.jsx`, 2-column grid (`lg:grid-cols-[1fr_280px]`) — **not** 3-column, and there is no separate Views/Links/Skills-Cheat-Sheet panel (see Known Gaps for why those still exist as data exports).

**Center column**: What Matters Now, Today's Missions, Active Arcs, Workspaces, Life Buckets, Your Day + Mail (paired row).
**Right sidebar**: Captured, Open Threads, Agent Activity, Wrap Up, OM Weekly.

Changed 2026-08-15: `Captured` is new (renders the quick-capture queue, which previously went nowhere); `Inbox` became `Mail` and is now a count rather than a browsable message list. "Agent Activity" was flagged uncommitted in an earlier version of this line — it landed in `72b2299`.

## Data flow

> The vault→JSON half of this section describes how the app runs **against a real Obsidian vault** on the author's machine. In this public repo that first hop is replaced by the synthetic fixtures — the sync script is not shipped. Everything downstream of `src/data/generated/*.json`, including the live Claude call, is exactly what runs here.

**Vault-sourced data**: `02 - Active Projects/` + `brain/North Star.md` + `vault-manifest.json` → a local sync step → `src/data/generated/*.json` → imported by `src/data/vaultApi.js` → consumed as props/state in `App.jsx`. Covers: open tasks (`openTasks.json`), North Star focus/open loops (`northStarFocus.json`), active projects (`activeProjects.json`), workspace counts (`workspaceStats.json`).

**Agent activity**: a vault-level, cross-project event log (`events.jsonl`, appended to by Claude Code lifecycle hooks) → the local sync step folds `agent_status`/`terminal_log` events into `agentActivity.json` → `AGENT_ACTIVITY` export → the Agent Activity panel. This panel is a **read-only display**: approve/reject/kill for those agent runs lives in a separate control-plane app, deliberately not in this dashboard. The log has more than one producer, so the panel treats it as an append-only feed it does not own.

**Live AI ranking**: `api/what-matters.js` (Vercel serverless, server-side `ANTHROPIC_API_KEY`) reads the bundled `openTasks.json`/`northStarFocus.json`, asks Claude (`claude-sonnet-5`, extended thinking explicitly disabled — a documented bug where thinking consumed the token budget and returned no text) to rank top-5 "what matters now," returns structured JSON. Client (`WhatMattersNow` in `App.jsx`) calls this and falls back to a hardcoded, honestly-labeled `WHAT_MATTERS_FALLBACK` (a real once-captured ranking, not lorem text) if the route isn't reachable (e.g. plain `vite dev`) or the call fails.

**Local-only state**: task/loop order and done-state (`useTaskList`) and the quick-capture queue (`useCaptureQueue`, key `sbos-capture-queue`) persist to `localStorage`, rehydrated on mount, falling back to the vault-seeded order / an empty queue if storage is empty, corrupt, or unavailable. Expanded-bucket and expanded-workspace state is plain `useState`, not persisted. The capture queue is browser-local by design and never claims to have written to the vault.

## Known gaps (dated, one line each)

- **2026-08-15** — `VIEWS_SEED`, `LINKS_SEED`, `CURRENT_FOCUS_SEED`, and `SKILL_CHEATSHEET` are exported from `vaultApi.js` (real placeholder/real data) but not imported or rendered anywhere in `App.jsx` — orphaned exports. Flagged, not removed; unclear if they're pending UI or dead.
- **2026-08-15** — No rendered urgency badge (`task.urgency` is stored, never styled). See `Visual-UI-Spec.md`.
- **2026-08-15** — `ACTIVE_PROJECTS` carries no real `lifeBucket`/`dueDate` data yet, so `deriveLifeBuckets()` puts everything in "Uncategorized" and the Active Arcs table's lifeBucket/dueDate cells render empty. Honest gap, not a bug.
- ~~**2026-08-15** — Quick-capture input (header) sets local state that's never read/rendered elsewhere.~~ Closed same day — persisted queue + `Captured` panel.
- ~~**2026-08-15** — Workspaces tiles aren't wired to navigation (no router).~~ Closed same day — tiles expand in place with `obsidian://open` deep links; the router was gate-checked and deliberately declined.
- **2026-08-15** — `EMAILS_TO_HANDLE_SEED` and `YOUR_DAY_SEED` are still fully mocked (not live Gmail/Calendar reads). Now labeled as mocked in the UI itself, not only in code comments — the panels say Calendar/Gmail aren't connected.
- **2026-08-15** — Capture routing is unsolved: a capture cannot reach the vault from the deployed app (no filesystem access). Needs a transport decision before tag syntax is worth designing.

## Related

- `README.md` — what this is and why the AI is load-bearing
- `Visual-UI-Spec.md` — visual/design-token spec
- `design.md` — the Zanshin design system
