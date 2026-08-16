// ---------------------------------------------------------------------------
// Sole data module for the dashboard.
//
// THIS REPO CANNOT HOLD PRIVATE DATA. That is a structural property, not a rule
// someone has to remember:
//
//   src/data/generated/*.json  — tracked, ALWAYS synthetic demo fixtures
//   src/data/seeds.js          — tracked, ALWAYS synthetic hand-authored content
//   src/data/local/            — GITIGNORED, optional, real data when present
//
// The app prefers `local/` at runtime and silently falls back to the tracked
// fixtures when it is absent. So a fresh clone builds and runs immediately with
// invented content, while the author's own machine shows real vault data — from
// the same code, with the real data never entering git.
//
// Why it is built this way: the earlier arrangement kept a private daily-driver
// repo and a sanitised public copy in sync by hand. They drifted twice, and a
// tracked-real-data path was published unauthenticated once. A .gitignore could
// not fix it, because `generated/` MUST be tracked — vaultApi imports it, so a
// clone with no fixtures cannot build. Splitting "the path that must be tracked"
// from "the path that holds real data" is what makes ignoring the second one safe.
//
// Adding new data? If it can ever be real, it belongs under local/ with a
// synthetic fixture committed alongside it. Never the other way around.
// ---------------------------------------------------------------------------

// Tracked synthetic fixtures — the fallback, and the only thing in git.
import openTasksFixture from './generated/openTasks.json'
import activeProjectsFixture from './generated/activeProjects.json'
import northStarFocusFixture from './generated/northStarFocus.json'
import workspaceStatsFixture from './generated/workspaceStats.json'
import agentActivityFixture from './generated/agentActivity.json'
import * as seedsFixture from './seeds.js'

// Optional real data. `import.meta.glob` resolves at build time and yields an
// empty object when the directory does not exist, so this compiles either way —
// no try/catch, no dynamic require, no build failure on a fresh clone.
const localJson = import.meta.glob('./local/*.json', { eager: true, import: 'default' })
const localSeeds = import.meta.glob('./local/seeds.js', { eager: true })

const pick = (name, fixture) => localJson[`./local/${name}.json`] ?? fixture
const seeds = localSeeds['./local/seeds.js'] ?? seedsFixture

// True when running against real vault data. Exported so the UI can be honest
// about which it is showing — a demo must never be mistaken for live state.
export const USING_LOCAL_DATA = Object.keys(localJson).length > 0

const openTasks = pick('openTasks', openTasksFixture)
const activeProjects = pick('activeProjects', activeProjectsFixture)
const northStarFocus = pick('northStarFocus', northStarFocusFixture)
const workspaceStats = pick('workspaceStats', workspaceStatsFixture)
const agentActivity = pick('agentActivity', agentActivityFixture)

// Hand-authored seed content, re-exported so consumers import from one place.
// Named explicitly rather than star-exported: an explicit list is what makes a
// missing key in a local override fail loudly instead of rendering undefined.
export const VIEWS_SEED = seeds.VIEWS_SEED
export const LINKS_SEED = seeds.LINKS_SEED
export const EMAILS_TO_HANDLE_SEED = seeds.EMAILS_TO_HANDLE_SEED
export const YOUR_DAY_SEED = seeds.YOUR_DAY_SEED
export const WEEKLY_HIGHLIGHTS = seeds.WEEKLY_HIGHLIGHTS
export const WHAT_MATTERS_FALLBACK = seeds.WHAT_MATTERS_FALLBACK
export const SKILL_CHEATSHEET = seeds.SKILL_CHEATSHEET

// The vault directory name, needed to build `obsidian://open?vault=…` deep links.
// Comes from the data rather than a constant so a renamed vault doesn't silently
// produce links that open nothing. The fallback is deliberately generic.
export const VAULT_NAME = workspaceStats.vaultName ?? "Vault"

// Sidebar module. Nav tiles for the workspace pockets (Notes, Resources, Topics)
// plus the two panels that live in the sidebar (Open Loop, Wrap Up) so all five
// pockets are reachable from one place. Counts AND contents come from
// workspaceStats — real when local/ is present, synthetic otherwise.
//
// Two behaviours, because the five tiles aren't the same kind of thing:
//   kind: "vault"  — expands in place to list the notes behind it, each a deep
//                    link into Obsidian. Matches the "click & interlink" decision:
//                    open the underlying content inline, don't navigate away.
//   kind: "panel"  — Wrap Up isn't a vault folder, it's a panel already rendered in
//                    the sidebar, so its tile scrolls to and flashes that panel
//                    rather than duplicating its contents into a second place.
export const WORKSPACES_SEED = [
  {
    id: "ws1",
    title: "Notes",
    kind: "vault",
    desc: `${workspaceStats.notesCount} work note${workspaceStats.notesCount === 1 ? "" : "s"}, decisions & captures`,
    emptyText: "No notes found in the vault's content roots.",
    itemsLabel: "Most recently edited",
    items: workspaceStats.items?.notes ?? [],
  },
  {
    id: "ws2",
    title: "Resources",
    kind: "vault",
    desc:
      workspaceStats.resourcesCount === 0
        ? "No resources saved yet"
        : `${workspaceStats.resourcesCount} saved resource${workspaceStats.resourcesCount === 1 ? "" : "s"}`,
    emptyText: "Nothing here yet — raw links are kept outside the vault.",
    items: workspaceStats.items?.resources ?? [],
  },
  {
    id: "ws3",
    title: "Topics",
    kind: "vault",
    desc: `${workspaceStats.topicsCount} topic note${workspaceStats.topicsCount === 1 ? "" : "s"}`,
    emptyText: "No topic notes yet.",
    items: workspaceStats.items?.topics ?? [],
  },
  {
    id: "ws4",
    title: "Open Loop",
    kind: "vault",
    desc: `${workspaceStats.openLoopCount} note${workspaceStats.openLoopCount === 1 ? "" : "s"} carrying an open loop`,
    emptyText: "No notes tagged open-loop.",
    items: workspaceStats.items?.openLoop ?? [],
  },
  {
    id: "ws5",
    title: "Wrap Up",
    kind: "panel",
    panelId: "panel-wrap-up",
    desc: "End-of-day review & sync",
  },
]

// Every unchecked `- [ ]` checkbox in the vault's active-projects pillar. Real
// checkboxes carry no due-date or urgency metadata to honestly bucket by, so this
// is a flat list rather than a fabricated Today/Tomorrow/This Week split. `note`
// is the source note's title, for context on where a task came from.
export const OPEN_TASKS_SEED = openTasks

// The vault's North Star "Current Active Focus" checklist. Read-only for now:
// editing this list in the dashboard does not write back to the source note.
export const CURRENT_FOCUS_SEED = northStarFocus.map(({ id, text }) => ({ id, text }))

// Every `project:`-tagged note in the vault's active-projects pillar. `status` is
// the note's own frontmatter doc-lifecycle status (active/completed/archived/
// proposed/accepted/deprecated) — everything reads "active" in practice, since
// anything else would have been archived out.
//
// `lifeBucket` is read from each project hub note's own `bucket/<name>` frontmatter
// tag, so it reflects the vault's existing taxonomy rather than a dashboard-only
// invention; projects with no bucket tag come through as null. There is no `dueDate`
// field at all — the vault has no per-project due date to read, so it is left absent
// rather than fabricated.
export const ACTIVE_PROJECTS = activeProjects

// Read-only display of the vault-level, cross-project agent event log. A separate
// control-plane app owns approve/reject/kill for these runs; this dashboard only
// surfaces them. The log has more than one producer, so treat it as an append-only
// feed this app does not own.
export const AGENT_ACTIVITY = agentActivity

// Same source as CURRENT_FOCUS_SEED — the Current Active Focus checklist doubles
// as the open-loops list (unchecked = open).
export const INITIAL_OPEN_LOOPS = northStarFocus.map(({ id, text, done }) => ({
  id,
  text,
  done,
}))

// Life Buckets are derived from ACTIVE_PROJECTS.lifeBucket — never a separate
// hardcoded list, so a project's bucket is set in exactly one place. Click-to-filter
// is intentionally undecided (TBC); for now the row expands to show its members.
// Projects whose source note carries no `bucket/<name>` tag land in "Uncategorized",
// which is a missing tag at the source, not a fabricated grouping.
export function deriveLifeBuckets(projects) {
  const map = new Map()
  projects.forEach((p) => {
    const bucket = p.lifeBucket ?? "Uncategorized"
    if (!map.has(bucket)) map.set(bucket, [])
    map.get(bucket).push(p)
  })
  return Array.from(map.entries()).map(([name, members]) => ({ name, members }))
}

// The always-present, always-default destination for a capture. "Unsorted" is a real
// state, not a placeholder: a thought with no home yet is the normal case, and naming
// a home must never become a precondition for getting the thought out of your head.
export const CAPTURE_INBOX = { id: "inbox", label: "Unsorted" }

// Capture destinations are derived from ACTIVE_PROJECTS — same single-source rule as
// deriveLifeBuckets above, so a project appears here because it's active in the vault,
// never because it was hand-listed a second time. Deliberately NOT derived from life
// buckets: buckets are a coarser axis and several projects share one, so a bucket-based
// picker would collapse distinct destinations together.
//
// This is a *suggested* destination, and the distinction is the whole design. The app
// has no filesystem access to the vault, so choosing a project here files nothing — it
// tags the queued item with where you thought it belonged, so that when you do file it
// by hand you aren't re-deciding from cold. Any copy or UI built on this must not imply
// the capture has landed in the vault.
export function deriveCaptureDestinations(projects) {
  return [CAPTURE_INBOX, ...projects.map((p) => ({ id: p.id, label: p.title }))]
}
