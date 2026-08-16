// ---------------------------------------------------------------------------
// Sole data module for the dashboard.
//
// This file is PUBLISHABLE VERBATIM. It contains wiring and derivation logic
// only — no hand-authored content naming real people, projects or notes. That
// content lives in ./seeds.js, and real vault content arrives as JSON under
// ./generated/. Both of those are swapped when extracting the public repo;
// this file is copied unchanged.
//
// If you are about to hardcode a string that names something real, it belongs
// in ./seeds.js instead. Keeping that rule is what makes the local -> public
// sync a file operation rather than a judgement call.
// ---------------------------------------------------------------------------

import northStarFocus from './generated/northStarFocus.json'
import workspaceStats from './generated/workspaceStats.json'
import activeProjects from './generated/activeProjects.json'
import openTasks from './generated/openTasks.json'
import agentActivity from './generated/agentActivity.json'

// Hand-authored seed content. Re-exported so consumers keep importing everything
// from this module — swapping seeds.js changes no import anywhere else.
export {
  VIEWS_SEED,
  LINKS_SEED,
  EMAILS_TO_HANDLE_SEED,
  YOUR_DAY_SEED,
  WEEKLY_HIGHLIGHTS,
  WHAT_MATTERS_FALLBACK,
  SKILL_CHEATSHEET,
} from './seeds.js'

// The vault directory name, needed to build `obsidian://open?vault=…` deep links.
// Synced rather than hardcoded so a renamed/relocated vault doesn't silently produce
// links that open nothing. The fallback is deliberately generic — a real name here
// would be a hardcoded private string in a file that ships verbatim.
export const VAULT_NAME = workspaceStats.vaultName ?? "Vault";

// Sidebar module. Nav tiles for the workspace pockets (Notes, Resources, Topics)
// plus the two panels that live in the sidebar (Open Loop, Wrap Up) so all five
// pockets are reachable from one place. Counts AND contents come from
// workspaceStats.json — real synced data, not mock.
//
// Wired 2026-08-15 (they were inert buttons before). Two behaviours, because the five
// tiles aren't the same kind of thing:
//   kind: "vault"  — expands in place to list the real notes behind it, each a deep
//                    link into Obsidian. Matches the "click & interlink" cross-cutting
//                    decision: open the underlying content inline, don't navigate away.
//   kind: "panel"  — Wrap Up isn't a vault folder, it's a panel already rendered in the
//                    sidebar, so its tile scrolls to and flashes that panel rather than
//                    duplicating its contents into a second place. (Open Loop reads as a
//                    sidebar panel too, but it does have a real vault population behind
//                    it — every note tagged open-loop — so it lists them instead.)
// The resources pocket starts empty by design: raw links are kept in an external
// reference tool, so this count is real but currently zero.
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
];

// Real data — every unchecked `- [ ]` checkbox in the vault's active-projects pillar.
// Replaces the old Daily Highlights / Today / Tomorrow / This Week mock split: real
// checkboxes carry no due-date or urgency metadata to honestly bucket by (decided
// 2026-08-03 — flatten rather than fabricate). `note` is the source note's title, for
// context on where a task came from.
export const OPEN_TASKS_SEED = openTasks;

// Real data — synced from the vault's North Star "Current Active Focus" checklist.
// Read-only for now: editing this list in the dashboard does not write back to the
// source note yet.
export const CURRENT_FOCUS_SEED = northStarFocus.map(({ id, text }) => ({ id, text }));

// Real data — synced from every `project:`-tagged note in the vault's active-projects
// pillar. `status` is the note's own frontmatter doc-lifecycle status (active/completed/
// archived/proposed/accepted/deprecated) — everything here reads "active" in practice,
// since anything else would have been archived out.
//
// `lifeBucket` became real on 2026-08-15: it is read from each project hub note's own
// `bucket/<name>` frontmatter tag, so it is the vault's existing taxonomy rather than a
// dashboard-only invention. Projects with no bucket tag come through as null.
// `dueDate` has no field at all — the vault has no per-project due date to read, so it
// is left absent rather than fabricated.
export const ACTIVE_PROJECTS = activeProjects;

// Read-only display of the vault-level, cross-project agent event log. A separate
// control-plane app owns approve/reject/kill for these runs; this dashboard only
// surfaces them. The log has more than one producer, so treat it as an append-only
// feed this app does not own. See ARCHITECTURE.md for which app owns what.
export const AGENT_ACTIVITY = agentActivity;

// Same real source as CURRENT_FOCUS_SEED above — the North Star Current Active
// Focus checklist doubles as the open-loops list (unchecked = open).
export const INITIAL_OPEN_LOOPS = northStarFocus.map(({ id, text, done }) => ({
  id,
  text,
  done,
}));

// Life Buckets are derived from ACTIVE_PROJECTS.lifeBucket — never a separate hardcoded
// list, so a project's bucket only ever needs to be set in one place (single-source
// status). Click-to-filter behavior is intentionally undecided (TBC) — for now the row
// just expands to show its member projects. Projects whose source note carries no
// `bucket/<name>` tag land in "Uncategorized"; that is a missing tag in the vault, not
// a fabricated grouping.
export function deriveLifeBuckets(projects) {
  const map = new Map();
  projects.forEach((p) => {
    const bucket = p.lifeBucket ?? "Uncategorized";
    if (!map.has(bucket)) map.set(bucket, []);
    map.get(bucket).push(p);
  });
  return Array.from(map.entries()).map(([name, members]) => ({ name, members }));
}

// The always-present, always-default destination for a capture. "Unsorted" is a real
// state, not a placeholder: a thought with no home yet is the normal case, and naming a
// home must never become a precondition for getting the thought out of your head.
export const CAPTURE_INBOX = { id: "inbox", label: "Unsorted" };

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
  return [CAPTURE_INBOX, ...projects.map((p) => ({ id: p.id, label: p.title }))];
}
