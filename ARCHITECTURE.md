# Architecture — Second Brain OS / Zanshin

**Second Brain OS** is the system; **Zanshin** is the dashboard that fronts it. Naming locked 2026-08-15.

This file has two parts, in the order a reader should meet them:

- **Part 1 — the OS.** The four layers that make a markdown vault answer *"what matters right now"* instead of *"what exists"*, where the machine boundary sits, and which file to open to check each claim.
- **Part 2 — the dashboard app.** Stack, real file map, panel list, known gaps. Engineering reality for the code in `src/`.

Everything below describes what is actually built. Where something runs in the private working vault but is not shipped here, it says so on the line.

For the visual spec see `Visual-UI-Spec.md`; for the design system, `design.md`.

---

# Part 1 — The OS

## The system in one view

```
                          ┌───────────────────────────────────────────┐
                          │  LAYER 1 · VAULT  (your disk, markdown)    │
   you write ────────────►│  projects · decisions · open loops         │
                          │  brain/North Star.md  ← stated goals       │
                          └───────────────────────────────────────────┘
                             ▲                              │
        writes checked,      │                              │  read
        misfiles caught      │                              ▼
                          ┌──┴────────────────────────────────────────┐
                          │  LAYER 2 · AGENT LAYER  (no human)         │
                          │  hooks on runtime lifecycle events         │
                          │  → events.jsonl (append-only feed)         │
                          └───────────────────────────────────────────┘
                                                            │
                          ┌─────────────────────────────────▼─────────┐
                          │  LAYER 3 · BOUNDARY  (sync, not shipped)   │
                          │  path prefixes + keyword backstop drop     │
                          │  career / financial / raw-capture material │
                          └─────────────────────────────────┬─────────┘
                                                            ▼
                                          src/data/local/*.json   (gitignored, real)
                                          src/data/generated/*.json (tracked, synthetic)
                                                            │
                          ┌─────────────────────────────────▼─────────┐
                          │  LAYER 4 · JUDGEMENT                       │
                          │  api/what-matters.js ──► Claude ──► ranked │
                          │  shortlist, each item carrying its reason  │
                          └─────────────────────────────────┬─────────┘
                                                            ▼
                                      Zanshin UI  ──►  you drag it into a different order
                                                            │
                                                            └──► persisted. your order wins.
```

Read it as one sentence: **the vault is ground truth, an agent layer keeps it correct without being asked, a boundary decides what may leave it, a model ranks what's left against goals you wrote yourself, and your correction outranks the model.**

## Layer 1 — The vault is ground truth

Not a new silo. Plain markdown the operator already writes daily, on their own disk, readable without this app and outliving it.

Two properties make it usable as a system of record rather than a pile of notes:

- **Goals are written, never inferred.** `brain/North Star.md` § Current Focus is a human-authored priority list. Every ranking downstream is scored against it. The model is never guessing what matters *to you* — that would be the same product as every other tool, wearing a judgement costume.
- **The heading is load-bearing, and that is a documented fragility.** Injection slices from the exact line `## Current Focus`. Rename it and extraction silently falls back to the whole file — stale strategy, no error. That failure ran for weeks undetected, because the failure mode is plausible wrong output rather than a crash. It is written down as a constraint rather than fixed by making the parser cleverer, because a clever parser fails the same way with more steps.

## Layer 2 — The agent layer: what runs without me

This is the layer that answers *"which part of this is autonomous?"* — and it is deliberately the narrowest possible claim: **work that used to depend on the operator remembering, now firing on the runtime's own lifecycle events.**

Verified against `.claude/settings.json` in the working vault, **as of 2026-08-17**:

| | Count |
|---|---|
| Hook scripts present in `.claude/scripts/` | 14 |
| Of those, wired to fire | **9** |
| Wirings (a script bound to an event) | **13** |
| Distinct lifecycle events covered | **10** |
| Named subagents defined in `.claude/agents/` | 10 |

Four behaviours observed firing inside a single ordinary session, none of them requested:

1. Current priority injected into context at session start.
2. An incoming message classified and routed with a hint.
3. A note flagged on crossing the size threshold that means it should split.
4. **A session blocked from ending because its work had not been logged yet.**

The fourth is the sharpest one, and the reason this is a system rather than a set of conveniences: it refuses to let its own operator skip the step that keeps it correct. Autonomy that only ever helps is indistinguishable from a shortcut; autonomy that can say *no, not yet* is a control.

### The topology: supervisor, with a deterministic router

Ten named subagents are defined in the working vault's `.claude/agents/`. The shape they form is the standard **orchestrator–worker (supervisor)** pattern, and one configuration fact pins it there: **not one of the ten is granted an agent-spawning tool.** Their grants are `Read`, `Grep`, `Glob`, `Bash`, `Write`, `Edit` and a few MCP surfaces — none can launch another agent.

So the graph is two levels deep and cannot become three. A worker returns to the session that called it; there is no worker-to-worker edge, no recursion, and no depth limit to tune, because depth is bounded by the capability grant rather than by a counter. Per-agent grants are in [`os/agents-manifest.md`](os/agents-manifest.md), which publishes eight of the ten by name and states plainly why the other two are withheld — they operate on career and performance material, which is the category Layer 3 drops. The no-agent-tool property was checked across all ten.

That bounds how many agents can exist, not what any one of them may do. The second bound — which calls require a human, which are refused outright, and which rules are enforced by configuration versus honoured by convention — is in [`os/safety-envelope.md`](os/safety-envelope.md), added 2026-08-17. It is deliberately explicit about the gaps: three of the five operator-facing safety rules are convention only, and the file says so.

The rest of the multi-agent surface, named against the pattern it corresponds to:

| Pattern | Where it is here | Held in place by |
|---|---|---|
| **Orchestrator–worker** | one session dispatches to 10 named agents, each returning to it | tool grants — no agent tool on any worker |
| **Handoff / peer network** | `SendMessage` between concurrent sessions sharing one working tree — the only lateral edge | convention, and it has failed |
| **Evaluator–optimizer** | run → operator feedback → an imperative rule carrying the verbatim quote, read by the next run | procedure; the human half is skippable |
| **Guardrail** | `Stop` refuses to end an unlogged session; `PreToolUse` interrupts destructive shared-state git | deterministic hooks, no model in the path |
| **Blackboard** | `events.jsonl`, append-only, two independent consumers | file format |

**What is deliberately absent, because the absences are the design.** There is no LLM router: dispatch is a literal enumerated matcher in `settings.json` naming all ten agents, so an agent not on that list is simply not logged rather than being handled by a model's guess. There is no cyclic graph, no agent-to-agent negotiation, and no scratchpad the workers write to concurrently. A graph framework — LangGraph and its class — buys conditional routing and cycles. Neither is a live constraint at ten workers and one router, and adopting one would put a Python runtime and a build step under a hook layer that deliberately has neither. The trigger for revisiting is written down rather than left to taste: **a worker that needs to hand off to another worker without returning first, or a route that cannot be expressed as an enumerated matcher.** Until one of those appears, a graph engine would be answering a question this system is not asking.

The honest cost of that choice sits on the lateral edge. `SendMessage` is the one place where coordination is convention rather than capability, and it is where this system's documented failures cluster: contradictory confirmations on a shared directory move, a staging race, and a misdirected stop relay, all inside one afternoon. A supervisor topology with a deterministic router is not the sophisticated answer — it is the one whose failure modes are already understood.

### What ships here, and what doesn't

`os/hooks/` contains **4 of the 9 wired hooks**, plus one operator-invoked maintenance script, plus the 14 shared modules they import — lifted unchanged from the working vault, comments and all.

**Nothing in `os/` executes from a clone.** `settings.json` is not shipped, so this is readable evidence, not an install. The two richest hooks (`session-start.ts`, 553 lines, and `stop-checklist.ts`) are the most vault-specific, and sanitising them against a deadline is how a privacy leak happens — so they stayed out. Full per-file accounting and the reasoning: [`os/README.md`](os/README.md).

The ratio is stated rather than smoothed over because a reader can count the files. Four is what could be published honestly; nine is what runs.

### The feed has more than one consumer

`os/hooks/log-agent-activity.ts` appends agent launches and completions to a shared `events.jsonl`, which the dashboard's Agent Activity panel renders read-only. Its comments name **Apex Logic** — a separate control-plane app in the same vault that consumes the same feed and owns approve/reject/kill for agent runs. That is why this panel displays and never controls: the log is an append-only feed this dashboard does not own. Apex Logic is a sibling subsystem of the same OS, not a second product.

Read that hook's header comment if you read only one file in `os/`. It documents an **undocumented** runtime API being mapped by dumping raw stdin, two captures on the same afternoon that disagreed about the payload shape, and the resulting decision to correlate by `agent_id` and **fail closed**. The bug that forced it is in the file: *46 unique completed agent ids against 5 launched in one afternoon.* That reasoning is left in the code on purpose — it is the honest record of building on an unstable surface.

## Layer 3 — The boundary: what may leave the vault

The vault holds client work, financial, career and performance material. The dashboard needs open tasks and goals. The boundary is the layer that separates those, and it is drawn **at whole files, not at lines** — so sanitising is a file swap rather than a judgement call made under time pressure.

| Path | Git | Content |
|---|---|---|
| `src/data/generated/*.json` | tracked | **always** synthetic fixtures |
| `src/data/seeds.js` | tracked | **always** synthetic hand-authored content |
| `src/data/local/*` | **gitignored** | real vault data, when present |
| `scripts/sync-vault-data.mjs` | **gitignored** | the vault→JSON sync; vault-path-specific, so not shipped |

The sync step enforces the boundary in code: path prefixes plus a keyword backstop drop career, compensation, performance and raw-capture material before anything is written. It is excluded from this repo because it reads one specific vault's folder layout — which is also exactly what makes that boundary meaningful rather than decorative.

**This is a structural property, not a rule anyone has to remember.** `vaultApi.js` resolves `local/` with `import.meta.glob`, which yields an empty object when the directory is absent, and `api/what-matters.js` resolves the same way with an `existsSync` check. So one codebase runs in both states:

- **Fresh clone** — no `local/`, no sync script. Builds and runs immediately on the synthetic fixtures. `npm install && npm run dev`.
- **Author's machine** — `local/` present, populated from a real Obsidian vault. Same UI, same code path, real content, none of it able to reach git.

`USING_LOCAL_DATA` is exported so the UI can say which state it is in. A demo must never be mistaken for live state.

**Why it is built this way, since the reasoning is the interesting part.** The previous arrangement was two repos: a private daily driver and a sanitised public copy, reconciled by hand. It failed twice. The copies drifted in *both directions at once* — the public one fell 88 lines behind on `App.jsx` while a privacy fix made there was missing from the original. Separately, the private build was deployed to a URL that served real vault content unauthenticated, while the host's dashboard reported protection as enabled.

A `.gitignore` alone could not have prevented either, because `src/data/generated/` **must** be tracked — `vaultApi.js` imports it statically, so a clone with no fixtures cannot build. The fix was to stop asking one path to be both things: split *the path that must be tracked* from *the path that holds real data*, and ignoring the second becomes safe. One repo, one `.gitignore`, no sync step between copies, and no judgement call left to get wrong under time pressure.

## Layer 4 — Judgement: rank, show the reasoning, be overruled

`api/what-matters.js` is a Vercel serverless function holding the Anthropic key server-side. It reads the resolved open tasks and North Star focus, and asks Claude for the five items that most matter right now — **each with a one-sentence reason**. `no-store`, so a ranking is never edge-cached. A per-instance rate limiter is a speed bump on key-farming, documented in the file as explicitly *not* a spend cap.

Three properties are what make this a judgement step rather than a sort:

- **It cannot be templated.** The shipped fixture ranking surfaces an unanswered email as the actual critical path, because the blocked billing project depends on an answer nobody has asked for yet. Nothing in either task's text says they are related. That join has to be reasoned from forty tasks read against stated goals — a rules engine can tell you what is *late*, never what is *load-bearing*.
- **Remove the model and there is no product**, rather than a degraded one. What remains is a list, and lists already exist. That is the whole reason this was built.
- **It degrades honestly.** If the route is unreachable (plain `vite dev`, no key, API error), the UI falls back to a labeled offline ranking over the same data — a real once-captured response, never lorem, never a live result faked. Panels that *are* mocked — Calendar, Mail — say so on screen, not only in a code comment.

**Then the human overrules it.** Drag-to-reorder persists to `localStorage` and rehydrates on mount. The operator's correction outranks the model's ranking, permanently and without argument. The model proposes, the operator disposes, and the disagreement is preserved rather than resolved.

## The loop that closes

Autonomy is only trustworthy if correction survives it. Three places where it does:

1. **Ranking → drag → persisted order.** In code, in `App.jsx`. The model does not get to re-litigate it on next load.
2. **Agent run → operator feedback → an imperative rule with the verbatim quote and date**, read by the next run. Feedback becomes a rule rather than a memory.
3. **Decision → logged at the time with the assumption that made it right, and a "revisit if" that would overturn it.** A decision without its assumption is just history.

Where this has failed is stated rather than hidden: the human half of the feedback loop is skippable, and it has been skipped — 2 of 11 runs rated in the retired version. The fix in place is procedural (capture the answer in the same turn it is given, never ask the operator to fill anything in later) and a regression set whose correct answers are written down *before* the agent sees them, so a change can be measured instead of guessed at. Those live in the private vault; what is verifiable here is the code half.

## What crosses the machine boundary

The one honest answer to *"is this actually local-first?"*:

| Data | Leaves the machine? | To whom |
|---|---|---|
| The vault itself (markdown, all of it) | **No.** Never uploaded, synced, or indexed off-disk | — |
| Career / compensation / performance / raw-capture notes | **No.** Dropped at Layer 3 before any file is written | — |
| Open task lines + North Star focus lines | **Yes**, in the prompt, per request | Anthropic API |
| The model's ranking + reasoning | returned, rendered, not stored server-side | — |
| Your reordering, done-state, capture queue | **No.** `localStorage`, browser-local | — |
| `src/data/local/*` | **No.** Gitignored, so a git-based deploy cannot carry it | — |

So: **one outbound call, carrying task text and goals, storing nothing.** Everything else stays on the disk. A deployed instance built from this repo can only ever rank the synthetic fixtures, because the real data is structurally unable to reach it.

That is the sovereignty claim, stated at its true size. It is not "no data ever leaves" — it is *the vault stays yours, and exactly one narrow payload is sent, on request, to do the one thing that needs a model.*

## Verify it yourself

Every claim in Part 1 maps to a file in this repository:

| Claim | Open |
|---|---|
| The ranking is a live model call, not a replayed response | `api/what-matters.js` |
| Real data and demo data resolve through the same code path | `src/data/vaultApi.js` (`import.meta.glob`, `USING_LOCAL_DATA`), `api/what-matters.js` (`loadJSON`) |
| The human override outranks the model, and persists | `useTaskList` / `useDragReorder` in `src/App.jsx` |
| An agent layer runs on lifecycle events with no human | `os/hooks/`, and `os/README.md` for what is and isn't wired |
| The agent graph is two levels deep and cannot recurse | `os/agents-manifest.md` — no worker holds an agent-spawning tool |
| Outbound and irreversible actions are gated, not just discouraged | `os/safety-envelope.md` — the `deny`/`ask` model, with every rule tagged by the tier that enforces it, and an explicit list of what is *not* enforced |
| The dashboard's agent feed has a producer in this repo | `os/hooks/log-agent-activity.ts` → `src/data/generated/agentActivity.json` |
| Building on an unstable API was documented, not smoothed over | header comment of `os/hooks/log-agent-activity.ts` |
| The privacy boundary is structural | `.gitignore`, and the absence of `scripts/sync-vault-data.mjs` |
| Mocked panels admit they are mocked | Calendar and Mail panels in `src/App.jsx` |
| Gaps are tracked rather than quietly dropped | Known gaps, below |

What cannot be verified here, stated so it isn't discovered as an omission: the 5 unshipped hooks, `settings.json` (which holds the router matcher), the agent definition bodies, the sync script, the vault itself, and the agent feedback loop's Log/Preferences notes are all private. The reasons are in [`os/README.md`](os/README.md) and Layer 3.

---

# Part 2 — The dashboard app

## What this is

A real, deployed, single-page Vite + React 19 app — not a mock prototype. Core value driver: freely reorderable drag-and-drop task lists, persisted to `localStorage`. No backend beyond one serverless function (`api/what-matters.js`), no state library, and a dependency-free hash router (added 2026-08-19 — see the tab section below).

## Stack

- **Vite 8 + React 19.2** (`create-vite` origin — some unused scaffold leftovers remain, see Known Gaps)
- **Tailwind CSS 4.3**, CSS-first `@theme` block in `src/index.css` (no `tailwind.config.js`, no PostCSS config)
- `lucide-react` (icons, used); `framer-motion`, `clsx`, `tailwind-merge` installed but not currently used in `App.jsx`
- No router dependency (a ~30-line hash router in `App.jsx` — `useHashRoute`), no state library, no test runner
- Deploy: Vercel (the serverless function in `api/` needs a Vercel-style host or `vercel dev`)

## Real file map

| File | Status |
|---|---|
| `src/App.jsx` | Real, shipped — the entire app. No `src/components/` split (deliberate). |
| `src/index.css` | Real — Tailwind v4 `@theme` block, 3 color tokens (void/panel/brand). See `Visual-UI-Spec.md`. |
| `src/data/vaultApi.js` | Real — sole data module. Prefers `src/data/local/` at runtime, falls back to the tracked fixtures. |
| `src/data/seeds.js` | **Synthetic, tracked** — hand-authored seed content (mock mail, calendar, links, the offline ranking). Real schema, invented content. |
| `src/data/generated/*.json` | **Synthetic demo fixtures, tracked** — real schema, invented content. |
| `src/data/local/` | **Gitignored, optional** — real vault data when running against a real vault. Never in git. |
| `scripts/sync-vault-data.mjs` | **Not shipped in this repo.** In the private source it reads one specific vault's folder layout and writes the five files above. Excluded because it is vault-specific and carries a privacy boundary that only makes sense against that layout. |
| `api/what-matters.js` | Real — Vercel serverless function, live Claude call (see Data flow). |
| `README.md` | Real — written for this public repo. |
| `os/hooks/*.ts` | **Real, lifted unchanged from the working vault** — see Layer 2. Not wired from a clone. |
| `src/assets/vite.svg` | Dead — unused create-vite scaffold default. |

**Note on the generated-data pattern**: `src/data/generated/*.json` is committed rather than gitignored, because `vaultApi.js` imports it **statically** (`import openTasks from './generated/openTasks.json'`) — a fresh clone with no fixtures cannot build. Tracking them is what makes `git clone && npm install && npm run dev` work with no vault present, and it is safe precisely because nothing in this repo can regenerate them from a real vault. A consequence worth knowing: there is no server-side vault access at deploy time, so a deploy ships whatever data was last committed.

> [!important] In this public repo, every file in `src/data/generated/` and all of `src/data/seeds.js` is a **synthetic demo fixture** — real schema, invented content, a fictional solo developer shipping a product called Meridian. No real vault data is present in this repository.

To run it against a real Obsidian vault you supply your own sync step that writes those five files in the documented shapes. That script is intentionally absent — see Layer 3.

## Real panel list (as of 2026-08-19)

Three hash-routed tabs (`useHashRoute` in `App.jsx`, no dependency). The 2026-08-15 router decline was reversed 2026-08-19 (vault Decision Log): the post-freeze North Star names "no tab router" the first daily-driver gap. The no-empty-router guardrail survives as an admission rule — a view earns a route only when it has real content, so the reconciliation IA's remaining tabs (Taste, Ideas, Finance, Learn) wait on data. Header (hero, quick capture, stats, mobile tab pills) is global to all tabs.

- **Dashboard** (`#/`), 2-column grid (`lg:grid-cols-[1fr_280px]`) — center: What Matters Now, Today's Missions, Active Arcs, Workspaces, Life Buckets, Your Day + Mail (paired row); sidebar: Captured, Open Threads.
- **Agents** (`#/agents`) — Agent Activity, still read-only display.
- **Review** (`#/review`) — Wrap Up, OM Weekly.

Changed 2026-08-15: `Captured` is new (renders the quick-capture queue, which previously went nowhere); `Inbox` became `Mail` and is now a count rather than a browsable message list. "Agent Activity" was flagged uncommitted in an earlier version of this line — it landed in `72b2299`.

## Data flow

> Layer 1–4 above is the system-level version of this. What follows is the app-level detail.

**Vault-sourced data**: `02 - Active Projects/` + `brain/North Star.md` + `vault-manifest.json` → the local sync step → `src/data/local/*.json` → resolved by `src/data/vaultApi.js` (falling back to `src/data/generated/*.json`) → consumed as props/state in `App.jsx`. Covers open tasks (`openTasks.json`), North Star focus/open loops (`northStarFocus.json`), active projects (`activeProjects.json`), workspace counts (`workspaceStats.json`).

**Agent activity**: a vault-level, cross-project event log (`events.jsonl`, appended to by lifecycle hooks) → the sync step folds `agent_status`/`terminal_log` events into `agentActivity.json` → `AGENT_ACTIVITY` export → the Agent Activity panel. Read-only display by design; see Layer 2.

**Live AI ranking**: `api/what-matters.js` (Vercel serverless, server-side `ANTHROPIC_API_KEY`) resolves `openTasks.json`/`northStarFocus.json` the same way the UI does — `src/data/local/` when present, tracked fixtures otherwise — and asks Claude (`claude-sonnet-5`, extended thinking explicitly disabled: a documented bug where thinking consumed the whole token budget and returned no text block) to rank the top five. `WhatMattersNow` in `App.jsx` calls it and falls back to the labeled `WHAT_MATTERS_FALLBACK` if it isn't reachable or the call fails.

**Local-only state + capture writeback**: task/loop order and done-state (`useTaskList`) and the quick-capture queue (`useCaptureQueue`, key `sbos-capture-queue`) persist to `localStorage`, rehydrated on mount, falling back to the vault-seeded order / an empty queue if storage is empty, corrupt, or unavailable. Expanded-bucket and expanded-workspace state is plain `useState`, not persisted. On `vite dev`, `vite.config.js` also exposes `POST /api/capture`, a dev-only thin filesystem adapter that writes captures into the vault's `04 - Thinking/` folder and only shows `filed` after a confirmed 200. On static deploys or failed requests, the browser-local queue remains the whole story.

## Known gaps (dated, one line each)

- **2026-08-17** — `api/what-matters.js` previously read only `src/data/generated/`, so on the author's machine the UI listed real tasks while the ranking panel ranked the fictional fixture backlog. Fixed the same day by resolving `local/` first, matching `vaultApi.js`.
- **2026-08-15** — `VIEWS_SEED`, `LINKS_SEED`, `CURRENT_FOCUS_SEED`, and `SKILL_CHEATSHEET` are exported from `vaultApi.js` but not imported or rendered anywhere in `App.jsx` — orphaned exports. Flagged, not removed; unclear if they're pending UI or dead.
- **2026-08-15** — No rendered urgency badge (`task.urgency` is stored, never styled). See `Visual-UI-Spec.md`.
- **2026-08-15** — `ACTIVE_PROJECTS` carries no real `lifeBucket`/`dueDate` data yet, so `deriveLifeBuckets()` puts everything in "Uncategorized" and the Active Arcs table's lifeBucket/dueDate cells render empty. Honest gap, not a bug.
- **2026-08-15** — `EMAILS_TO_HANDLE_SEED` and `YOUR_DAY_SEED` are still fully mocked (not live Gmail/Calendar reads). Labeled as mocked in the UI itself, not only in code comments.
- ~~**2026-08-15** — Capture routing is unsolved: a capture cannot reach the vault from the deployed app (no filesystem access).~~ Partially closed 2026-08-17 — local `vite dev` now has a dev-only `POST /api/capture` filesystem adapter that writes dated inbox notes into `04 - Thinking/`; static deploys still cannot write to the vault and correctly fall back to `localStorage`.
- ~~**2026-08-15** — Quick-capture input sets local state that's never read elsewhere.~~ Closed same day — persisted queue + `Captured` panel.
- ~~**2026-08-15** — Workspaces tiles aren't wired to navigation (no router).~~ Closed same day — tiles expand in place with `obsidian://open` deep links; the router was gate-checked and deliberately declined. **The decline itself was reversed 2026-08-19** (North Star post-freeze re-rank named it the first daily-driver gap): a three-tab hash router now exists, content-gated per the guardrail.

## Related

- `README.md` — what this is and why the AI is load-bearing
- `os/README.md` — the agent layer, per file
- `Visual-UI-Spec.md` — visual/design-token spec
- `design.md` — the Zanshin design system
