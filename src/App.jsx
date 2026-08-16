import { useEffect, useState } from 'react'
import { Bot, CalendarClock, ChevronDown, ChevronRight, GripVertical, Inbox, Mail, Sparkles, Zap } from 'lucide-react'
import {
  ACTIVE_PROJECTS,
  AGENT_ACTIVITY,
  CAPTURE_INBOX,
  deriveCaptureDestinations,
  deriveLifeBuckets,
  EMAILS_TO_HANDLE_SEED,
  INITIAL_OPEN_LOOPS,
  OPEN_TASKS_SEED,
  WEEKLY_HIGHLIGHTS,
  VAULT_NAME,
  WHAT_MATTERS_FALLBACK,
  WORKSPACES_SEED,
  YOUR_DAY_SEED,
} from './data/vaultApi'

const PROJECT_STATUS_STYLES = {
  active: 'text-brand bg-brand/10',
  started: 'text-brand bg-brand/10',
  'in-progress': 'text-amber-400 bg-amber-400/10',
  blocked: 'text-rose-400 bg-rose-400/10',
  done: 'text-slate-500 bg-slate-500/10',
}

function Panel({ title, icon: Icon, children, className = '', id }) {
  return (
    <section
      id={id}
      className={`rounded-xl bg-panel/90 p-5 shadow-lg shadow-black/40 transition-shadow ${className}`}
    >
      {title && (
        <header className="mb-3 flex items-center gap-2">
          {Icon && <Icon className="h-4 w-4 text-brand" aria-hidden="true" />}
          <h2 className="font-structural text-sm font-medium tracking-wide text-slate-200">{title}</h2>
        </header>
      )}
      {children}
    </section>
  )
}

function ProjectStatusBadge({ status }) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 font-structural text-[10px] font-semibold uppercase tracking-wider ${PROJECT_STATUS_STYLES[status]}`}
    >
      {status}
    </span>
  )
}

// Native HTML5 drag-and-drop with a drop-line indicator — the core value driver
// (freely reorderable task lists, per CLAUDE.md's "outranks remaining visual-system
// decisions" call). Shared by TaskTable and OpenThreadsList below.
function useDragReorder(reorder) {
  const [draggingId, setDraggingId] = useState(null)
  const [dragOverId, setDragOverId] = useState(null)

  const dragHandlers = (id) => ({
    draggable: true,
    onDragStart: (e) => {
      setDraggingId(id)
      e.dataTransfer.effectAllowed = 'move'
    },
    onDragEnter: (e) => {
      e.preventDefault()
      if (id !== draggingId) setDragOverId(id)
    },
    onDragOver: (e) => e.preventDefault(),
    onDrop: (e) => {
      e.preventDefault()
      if (draggingId && draggingId !== id) reorder(draggingId, id)
      setDraggingId(null)
      setDragOverId(null)
    },
    onDragEnd: () => {
      setDraggingId(null)
      setDragOverId(null)
    },
  })

  return { dragHandlers, draggingId, dragOverId }
}

function TaskTable({ tasks, onToggle, onReorder }) {
  const { dragHandlers, draggingId, dragOverId } = useDragReorder(onReorder)
  return (
    <table className="w-full table-fixed border-collapse">
      <tbody>
        {tasks.map((task) => (
          <tr
            key={task.id}
            {...dragHandlers(task.id)}
            className={`transition-colors hover:bg-white/5 ${draggingId === task.id ? 'opacity-40' : ''} ${
              dragOverId === task.id ? 'border-t-2 border-brand' : ''
            }`}
          >
            <td className="w-6 py-1.5 pl-1 align-middle cursor-grab text-slate-600" aria-hidden="true">
              <GripVertical className="h-3.5 w-3.5" />
            </td>
            <td className="w-6 py-1.5 pl-1 align-middle">
              <input
                type="checkbox"
                checked={task.done}
                onChange={() => onToggle(task.id)}
                className="h-4 w-4 rounded border-brand/40 accent-brand focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/50"
                aria-label={`Mark "${task.text}" as ${task.done ? 'incomplete' : 'complete'}`}
              />
            </td>
            <td className="w-full py-1.5 pr-2 align-middle">
              <div className="flex items-center gap-1.5">
                <p className={`min-w-0 flex-1 truncate text-sm ${task.done ? 'text-slate-500 line-through' : 'text-slate-200'}`}>
                  {task.text}
                </p>
                {/* Urgency axis, per Visual-UI-Spec "Task Urgency Badges": high renders the
                    single Critical flag, medium/low render nothing (ramp retired). Static. */}
                {task.urgency === 'high' && !task.done && (
                  <span className="shrink-0 rounded-full bg-critical/10 px-2 py-0.5 font-structural text-[11px] font-semibold uppercase tracking-structural text-critical">
                    Critical
                  </span>
                )}
                {task.dueDate && !task.done && (
                  <span className="shrink-0 rounded-full bg-due-date/10 px-2 py-0.5 font-structural text-[11px] tracking-structural text-due-date">
                    {task.dueDate}
                  </span>
                )}
              </div>
              {task.note && (
                <p className="truncate text-[11px] text-slate-500">{task.note}</p>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

// Decision-fatigue cap: three visible priorities, the rest collapsed — the call already
// made in Second Brain Dashboard - Project Brief, which this panel had been flatly
// contradicting by rendering every unchecked checkbox under 02 - Active Projects/ (~150
// rows, twenty scroll-ticks deep, burying every panel below it).
//
// Collapsed shows the first three *undone* tasks rather than the first three rows, so
// ticking one promotes the next instead of leaving a struck-through row sitting in a
// priority slot. Reorder still operates on the full list — `useTaskList.reorder` looks
// tasks up by id, so dragging inside the collapsed view moves them within the real order,
// not within the slice.
const MISSION_PREVIEW_COUNT = 3

function MissionList({ tasks, onToggle, onReorder }) {
  const [showAll, setShowAll] = useState(false)
  const visible = showAll ? tasks : tasks.filter((t) => !t.done).slice(0, MISSION_PREVIEW_COUNT)
  const hiddenCount = tasks.length - visible.length

  return (
    <>
      {visible.length === 0 ? (
        <p className="text-sm text-slate-500">Nothing open. Everything here is ticked.</p>
      ) : (
        <TaskTable tasks={visible} onToggle={onToggle} onReorder={onReorder} />
      )}
      {(showAll || hiddenCount > 0) && (
        <div className="mt-2 flex items-center justify-between gap-3 border-t border-white/10 pt-2">
          <p className="font-structural text-[10px] text-slate-500">
            {showAll
              ? `All ${tasks.length} shown.`
              : `Capped to ${MISSION_PREVIEW_COUNT} on purpose — drag to change what's here.`}
          </p>
          <button
            type="button"
            onClick={() => setShowAll((prev) => !prev)}
            className="shrink-0 rounded-full bg-white/5 px-2.5 py-0.5 font-structural text-[10px] text-slate-400 hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50"
          >
            {showAll ? `Show top ${MISSION_PREVIEW_COUNT}` : `Show all ${tasks.length}`}
          </button>
        </div>
      )}
    </>
  )
}

// Persists to localStorage (reorder/toggle survives a reload) and supports drag
// reordering, not just done/undone toggling. Falls back to the real vault-seeded
// order if storage is empty, corrupt, or unavailable (e.g. private browsing).
//
// Reconciles against the seed on every mount rather than trusting storage blindly
// (fixed 2026-08-16). The previous `if (stored) return JSON.parse(stored)` froze the
// list at whatever the vault contained on first visit: tasks added to the vault after
// that never appeared, and tasks removed from it never left. That made the product's
// central claim — that this runs on live vault data — false from the second page load
// onward. `initialTasks` is now authoritative for *which* tasks exist and what they
// say; storage only contributes the two things the user owns, `done` state and manual
// order.
// Hoisted to module scope so its identity is stable across renders. Built inline at the
// call site previously, which made it a fresh array every render — harmless while the
// seed was only read once on mount, but the reconcile above depends on it, so an
// unstable identity would re-run the persist effect on every render.
const OPEN_LOOPS_SEED = INITIAL_OPEN_LOOPS.map((l) => ({ ...l, urgency: 'medium' }))

const seedSignature = (tasks) => tasks.map((t) => t.id).join('|')

function reconcileWithSeed(stored, initialTasks) {
  const storedOrder = new Map(stored.map((t, i) => [t.id, i]))
  const storedById = new Map(stored.map((t) => [t.id, t]))

  return initialTasks
    .map((seedTask) => {
      const prior = storedById.get(seedTask.id)
      // Seed wins on content; storage wins on done-state. Tasks absent from storage
      // are new in the vault and arrive undone, at their seed position.
      return prior ? { ...seedTask, done: prior.done } : seedTask
    })
    .sort((a, b) => {
      const aIdx = storedOrder.get(a.id)
      const bIdx = storedOrder.get(b.id)
      if (aIdx === undefined && bIdx === undefined) return 0 // both new — keep seed order
      if (aIdx === undefined) return 1 // new tasks sort after manually-ordered ones
      if (bIdx === undefined) return -1
      return aIdx - bIdx
    })
}

function useTaskList(initialTasks, storageKey) {
  const [tasks, setTasks] = useState(() => {
    if (typeof window === 'undefined') return initialTasks
    try {
      const raw = window.localStorage.getItem(storageKey)
      if (!raw) return initialTasks
      const parsed = JSON.parse(raw)
      // Legacy shape was a bare array; current shape is { v, tasks }. Both reconcile.
      const stored = Array.isArray(parsed) ? parsed : parsed?.tasks
      if (!Array.isArray(stored)) return initialTasks
      return reconcileWithSeed(stored, initialTasks)
    } catch {
      // corrupt/unavailable storage — fall through to the real seed below
    }
    return initialTasks
  })

  useEffect(() => {
    try {
      window.localStorage.setItem(
        storageKey,
        JSON.stringify({ v: seedSignature(initialTasks), tasks }),
      )
    } catch {
      // storage full/unavailable — non-fatal, state still works for this session
    }
  }, [tasks, storageKey, initialTasks])

  const toggle = (id) =>
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, done: !t.done } : t)),
    )

  const reorder = (fromId, toId) =>
    setTasks((prev) => {
      const fromIndex = prev.findIndex((t) => t.id === fromId)
      const toIndex = prev.findIndex((t) => t.id === toId)
      if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) return prev
      const next = [...prev]
      const [moved] = next.splice(fromIndex, 1)
      // `toIndex` was measured before the removal above. For a downward drag every
      // index past `fromIndex` has since shifted left by one, so inserting at the raw
      // `toIndex` lands the item one slot *after* the target instead of in its place —
      // upward drags were correct, downward ones overshot. Compensate (fixed 2026-08-16).
      next.splice(fromIndex < toIndex ? toIndex - 1 : toIndex, 0, moved)
      return next
    })

  return [tasks, toggle, reorder]
}

// Quick capture — the starting-friction lever (see branding/Product Strategy Brief.md's
// ADHD-executive-function reframe). Deliberately a *local* queue, not a vault write: the
// deployed app is static + one serverless function and has no filesystem access to the
// vault, so anything claiming to file a note straight into 02 - Active Projects/ would be
// a lie. What this does guarantee is that a thought typed here survives a reload and stays
// visible until it's explicitly cleared — which is the actual job (don't lose the thread).
function useCaptureQueue(storageKey) {
  const [items, setItems] = useState(() => {
    if (typeof window === 'undefined') return []
    try {
      const stored = window.localStorage.getItem(storageKey)
      if (stored) return JSON.parse(stored)
    } catch {
      // corrupt/unavailable storage — start empty rather than crashing the app
    }
    return []
  })

  useEffect(() => {
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(items))
    } catch {
      // storage full/unavailable — non-fatal, captures still work for this session
    }
  }, [items, storageKey])

  // `destination` is stored as a resolved label, not just an id, on purpose: the id points
  // at a project that may be archived out of ACTIVE_PROJECTS before the item is ever
  // cleared, and a queued thought rendering as a dangling id would be worse than useless.
  // Items written before routing existed simply carry no destination — handled at render.
  const add = (text, destination) =>
    setItems((prev) => [
      {
        id: `c${Date.now()}`,
        text,
        ts: new Date().toISOString(),
        destinationId: destination?.id,
        destination: destination?.label,
      },
      ...prev,
    ])

  const remove = (id) => setItems((prev) => prev.filter((i) => i.id !== id))

  return [items, add, remove]
}

// Live Claude call to /api/what-matters (server-side key, see api/what-matters.js);
// falls back to a real, honestly-labeled captured response if the route isn't
// reachable (e.g. plain `vite dev`) or the call fails — never a fake loading forever.
function WhatMattersNow() {
  const [state, setState] = useState({ status: 'loading', items: [], live: false })

  useEffect(() => {
    let cancelled = false
    fetch('/api/what-matters')
      .then((r) => {
        if (!r.ok) throw new Error(`status ${r.status}`)
        return r.json()
      })
      .then((data) => {
        if (cancelled) return
        if (!data.items || !data.items.length) throw new Error('empty response')
        setState({ status: 'ready', items: data.items, live: true })
      })
      .catch(() => {
        if (cancelled) return
        setState({ status: 'ready', items: WHAT_MATTERS_FALLBACK, live: false })
      })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <Panel title="What Matters Now" icon={Sparkles} className="border border-brand/20">
      <div className="mb-2 font-structural text-[10px] uppercase tracking-wider">
        {state.status === 'loading' ? (
          <span className="text-slate-500">Asking Claude…</span>
        ) : state.live ? (
          <span className="text-brand">● Live Claude ranking</span>
        ) : (
          <span className="text-slate-500">● Captured AI ranking (live refresh needs the deployed build)</span>
        )}
      </div>
      {state.status === 'loading' ? (
        <p className="text-sm text-slate-500">Ranking real open tasks against North Star focus…</p>
      ) : (
        <ol className="space-y-2">
          {state.items.map((item, i) => (
            <li key={i} className="rounded-lg bg-void/40 p-2.5">
              <p className="text-sm font-medium text-slate-100">{item.text}</p>
              <p className="mt-0.5 text-xs text-slate-400">{item.rationale}</p>
            </li>
          ))}
        </ol>
      )}
    </Panel>
  )
}

// Read-only display of AGENT_ACTIVITY (a vault-level, cross-project agent event log).
// A separate control-plane app owns this data — approve/reject/kill live there, not
// here. Deliberate split; see ARCHITECTURE.md for which app owns what. This panel only
// surfaces "what are my agents doing," nothing actionable.
function timeAgo(iso) {
  const diffMs = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diffMs / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

function AgentActivity() {
  const { activeCount, recentLogs } = AGENT_ACTIVITY
  return (
    <Panel title="Agent Activity" icon={Bot}>
      <p className="mb-2 text-xs text-slate-400">
        {activeCount > 0 ? (
          <span className="text-brand">● {activeCount} active</span>
        ) : (
          <span className="text-slate-500">No agents running</span>
        )}
      </p>
      {recentLogs.length === 0 ? (
        <p className="text-sm text-slate-500">No activity logged yet.</p>
      ) : (
        <ul className="space-y-1.5">
          {recentLogs.map((log, i) => (
            <li key={i} className="rounded-lg bg-void/40 p-2 text-xs">
              <p className="truncate text-slate-300">{log.detail}</p>
              <p className="mt-0.5 font-structural text-[10px] text-slate-500">{timeAgo(log.ts)}</p>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )
}

// Everything typed into the header quick-capture lands here. Read-and-clear, plus the
// one suggested destination chosen at capture time.
//
// This reverses an earlier rule in this file that read "there is no edit, no routing, no
// tagging" (reversed 2026-08-16, see brain/Decision Log). That rule was right about the
// failure mode and wrong about the cause: what re-introduces decision fatigue is a
// *required* choice, not an available one. Routing here is optional, defaults to
// Unsorted, and never blocks submit — typing and hitting Enter is byte-for-byte the same
// interaction it always was. What it buys is that the re-deciding happens once, while the
// thought is warm, instead of again later against a cold queue.
//
// Still no edit and no free-text tagging — those remain out, for the original reason.
// And a destination is an intent, not a filing: nothing here has touched the vault.
function CaptureQueue({ items, onDismiss }) {
  return (
    <Panel title="Captured" icon={Inbox}>
      {items.length === 0 ? (
        <p className="text-sm text-slate-500">
          Nothing captured. Anything typed above lands here and survives a reload.
        </p>
      ) : (
        <>
          <ul className="space-y-1.5">
            {items.map((item) => (
              <li key={item.id} className="flex items-start gap-2 rounded-lg bg-void/40 p-2">
                <div className="min-w-0 flex-1">
                  <p className="break-words text-sm text-slate-200">{item.text}</p>
                  <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                    <p className="font-structural text-[10px] text-slate-500">{timeAgo(item.ts)}</p>
                    {/* Only a real project destination earns a chip. "Unsorted" and
                        pre-routing items render nothing — absence is the default state,
                        same rule the urgency ramp follows. */}
                    {item.destination && item.destinationId !== CAPTURE_INBOX.id && (
                      <span className="rounded-full bg-brand/15 px-2 py-0.5 font-structural text-[10px] text-brand">
                        → {item.destination}
                      </span>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onDismiss(item.id)}
                  className="shrink-0 rounded-full bg-white/5 px-2 py-0.5 font-structural text-[10px] text-slate-400 hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50"
                  aria-label={`Dismiss capture "${item.text}"`}
                >
                  Clear
                </button>
              </li>
            ))}
          </ul>
          <p className="mt-2 font-structural text-[10px] text-slate-500">
            Held in this browser only — a → destination is where you meant it to go, not
            where it is. File it into the vault to keep it.
          </p>
        </>
      )}
    </Panel>
  )
}

// Deep link straight into Obsidian. Only meaningful on a machine with the vault
// mounted — on the public deploy these resolve to nothing, which is why the expanded
// list shows the vault path as text too: the note is still identifiable without the
// handler. No attempt to detect support; a browser that can't handle the scheme
// silently ignores it, and a fake "Obsidian not installed" warning would be a guess.
function obsidianHref(path) {
  return `obsidian://open?vault=${encodeURIComponent(VAULT_NAME)}&file=${encodeURIComponent(
    path.replace(/\.md$/, ''),
  )}`
}

function WorkspaceTile({ workspace, expanded, onActivate }) {
  const isVault = workspace.kind === 'vault'
  const items = workspace.items ?? []
  return (
    <div className={`rounded-xl bg-void/40 ${expanded ? 'sm:col-span-3' : ''}`}>
      <button
        type="button"
        onClick={onActivate}
        aria-expanded={isVault ? expanded : undefined}
        className="w-full rounded-xl p-3 text-left transition-colors hover:bg-brand/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50"
      >
        <p className="flex items-center gap-1 text-sm font-medium text-brand">
          {workspace.title}
          {isVault &&
            (expanded ? (
              <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
            ))}
        </p>
        <p className="mt-0.5 text-[11px] text-slate-400">{workspace.desc}</p>
      </button>
      {isVault && expanded && (
        <div className="border-t border-white/10 px-3 pb-3 pt-2">
          {items.length === 0 ? (
            <p className="text-[11px] text-slate-500">{workspace.emptyText}</p>
          ) : (
            <>
              {workspace.itemsLabel && (
                <p className="mb-1.5 font-structural text-[10px] uppercase tracking-wider text-slate-500">
                  {workspace.itemsLabel}
                </p>
              )}
              <ul className="space-y-1">
                {items.map((item) => (
                  <li key={item.path}>
                    <a
                      href={obsidianHref(item.path)}
                      className="block rounded-lg px-2 py-1 hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50"
                    >
                      <span className="block truncate text-xs text-slate-200">{item.title}</span>
                      <span className="block truncate font-structural text-[10px] text-slate-500">{item.path}</span>
                    </a>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  )
}

function App() {
  const [capture, setCapture] = useState('')
  // Destination resets to Unsorted after every capture rather than staying sticky. Sticky
  // would save a click on a burst into one project, but the cost of a wrong sticky value
  // is a silently mis-tagged thought — and the safe default has to be the free one.
  const captureDestinations = deriveCaptureDestinations(ACTIVE_PROJECTS)
  const [captureTarget, setCaptureTarget] = useState(CAPTURE_INBOX.id)
  const [expandedWorkspace, setExpandedWorkspace] = useState(null)
  const [flashedPanel, setFlashedPanel] = useState(null)
  const [captures, addCapture, dismissCapture] = useCaptureQueue('sbos-capture-queue')
  const [openTasks, toggleOpenTask, reorderOpenTasks] = useTaskList(OPEN_TASKS_SEED, 'sbos-missions-order')
  const [openLoops, toggleLoop, reorderOpenLoops] = useTaskList(
    OPEN_LOOPS_SEED,
    'sbos-open-threads-order',
  )
  const { dragHandlers: loopDragHandlers, draggingId: draggingLoopId, dragOverId: dragOverLoopId } =
    useDragReorder(reorderOpenLoops)
  const [expandedBuckets, setExpandedBuckets] = useState({})

  const lifeBuckets = deriveLifeBuckets(ACTIVE_PROJECTS)
  const closedLoops = openLoops.filter((l) => l.done).length
  const unhandledEmails = EMAILS_TO_HANDLE_SEED.filter((e) => !e.handled)

  const toggleBucket = (name) =>
    setExpandedBuckets((prev) => ({ ...prev, [name]: !prev[name] }))

  // A "vault" tile expands in place; a "panel" tile scrolls to the panel it names and
  // flashes it, because that panel is already on screen and duplicating it into the tile
  // would mean two places showing the same state.
  const activateWorkspace = (ws) => {
    if (ws.kind !== 'panel') {
      setExpandedWorkspace((prev) => (prev === ws.id ? null : ws.id))
      return
    }
    setExpandedWorkspace(null)
    const el = document.getElementById(ws.panelId)
    if (!el) return
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    setFlashedPanel(ws.panelId)
  }

  useEffect(() => {
    if (!flashedPanel) return
    const timer = setTimeout(() => setFlashedPanel(null), 1600)
    return () => clearTimeout(timer)
  }, [flashedPanel])

  return (
    <div className="min-h-screen bg-void text-slate-200">
      {/* Hero & capture */}
      <header className="bg-panel/60 px-4 py-5 sm:px-6">
        <div className="mx-auto max-w-7xl">
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <Sparkles className="h-5 w-5 text-brand" aria-hidden="true" />
            <div>
              <h1 className="font-structural text-lg font-semibold tracking-tight text-slate-100 sm:text-xl">
                Second Brain OS — Zanshin
              </h1>
              <p className="text-[11px] italic text-slate-500">The focus that stays after the strike.</p>
            </div>
          </div>

          {/* Destination is optional and defaults to Unsorted, so type-and-Enter is
              unchanged — the picker is skippable by never touching it. See CaptureQueue's
              comment for why routing was allowed back in at all. */}
          <form
            onSubmit={(e) => {
              e.preventDefault()
              const text = capture.trim()
              if (!text) return
              addCapture(text, captureDestinations.find((d) => d.id === captureTarget) ?? CAPTURE_INBOX)
              setCapture('')
              setCaptureTarget(CAPTURE_INBOX.id)
            }}
            className="flex flex-wrap items-center gap-2"
          >
            <div className="relative min-w-0 flex-1 basis-full sm:basis-0">
              <Zap
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand"
                aria-hidden="true"
              />
              <input
                type="text"
                value={capture}
                onChange={(e) => setCapture(e.target.value)}
                placeholder="Quick capture — route ideas, tasks, notes…"
                className="w-full rounded-full border border-white/10 bg-void/70 py-2.5 pl-10 pr-4 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus-visible:border-brand/60 focus-visible:ring-1 focus-visible:ring-brand/40"
              />
            </div>
            <div className="relative">
              <select
                value={captureTarget}
                onChange={(e) => setCaptureTarget(e.target.value)}
                aria-label="Where this capture is headed (optional — it is not filed there)"
                className={`w-full appearance-none rounded-full border border-white/10 bg-void/70 py-2.5 pl-4 pr-9 text-sm focus:outline-none focus-visible:border-brand/60 focus-visible:ring-1 focus-visible:ring-brand/40 ${
                  captureTarget === CAPTURE_INBOX.id ? 'text-slate-500' : 'text-brand'
                }`}
              >
                {captureDestinations.map((d) => (
                  <option key={d.id} value={d.id} className="bg-panel text-slate-200">
                    {d.id === CAPTURE_INBOX.id ? d.label : `→ ${d.label}`}
                  </option>
                ))}
              </select>
              <ChevronDown
                className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500"
                aria-hidden="true"
              />
            </div>
            <button
              type="submit"
              className="rounded-full bg-brand px-4 py-2.5 text-sm font-medium text-void transition-colors hover:bg-brand/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50"
            >
              Capture
            </button>
          </form>
        </div>
      </header>

      <main className="mx-auto grid max-w-7xl gap-6 px-4 py-5 sm:px-6 lg:grid-cols-[1fr_280px]">
        {/* Center column */}
        <div className="flex flex-col gap-6 lg:col-span-1">
          {/* AI-necessity leg: real vault data ranked by an actual Claude call */}
          <WhatMattersNow />

          {/* Missions — every unchecked checkbox across 02 - Active Projects/, capped to
              three visible priorities (see MissionList). Freely reorderable (drag the grip
              handle) — the core value driver. */}
          <Panel title="Today's Missions">
            <MissionList tasks={openTasks} onToggle={toggleOpenTask} onReorder={reorderOpenTasks} />
          </Panel>

          {/* Active Projects — "Active Arcs" per Zanshin panel-language convention (CLAUDE.md) */}
          <Panel title="Active Arcs">
            <table className="w-full table-fixed border-collapse">
              <tbody>
                {ACTIVE_PROJECTS.map((project) => (
                  <tr
                    key={project.id}
                    className="transition-colors hover:bg-white/5"
                  >
                    <td className="py-2 pr-2 align-middle">
                      <p className="truncate text-sm font-medium text-slate-100">{project.title}</p>
                      {project.note && (
                        <p className="truncate text-[11px] text-slate-400">{project.note}</p>
                      )}
                    </td>
                    <td className="w-20 whitespace-nowrap py-2 pr-2 align-middle">
                      {project.lifeBucket && (
                        <span className="rounded-full bg-brand/15 px-2 py-0.5 font-structural text-[10px] text-brand">
                          {project.lifeBucket}
                        </span>
                      )}
                    </td>
                    <td className="w-14 whitespace-nowrap py-2 pr-2 align-middle text-right text-[11px] text-slate-400">
                      {project.dueDate ?? '—'}
                    </td>
                    <td className="w-16 whitespace-nowrap py-2 align-middle">
                      <ProjectStatusBadge status={project.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>

          {/* Workspaces — quick nav to the vault's workspace pockets */}
          <Panel title="Workspaces">
            <div className="grid gap-2 sm:grid-cols-3">
              {WORKSPACES_SEED.map((ws) => (
                <WorkspaceTile
                  key={ws.id}
                  workspace={ws}
                  expanded={expandedWorkspace === ws.id}
                  onActivate={() => activateWorkspace(ws)}
                />
              ))}
            </div>
          </Panel>

          {/* Life Buckets */}
          <Panel title="Life Buckets">
            <ul className="space-y-2">
              {lifeBuckets.map(({ name, members }) => (
                <li key={name} className="rounded-xl bg-void/40">
                  <button
                    type="button"
                    onClick={() => toggleBucket(name)}
                    className="flex w-full items-center justify-between px-3 py-2.5 text-left text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50 rounded-xl"
                  >
                    <span className="font-medium text-brand">{name}</span>
                    <span className="flex items-center gap-2 text-xs text-slate-500">
                      {members.length} project{members.length !== 1 ? 's' : ''}
                      {expandedBuckets[name] ? (
                        <ChevronDown className="h-3.5 w-3.5" />
                      ) : (
                        <ChevronRight className="h-3.5 w-3.5" />
                      )}
                    </span>
                  </button>
                  {expandedBuckets[name] && (
                    <ul className="border-t border-white/10 px-3 pb-2 pt-1">
                      {members.map((p) => (
                        <li key={p.id} className="py-1 text-xs text-slate-400">
                          {p.title}
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          </Panel>

          {/* Your Day + Mail row. Both read mocked seeds — Calendar and Gmail are not
              connected. Labeled as such on the panels themselves rather than only in
              vaultApi.js's comments: an unlabeled fake schedule is worse than no schedule,
              because it's the one panel you'd act on without checking. */}
          <div className="grid gap-4 sm:grid-cols-2">
            <Panel title="Your Day" icon={CalendarClock}>
              <p className="mb-2 font-structural text-[10px] uppercase tracking-wider text-slate-500">
                ● Sample day — Calendar not connected
              </p>
              <ul className="space-y-2">
                {YOUR_DAY_SEED.map((event) => (
                  <li
                    key={event.id}
                    className="flex items-center justify-between rounded-lg px-2 py-1.5 text-sm hover:bg-white/5"
                  >
                    <span className="text-slate-200">{event.title}</span>
                    <span className="text-xs text-brand">{event.time}</span>
                  </li>
                ))}
              </ul>
            </Panel>

            {/* Count, not a browsable inbox — Gmail is actively avoided, so a full message
                list doesn't match real behavior (branding/Product Strategy Brief.md,
                "Non-obvious competition"). This panel's whole job is to say whether opening
                Gmail is worth it right now. */}
            <Panel title="Mail" icon={Mail}>
              <p className="mb-2 font-structural text-[10px] uppercase tracking-wider text-slate-500">
                ● Sample count — Gmail not connected
              </p>
              <div className="rounded-xl bg-void/40 p-3 text-center">
                <p className="text-3xl font-semibold text-brand">{unhandledEmails.length}</p>
                <p className="mt-1 text-[11px] text-slate-400">
                  waiting on a reply from{' '}
                  {new Set(unhandledEmails.map((e) => e.sender)).size} sender
                  {new Set(unhandledEmails.map((e) => e.sender)).size === 1 ? '' : 's'}
                </p>
              </div>
            </Panel>
          </div>
        </div>

        {/* Right sidebar — workspace pockets */}
        <aside className="flex flex-col gap-6 lg:col-span-1">
          <CaptureQueue items={captures} onDismiss={dismissCapture} />

          <Panel title="Open Threads">
            <ul className="space-y-1">
              {openLoops.map((loop) => (
                <li
                  key={loop.id}
                  {...loopDragHandlers(loop.id)}
                  className={`flex items-start gap-2 rounded-lg px-1 py-1 transition-colors ${
                    draggingLoopId === loop.id ? 'opacity-40' : ''
                  } ${dragOverLoopId === loop.id ? 'border-t-2 border-brand' : ''}`}
                >
                  <GripVertical className="mt-0.5 h-3.5 w-3.5 shrink-0 cursor-grab text-slate-600" aria-hidden="true" />
                  <input
                    type="checkbox"
                    checked={loop.done}
                    onChange={() => toggleLoop(loop.id)}
                    className="mt-0.5 h-4 w-4 rounded accent-brand focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/50"
                  />
                  <span
                    className={`text-sm ${loop.done ? 'text-slate-500 line-through' : 'text-slate-300'}`}
                  >
                    {loop.text}
                  </span>
                </li>
              ))}
            </ul>
          </Panel>

          <AgentActivity />

          <Panel
            title="Wrap Up"
            id="panel-wrap-up"
            className={flashedPanel === 'panel-wrap-up' ? 'ring-2 ring-brand' : ''}
          >
            <dl className="grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-void/40 p-3 text-center">
                <dt className="font-structural text-[10px] uppercase tracking-wider text-slate-400">Closed loops</dt>
                <dd className="text-2xl font-semibold text-slate-100">{closedLoops}</dd>
              </div>
              <div className="rounded-xl bg-void/40 p-3 text-center">
                <dt className="font-structural text-[10px] uppercase tracking-wider text-slate-400">Active projects</dt>
                <dd className="text-2xl font-semibold text-brand">{ACTIVE_PROJECTS.length}</dd>
              </div>
            </dl>
          </Panel>

          <Panel title="OM Weekly">
            <ul className="space-y-2">
              {WEEKLY_HIGHLIGHTS.map((item, i) => (
                <li key={i} className="text-xs leading-relaxed text-slate-400">
                  {item}
                </li>
              ))}
            </ul>
          </Panel>

        </aside>
      </main>
    </div>
  )
}

export default App
