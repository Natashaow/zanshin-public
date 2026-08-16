// Vercel serverless function — keeps the Anthropic API key server-side only.
// Reads the same real vault-synced JSON this app's UI reads (src/data/generated/),
// asks Claude to rank what actually matters right now, returns structured JSON.
// The client (WhatMattersNow in App.jsx) calls this and falls back to a hardcoded
// real captured response (WHAT_MATTERS_FALLBACK in vaultApi.js) if this route
// isn't reachable (e.g. local `vite dev` without `vercel dev`) or the call fails.
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))

function loadJSON(relPath) {
  return JSON.parse(readFileSync(join(__dirname, '..', relPath), 'utf-8'))
}

// Illustrative only — not a live Calendar read (same honesty framing as YOUR_DAY_SEED
// in src/data/vaultApi.js). Kept here too so the ranking has a calendar signal to weigh.
const YOUR_DAY_SEED = [
  { title: 'Team sync', time: '10:00 AM' },
  { title: 'Focus block — Dashboard build', time: '1:00 PM' },
  { title: 'Second Brain OS review', time: '4:30 PM' },
]

export default async function handler(req, res) {
  // Must never be cached — the ranking depends on live task data and a live model
  // call. Without this, Vercel's edge caches the first response (including error
  // responses) and every subsequent request/reload sees the same stale result.
  res.setHeader('Cache-Control', 'no-store, max-age=0')

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured on server' })
    return
  }

  let openTasks, northStarFocus
  try {
    openTasks = loadJSON('src/data/generated/openTasks.json')
    northStarFocus = loadJSON('src/data/generated/northStarFocus.json')
  } catch (e) {
    res.status(500).json({ error: 'Failed to load vault data', detail: String(e) })
    return
  }

  const openTaskLines = openTasks
    .filter((t) => !t.done)
    // 60 covers all 51 current open tasks with headroom — the old 30 cap hid 21
    // tasks from the ranking, including every task tied to the #1 North Star focus.
    .slice(0, 60)
    .map((t) => `- [${t.note}] ${t.text}`)
    .join('\n')
  const focusLines = northStarFocus.map((f) => `- ${f.text}`).join('\n')
  const calendarLines = YOUR_DAY_SEED.map((c) => `- ${c.time}: ${c.title}`).join('\n')

  const prompt = `You are an executive-function assistant for someone with ADHD who gets overwhelmed by long unranked lists. Given their real current open tasks, their North Star's stated current focus areas, and today's calendar, pick the 5 items that most matter RIGHT NOW and explain why in one short, direct sentence each. Bias toward: items tied to the current top-ranked focus area, items that unblock other open tasks, and reducing task-switching (grouping related work from the same note together). Give genuine judgment, don't just restate urgency labels.

Current Focus (ranked, first = highest priority):
${focusLines}

Today's Calendar (illustrative — not a live feed, treat as rough shape of the day only):
${calendarLines}

Open Tasks (real, synced from the vault):
${openTaskLines}

Respond with ONLY valid JSON, no markdown fences, no commentary, in this exact shape:
{"items": [{"text": "<short version of the task/item>", "rationale": "<one direct sentence, no hedging>"}]}
Exactly 5 items.`

  try {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-5',
        // Extended thinking defaulted on and ate the entire max_tokens budget —
        // confirmed: response came back with contentBlockTypes ["thinking"] and no
        // text block at all. This task just needs structured JSON output, not shown
        // reasoning, so disable it explicitly rather than trying to out-budget it.
        max_tokens: 1024,
        thinking: { type: 'disabled' },
        messages: [{ role: 'user', content: prompt }],
      }),
    })
    if (!resp.ok) {
      const text = await resp.text()
      res.status(502).json({ error: 'Anthropic API error', detail: text })
      return
    }
    const data = await resp.json()
    // Find the text block explicitly rather than assuming content[0] — a thinking
    // block (or any other block type) can legitimately come first.
    const textBlock = data.content?.find((c) => c.type === 'text')
    const raw = textBlock?.text ?? ''
    let parsed
    try {
      parsed = JSON.parse(raw)
    } catch {
      const match = raw.match(/\{[\s\S]*\}/)
      parsed = match ? JSON.parse(match[0]) : { items: [] }
    }
    if (!parsed.items || !parsed.items.length) {
      // Surface what actually came back instead of silently returning empty —
      // this was exactly the bug that shipped once already (assumed content[0]).
      res.status(502).json({ error: 'No items parsed from model response', rawTextFound: raw.slice(0, 500), contentBlockTypes: data.content?.map((c) => c.type) })
      return
    }
    res.status(200).json({ items: parsed.items, generatedAt: new Date().toISOString(), live: true })
  } catch (e) {
    res.status(500).json({ error: 'Request failed', detail: String(e) })
  }
}
