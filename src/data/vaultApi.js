// ---------------------------------------------------------------------------
// Static vault data — mirrors CLAUDE.md structure & North Star.md / Project notes
// ---------------------------------------------------------------------------

import northStarFocus from './generated/northStarFocus.json'
import workspaceStats from './generated/workspaceStats.json'
import activeProjects from './generated/activeProjects.json'
import openTasks from './generated/openTasks.json'
import agentActivity from './generated/agentActivity.json'

// Placeholder — sidebar module. Unlike Links below, each entry carries a lifeBucket
// tag (matches Active Projects / Your Tasks) since these are meant to be filterable
// dashboard/view links, not a dumb bookmark list. Not wired to real destinations yet.
export const VIEWS_SEED = [
  { id: "v1", title: "Meridian - Launch Checklist", lifeBucket: "Meridian" },
];

// Placeholder — sidebar module. Deliberately flat, no lifeBucket tag — a plain
// bookmark list per the "keep Links simple" decision.
export const LINKS_SEED = [
  { id: "l1", title: "Meridian repo (GitHub)" },
  { id: "l2", title: "Stripe dashboard" },
];

// The vault directory name, needed to build `obsidian://open?vault=…` deep links.
// Synced rather than hardcoded so a renamed/relocated vault doesn't silently produce
// links that open nothing.
export const VAULT_NAME = workspaceStats.vaultName ?? "DemoVault";

// Sidebar module. Nav tiles for the workspace pockets (Notes, Resources, Topics)
// plus the two panels that live in the sidebar (Open Loop, Wrap Up) so all five
// pockets are reachable from one place. Counts AND contents come from
// workspaceStats.json (see scripts/sync-vault-data.mjs) — real vault data, not mock.
//
// Wired 2026-08-15 (they were inert buttons before). Two behaviours, because the five
// tiles aren't the same kind of thing:
//   kind: "vault"  — expands in place to list the real notes behind it, each a deep
//                    link into Obsidian. Matches the "click & interlink" cross-cutting
//                    decision (open the underlying content inline, don't navigate away)
//                    in Second Brain Dashboard - Project Brief.
//   kind: "panel"  — Wrap Up isn't a vault folder, it's a panel already rendered in the
//                    sidebar, so its tile scrolls to and flashes that panel rather than
//                    duplicating its contents into a second place. (Open Loop reads as a
//                    sidebar panel too, but it does have a real vault population behind
//                    it — every note tagged open-loop — so it lists them instead.)
// Resources schema decided 2026-07-29 (reference/Resources/, one note per item,
// frontmatter type/url/tags — see reference/Resources/Index.md). Folder starts
// empty, so this count is real but currently zero until resources are added.
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
    emptyText: "Nothing here yet — raw links live in Notion, not the vault.",
    items: workspaceStats.items?.resources ?? [],
  },
  {
    id: "ws3",
    title: "Topics",
    kind: "vault",
    desc: `${workspaceStats.topicsCount} topic note${workspaceStats.topicsCount === 1 ? "" : "s"} in 03 - Workspaces/Topics`,
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

// Placeholder — mocked like the rest of the dashboard, not a live Gmail read (yet).
// Grouped by sender/org rather than by individual message, since this is meant to be
// an at-a-glance view: "who do I owe a reply to," not a full inbox.
export const EMAILS_TO_HANDLE_SEED = [
  { id: "e1", sender: "Alex Tan", org: null, count: 2, latestSubject: "Re: VAT thresholds for EU customers", receivedAgo: "3h ago", handled: false },
  { id: "e2", sender: "Stripe", org: "Stripe", count: 1, latestSubject: "Action required: verify your account", receivedAgo: "1d ago", handled: false },
  { id: "e3", sender: "Priya Shah", org: null, count: 1, latestSubject: "Quick question before the interview", receivedAgo: "2d ago", handled: false },
];

// Placeholder — mocked like the rest of the dashboard, not a live Calendar read (yet).
export const YOUR_DAY_SEED = [
  { id: "c1", title: "Team sync", time: "10:00 AM", allDay: false },
  { id: "c2", title: "Focus block — onboarding copy", time: "1:00 PM", allDay: false },
  { id: "c3", title: "User interview — session 3", time: "4:30 PM", allDay: false },
];

// Real data — every unchecked `- [ ]` checkbox under 02 - Active Projects/, synced via
// `npm run sync-vault` (see scripts/sync-vault-data.mjs). Replaces the old Daily
// Highlights / Today / Tomorrow / This Week mock split: real checkboxes carry no
// due-date or urgency metadata to honestly bucket by (decided 2026-08-03, flatten
// rather than fabricate — same call as ACTIVE_PROJECTS.lifeBucket above). `note` is
// the source note's title, for context on where a task came from.
export const OPEN_TASKS_SEED = openTasks;

// Real data — synced from brain/North Star.md's "Current Active Focus" checklist
// via `npm run sync-vault` (auto-runs before dev/build; see scripts/sync-vault-data.mjs).
// Read-only for now: editing this list in the dashboard does not write back to
// North Star.md yet (punch-list item 6 — Current Focus Persistence).
export const CURRENT_FOCUS_SEED = northStarFocus.map(({ id, text }) => ({ id, text }));

// Synced from every `project:`-tagged note in the vault. `status` is the note's own
// frontmatter lifecycle status. There is no vault-side `lifeBucket` or `dueDate` field
// for whole projects — those are per-note tags — so both stay undefined here rather
// than being fabricated.
export const ACTIVE_PROJECTS = activeProjects;

// Read-only display of the vault-level agent event log.
// A separate control-plane app owns approve/reject/kill for this data; this
// dashboard only surfaces it. Deliberate split — this is a read-only feed.
export const AGENT_ACTIVITY = agentActivity;

// Same source as CURRENT_FOCUS_SEED above — the goals note's Current Active Focus
// checklist doubles as the open-loops list (unchecked = open).
export const INITIAL_OPEN_LOOPS = northStarFocus.map(({ id, text, done }) => ({
  id,
  text,
  done,
}));

// Weekly deltas read off the goals note. Synthetic in this repo, matching the fixtures.
export const WEEKLY_HIGHLIGHTS = [
  "Billing stayed blocked all week — same single decision, now 9 days old",
  "Design system closed; deliberately stopped rather than polished further",
  "2 of 6 user interviews done, 4 still unscheduled",
];

// "What Matters Now" fallback — the ranking shown when /api/what-matters isn't
// reachable (plain `vite dev` without a server-side ANTHROPIC_API_KEY, or a failed
// call). Honestly labeled as "captured" in the UI, never claimed as a live refresh.
//
// In this public repo it is a synthetic ranking over the synthetic fixtures in
// src/data/generated/ — same reasoning shape the live endpoint produces, invented
// content. It has to stay consistent with those fixtures: this is the FIRST thing a
// reader sees when they clone and run without an API key, so an inconsistent fallback
// reads as a broken demo.
export const WHAT_MATTERS_FALLBACK = [
  {
    text: "Decide how tax is handled for EU customers before billing can ship",
    rationale:
      "Billing is the only project marked blocked, and every other launch task is downstream of it — this is the one decision holding the release.",
  },
  {
    text: "Reply to the accountant's email about VAT thresholds",
    rationale:
      "The unblock above depends on an answer you have not asked for yet. Small task, but it is the actual critical path.",
  },
  {
    text: "Production rollback is untested — script it and actually run it once",
    rationale:
      "The only open item that turns a bad deploy into a recoverable one. Its cost is fixed now and unbounded after the first paying customer.",
  },
  {
    text: "Write the empty-state copy for the onboarding calendar screen",
    rationale:
      "Named in your own notes as the highest-leverage piece of onboarding, and it has been deferred three times while lower-value polish shipped.",
  },
  {
    text: "This week's build-in-public post is not written",
    rationale:
      "Content Engine's stated goal is cadence, not any single post — and your note says one skipped week has historically become three.",
  },
];

// The vault's own slash-command surface, shown as a reference card.
export const SKILL_CHEATSHEET = [
  { id: "s1", cmd: "/briefing", desc: "Morning briefing — reads North Star.md & work/ tasks" },
  { id: "s2", cmd: "/dump", desc: "Auto-captures ideas, notes, or wins into structured Markdown" },
  { id: "s3", cmd: "wrap up", desc: "End-of-day cleanup — updates wikilinks, indexes, North Star.md" },
  { id: "s4", cmd: "/weekly", desc: "Weekly reflection — surfaces missed accomplishments" },
  { id: "s5", cmd: "/om-project-archive", desc: "Moves completed 02 - Active Projects/ clusters to work/archive/YYYY" },
  { id: "s6", cmd: "/om-vault-audit", desc: "Deep maintenance — orphans, broken links, stale notes" },
];

// Life Buckets are derived from ACTIVE_PROJECTS.lifeBucket — never a separate hardcoded
// list, so a project's bucket only ever needs to be set in one place (Write-Correctness
// Law 1: single-source status). Click-to-filter behavior is intentionally undecided (TBC)
// — for now the row just expands to show its member projects. ACTIVE_PROJECTS is real data
// now and carries no lifeBucket (see comment above) — everything falls into "Uncategorized"
// until real per-project bucket tagging exists; this is an honest gap, not a fabricated grouping.
export function deriveLifeBuckets(projects) {
  const map = new Map();
  projects.forEach((p) => {
    const bucket = p.lifeBucket ?? "Uncategorized";
    if (!map.has(bucket)) map.set(bucket, []);
    map.get(bucket).push(p);
  });
  return Array.from(map.entries()).map(([name, members]) => ({ name, members }));
}
