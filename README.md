# Zanshin — Second Brain OS

**A daily-driver dashboard for a personal knowledge vault, where an LLM decides what actually matters right now.**

🔗 **Live:** https://second-brain-preview.vercel.app

Built solo. Submitted to BUIDL_QUESTS 2026 under the **OPC / Super Individuals** track.

---

## The problem

I keep everything in an Obsidian vault — projects, decisions, open loops, goals. The vault is good at storing. It is useless at answering the only question I have each morning: *of the fifty-one things open right now, which three should I touch?*

Every tool I tried gave me a list. A list is the problem restated, not solved. Ranking fifty-one items against my own long-term goals is a judgment task, and it's exactly the judgment I'm least able to make at 9am — which is the point where a static dashboard hands the work back to me and calls it a feature.

## What it does

Zanshin reads the vault and ranks it. The **What Matters Now** panel sends my real open tasks and my real North Star goals to Claude, and gets back a ranked shortlist where each item carries *why it's there* — the reasoning, not just the order:

> **Rebuild Reel You Product Strategy section as fixed-hero + tab-selector**
> *This is Portfolio & Design Integration's core open loop and your 1PM focus block is literally a build session, so do this now.*

That sentence is the product. It connects a task to a goal to a slot in my actual day — three sources a list view cannot join.

Everything else exists to serve that: today's missions (capped at three on purpose), active projects, workspaces, life buckets, a quick-capture queue, and an agent-activity feed.

## Why the AI is load-bearing

This is the criterion I'd interrogate hardest if I were judging, so:

- **Ranking is the feature.** Strip the model out and you have a task list — which is what I already had, and why I built this.
- **The reasoning can't be templated.** Each shortlist item explains itself against goals and calendar context that change daily. There's no rule table that produces those sentences.
- **It runs on live data.** `api/what-matters.js` reads the vault-synced JSON at request time and calls Claude server-side. It is not a recorded response replayed for a demo.
- **It degrades honestly.** If the API is unreachable, the UI falls back to a labeled offline ranking over the same data — it never fakes a live result. Panels that *are* mocked (Calendar, Mail) say so on screen.

## Architecture

```
Obsidian vault  ──►  local sync step (not shipped — see below)  ──►  src/data/generated/*.json
                                                                │
                                                                ▼
                                              api/what-matters.js (Vercel function)
                                                    │  server-side Claude call
                                                    ▼
                                              WhatMattersNow  ──►  ranked shortlist
```

- **The sync step** (*not shipped in this repo*) — pulls open tasks, goals, projects, and workspace stats out of the local vault. Enforces a **privacy boundary**: career, compensation, performance and raw-capture material never cross into the generated payload, via path prefixes plus a keyword backstop. It is excluded here because it reads one specific vault's folder layout, which is also what makes that boundary meaningful.
- `api/what-matters.js` — Vercel serverless function. Keeps the API key server-side; `no-store` so a ranking is never edge-cached.
- `src/App.jsx` — the app. Drag-to-reorder and the capture queue persist to `localStorage`.

Full detail: [`ARCHITECTURE.md`](ARCHITECTURE.md).

## Running locally

```bash
npm install
npm run dev
```

That works with no vault present and no API key — it builds and runs from the demo fixtures described below.

`npm run dev` alone won't reach the serverless function — use `vercel dev` for that, or watch the labeled fallback. Set `ANTHROPIC_API_KEY` in the environment for live ranking.

### A note on the data you'll see

The quoted ranking above is **real output over my own vault**. What ships in this repo is **not** — every file in `src/data/generated/` is a synthetic fixture in the real schema, built around a fictional solo developer shipping a product called Meridian, and the offline fallback ranking matches it.

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

Open-source dependencies, used under their respective licenses: React, React DOM, Vite, Tailwind CSS, ESLint, PostCSS, Autoprefixer. Hosted on Vercel. Ranking powered by the Anthropic Claude API.

Built with Claude Code as a development assistant. All product, architecture, and design decisions are my own, recorded as dated decision records in the private working vault this was extracted from.
