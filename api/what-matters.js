// Vercel serverless function — keeps the Anthropic API key server-side only.
// Reads the same JSON this app's UI reads, resolved the same way (local/ first,
// tracked fixtures otherwise — see loadJSON), asks Claude to rank what actually
// matters right now, returns structured JSON.
//
// What this means for the privacy boundary, stated plainly because this is the
// one outbound call in the system: the vault itself never leaves the disk, but
// the task lines and North Star focus lines resolved above are sent to the
// Anthropic API in the prompt below on each request. Nothing is stored there and
// no copy of the vault exists off-machine. src/data/local/ is gitignored, so a
// git-based deploy never carries it — a deployed instance can only ever rank the
// synthetic fixtures.
// The client (WhatMattersNow in App.jsx) calls this and falls back to a hardcoded
// real captured response (WHAT_MATTERS_FALLBACK in vaultApi.js) if this route
// isn't reachable (e.g. local `vite dev` without `vercel dev`) or the call fails.
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Resolve data the same way the UI does (see src/data/vaultApi.js): prefer the
// gitignored src/data/local/ when it exists, fall back to the tracked synthetic
// fixtures. Without this the two halves disagreed — the UI listed real vault
// tasks while this route ranked the fictional Meridian backlog, so the panel's
// rationales referred to work that wasn't on screen. A fresh clone has no
// local/ and is unaffected: it ranks the fixtures, which is what makes the
// README's quoted ranking reproducible.
function loadJSON(name) {
  const local = join(__dirname, '..', 'src/data/local', name)
  const fixture = join(__dirname, '..', 'src/data/generated', name)
  return JSON.parse(readFileSync(existsSync(local) ? local : fixture, 'utf-8'))
}

// Illustrative only — not a live Calendar read (same honesty framing as YOUR_DAY_SEED
// in src/data/vaultApi.js). Kept here too so the ranking has a calendar signal to weigh.
const YOUR_DAY_SEED = [
  { title: 'Team sync', time: '10:00 AM' },
  { title: 'Focus block — Dashboard build', time: '1:00 PM' },
  { title: 'Second Brain OS review', time: '4:30 PM' },
]

// Abuse guard. This route spends a real Anthropic key on every call and requires no
// credential, so once this repo is public the route is public knowledge — anyone can
// read it here and bill the key by looping requests. The limiter is per warm instance,
// not global (serverless gives no shared memory without a store), so treat it as a
// speed bump that makes casual farming pointless, NOT as a hard spend cap. If this is
// ever deployed on a real domain, put a proper store or Vercel's firewall in front.
const RATE_LIMIT_WINDOW_MS = 60_000
const RATE_LIMIT_MAX = 10
const hits = new Map()

function rateLimited(req) {
  const ip =
    (req.headers['x-forwarded-for'] || '').split(',')[0].trim() ||
    req.socket?.remoteAddress ||
    'unknown'
  const now = Date.now()
  const recent = (hits.get(ip) || []).filter((t) => now - t < RATE_LIMIT_WINDOW_MS)
  recent.push(now)
  hits.set(ip, recent)
  // Bound the map so a spray of distinct IPs can't grow it without limit.
  if (hits.size > 5000) hits.clear()
  return recent.length > RATE_LIMIT_MAX
}

export default async function handler(req, res) {
  // Must never be cached — the ranking depends on live task data and a live model
  // call. Without this, Vercel's edge caches the first response (including error
  // responses) and every subsequent request/reload sees the same stale result.
  res.setHeader('Cache-Control', 'no-store, max-age=0')

  // The client only ever GETs this. Anything else is not a real caller.
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET, HEAD')
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  if (rateLimited(req)) {
    res.setHeader('Retry-After', String(RATE_LIMIT_WINDOW_MS / 1000))
    res.status(429).json({ error: 'Rate limit exceeded — try again shortly' })
    return
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured on server' })
    return
  }

  let openTasks, northStarFocus
  try {
    openTasks = loadJSON('openTasks.json')
    northStarFocus = loadJSON('northStarFocus.json')
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
