// ---------------------------------------------------------------------------
// HAND-AUTHORED SEED CONTENT — synthetic twin.
//
// In the private source repo this file carries real hand-authored content that
// names real people, notes and projects. In THIS public repo every value below
// is invented: a fictional solo developer shipping a product called Meridian.
// The shapes are identical, the content is not real.
//
// This is the same arrangement as src/data/generated/*.json — the privacy
// boundary is drawn at whole files, so sanitising is a file swap rather than a
// line-by-line judgement call. The private repo's sync script treats this file
// as TWINNED and will never overwrite it.
//
// If you are reading this to understand the architecture: vaultApi.js re-exports
// everything here, so the app imports from one place and neither App.jsx nor any
// component knows whether it is running against real or synthetic seeds.
// ---------------------------------------------------------------------------

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

// Placeholder — mocked, not a live Gmail read. Grouped by sender/org rather than by
// individual message, since this is meant to be an at-a-glance view: "who do I owe a
// reply to," not a full inbox. The UI itself says Gmail is not connected.
export const EMAILS_TO_HANDLE_SEED = [
  { id: "e1", sender: "Alex Tan", org: null, count: 2, latestSubject: "Re: VAT thresholds for EU customers", receivedAgo: "3h ago", handled: false },
  { id: "e2", sender: "Stripe", org: "Stripe", count: 1, latestSubject: "Action required: verify your account", receivedAgo: "1d ago", handled: false },
  { id: "e3", sender: "Priya Shah", org: null, count: 1, latestSubject: "Quick question before the interview", receivedAgo: "2d ago", handled: false },
];

// Placeholder — mocked, not a live Calendar read. Same honesty rule as above: the
// panel says Calendar is not connected.
export const YOUR_DAY_SEED = [
  { id: "c1", title: "Team sync", time: "10:00 AM", allDay: false },
  { id: "c2", title: "Focus block — onboarding copy", time: "1:00 PM", allDay: false },
  { id: "c3", title: "User interview — session 3", time: "4:30 PM", allDay: false },
];

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
  { id: "s5", cmd: "/om-project-archive", desc: "Moves completed active-project clusters to the archive" },
  { id: "s6", cmd: "/om-vault-audit", desc: "Deep maintenance — orphans, broken links, stale notes" },
];
