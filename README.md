# Zanshin — Second Brain OS

**A local-first personal operating system built on Obsidian, Claude Code, and a systematic token architecture.**

🔗 **No hosted demo right now** — the previous deployment was retired and the URL is dead. Run it locally in two commands: [Running locally](#running-locally).

Built solo. Submitted to BUIDL_QUESTS 2026 under the **OPC / Super Individuals** track.

---

## The problem

I keep everything in an Obsidian vault — projects, decisions, open loops, goals. The vault is good at storing. It is useless at answering the only question I have each morning: *of the fifty-one things open right now, which three should I touch?*

Every tool I tried gave me a list. A list is the problem restated, not solved. Ranking fifty-one items against my own long-term goals is a judgment task, and it's exactly the judgment I'm least able to make at 9am — which is the point where a static dashboard hands the work back to me and calls it a feature.

## What it does

Zanshin reads the vault and ranks it. The **What Matters Now** panel sends the open tasks and the North Star goals to Claude, and gets back a ranked shortlist where each item carries *why it's there* — the reasoning, not just the order.

Here is the top of the offline ranking that ships with the demo fixtures — clone the repo, run it without an API key, and this is exactly what you see:

> **Decide how tax is handled for EU customers before billing can ship**
> *Billing is the only project marked blocked, and every other launch task is downstream of it — this is the one decision holding the release.*
>
> **Reply to the accountant's email about VAT thresholds**
> *The unblock above depends on an answer you have not asked for yet. Small task, but it is the actual critical path.*

Those two sentences are the product. Nothing in the task text says these are related, or that the second one gates the first — that connection has to be reasoned from forty tasks read against the stated goals. It is the join a list view cannot make, and it is what the live call produces against a real vault.

Everything else exists to serve that: today's missions (capped at three on purpose), active projects, workspaces, life buckets, quick capture, calendar/mail context, and an agent-activity feed.

## Why the AI is load-bearing

This is the criterion I'd interrogate hardest if I were judging, so:

- **Ranking is the feature.** Strip the model out and you have a task list — which is what I already had, and why I built this.
- **The reasoning can't be templated.** Each shortlist item explains itself against goals and calendar context that change daily. There's no rule table that produces those sentences.
- **It runs on live data.** `api/what-matters.js` reads the vault-synced JSON at request time and calls Claude server-side. It is not a recorded response replayed for a demo.
- **It degrades honestly.** If the API is unreachable, the UI falls back to a labeled offline ranking over the same data — it never fakes a live result. Panels that *are* mocked (Calendar, Mail) say so on screen.

## Architecture

```
Obsidian vault  ──►  local sync step (not shipped)  ──►  src/data/local/*.json (real)
                                                       │  src/data/generated/*.json (tracked fallback)
                                                       ▼
                                     api/what-matters.js (Vercel function, server-side Claude call)
                                                       ▼
                                     WhatMattersNow  ──►  ranked shortlist
```

`src/App.jsx` is the app. `os/` is the agent layer — hooks that run on the agent runtime's lifecycle events with no human in the loop, shipped as readable evidence rather than something a clone can run. The vault itself never leaves this machine; the sync step drops career, financial and raw-capture material before anything is written, and the one outbound call per request carries only open-task and goal lines to the Anthropic API.

Both docs are the living source of truth and are kept current, not this file — read them for anything more specific than the paragraph above: [`ARCHITECTURE.md`](ARCHITECTURE.md) (layers, data flow, file map) and [`os/README.md`](os/README.md) (the agent layer).

## Running locally

```bash
npm install
npm run dev
```

That works with no vault present and no API key — it builds and runs from the demo fixtures described below.

`npm run dev` alone won't reach the serverless function — use `vercel dev` for that, or watch the labeled fallback. Set `ANTHROPIC_API_KEY` in the environment for live ranking.

### A note on the data you'll see

Every file in `src/data/generated/` is a synthetic fixture in the real schema, built around a fictional solo developer shipping a product called Meridian — and the ranking quoted above is that fixture set, so it's reproducible rather than a screenshot you have to take on trust.

The app I actually run reads my own vault, and none of that data is here.

That split is deliberate. The app reads a private Obsidian vault containing client work, financial and career material, so publishing real synced output would mean publishing that. The sync script that produces the real files is also not shipped, for the same reason — it reads one specific vault's folder layout. To run this against your own vault, write a sync step that emits those five JSON files in the shapes documented in `ARCHITECTURE.md`.

Everything downstream of that boundary — the ranking prompt, the serverless call, the UI — is exactly the code I run daily.

## Honest status

A real app I use, not a demo built for a deadline. Known gaps:

- Calendar and Mail are seeded, not connected to Google — the UI says so rather than implying otherwise.
- Promoting a task from deep in a 51-item list into the top three is impractical by drag alone; the AI ranking is currently the only thing that surfaces buried work.
- No test suite.

## Stack

React 19 · Vite · Tailwind CSS 4 · Vercel Functions · Anthropic Claude API

## Attribution

Sole author: **Natasha Ow**. Licensed [MIT](LICENSE).

Open-source dependencies, all used within their licenses: React 19 and React DOM (MIT), Vite (MIT), Tailwind CSS (MIT), `lucide-react` icons (ISC), `framer-motion` (MIT), `clsx` (MIT), `tailwind-merge` (MIT), ESLint (MIT), and the Schibsted Grotesk and JetBrains Mono variable fonts via `@fontsource` (SIL Open Font License 1.1). Hosting and serverless functions on Vercel. Ranking powered by the Anthropic Claude API.

**Third-party content:** none. No stock imagery, no purchased assets, no scraped data. The demo data in `src/data/generated/` is synthetic and written for this submission.

Built with Claude Code as a development assistant. All product, architecture, and design decisions are my own, recorded as dated decision records in the private working vault this was extracted from.
