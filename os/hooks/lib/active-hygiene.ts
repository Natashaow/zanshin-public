/**
 * Active-folder hygiene scan — shared by the SessionStart and Stop hooks
 * (#98/#103), plus the write-time detectors validate-write.ts consumes.
 *
 * Drift modes surfaced:
 *
 *   1. COMPLETED-NOT-ARCHIVED — a note whose frontmatter `status` is
 *      `completed`/`archived`/`done` but is still sitting in `02 - Active Projects/`.
 *      It pollutes the SessionStart task aggregation and the Work Dashboard
 *      Base, and it's how the pile forms (every deferred archive starts
 *      here).
 *
 *   2. UNGROUPED MULTI-FILE TOPIC — two or more notes sitting *loose in the
 *      02 - Active Projects/ root* (not in a subfolder) that share a distinctive topic
 *      token. Convention: once a workstream has >1 note, it gets a folder
 *      (`02 - Active Projects/<Topic>/`). This catches clusters before they scatter.
 *
 *   3. OVERSIZED NOTES — past ~25KB a note has outgrown one node and wants
 *      a SPLIT, never trimming. Bytes, not lines: giant single-line entries
 *      hide in low line counts.
 *
 *   4. OPEN LOOPS (#106) — follow-up surfaces (incident watch-fors) with
 *      live signals that went quiet. Watch dirs and section headings are
 *      manifest-configurable so a reshaped vault retargets its own surfaces
 *      without code edits.
 *
 * Philosophy: pattern-based, no LLM, conservative. This NUDGES — it never
 * moves files. False negatives (missing a cluster) are preferable to false
 * positives (nagging about unrelated notes), so the cluster detector leans
 * hard on a document-frequency guard: a token shared by *more than half*
 * the root notes is treated as a generic team/element word, not a groupable
 * topic.
 */

import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { escapeRegex } from "./regex.ts";
import {
	extractFrontmatterField,
	isInfraFilename,
	isSkippedPath,
} from "./session-start.ts";
import { listVaultNotes, listVaultNotesUnder } from "./vault-notes.ts";

const ACTIVE_REL = "02 - Active Projects";

// Frontmatter status values that mean "this should not be in 02 - Active Projects/".
const ARCHIVABLE_STATUS = new Set(["completed", "archived", "done"]);

// Generic process words that must never anchor a topic cluster. The
// document-frequency guard catches most of these already (a word in >50%
// of root notes is excluded), but common nouns can slip under that in a
// small 02 - Active Projects/ — so we hard-stop the worst offenders. Kept short on
// purpose; over-stopwording would suppress real project nouns.
const STOPWORDS = new Set([
	"onboarding", "branch", "the", "and", "for", "with", "from", "into",
	"that", "this", "report", "plan", "sync", "call", "prep", "notes",
	"doc", "document", "meeting", "review", "draft", "log", "investigation",
	"framework", "roadmap", "playbook", "support", "screen", "verification",
	"remediation", "delivery", "strategy", "execution", "kickoff",
	"discovery", "prompt", "audit", "analysis", "experiment",
]);

// Strip a leading `YYYY-MM-DD ` date prefix and the `.md` extension, then
// tokenise the title into lowercased alphanumeric words.
function titleTokens(filename: string): string[] {
	const title = filename
		.replace(/\.md$/i, "")
		.replace(/^\d{4}-\d{2}-\d{2}\s+/, "");
	return title
		.toLowerCase()
		.split(/[^a-z0-9]+/)
		.filter((t) => t.length >= 4 && !/^\d+$/.test(t) && !STOPWORDS.has(t));
}

export type TopicCluster = {
	readonly token: string;
	readonly files: readonly string[]; // root-level filenames
};

export type OversizedNote = {
	readonly path: string; // vault-relative
	readonly sizeKb: number;
};

export type OpenLoop = {
	readonly path: string; // vault-relative
	readonly ageDays: number;
	readonly openItems: number;
};

export type ActiveHygieneReport = {
	// Vault-relative paths (e.g. "02 - Active Projects/Foo.md").
	readonly completedInActive: readonly string[];
	readonly ungroupedClusters: readonly TopicCluster[];
	readonly oversizedNotes: readonly OversizedNote[];
	readonly openLoops: readonly OpenLoop[];
};

// ---------------------------------------------------------------------------
// Open-loops detection (#106). Conservative by design (false negatives over
// nagging): checkboxes count only inside their follow-up sections, dirs of
// per-person dated notes scan only the LATEST note per person (older notes'
// items are historical carry-forwards), and output is capped. Hook output
// prints paths + counts ONLY — never the matched line content (follow-up
// lines can be sensitive, and hook output may be pasted anywhere).
// ---------------------------------------------------------------------------

export const OPEN_LOOP_DAYS = 14;
export const OPEN_LOOP_CAP = 5;
const OPEN_LOOP_DEFAULT_DIRS = ["work/incidents"];
const OPEN_LOOP_DEFAULT_SECTIONS = ["action items", "what to watch"];
const OPEN_LOOP_PHRASE = /\b(waiting on|watch for)\b/i;

export type OpenLoopConfig = {
	readonly dirs: readonly string[];
	readonly sectionRe: RegExp;
};

/**
 * Read the open-loops watch surfaces from the manifest: `open_loop_dirs`
 * (vault-relative directories) and `open_loop_sections` (heading names,
 * matched case-insensitively). Different vault shapes have different
 * follow-up surfaces — the detector is the invariant, the surfaces are
 * config. Missing/malformed fields fall back to the template defaults.
 */
export function parseOpenLoopConfig(manifestJson: string | null): OpenLoopConfig {
	let dirs: readonly string[] = OPEN_LOOP_DEFAULT_DIRS;
	let sections: readonly string[] = OPEN_LOOP_DEFAULT_SECTIONS;
	if (manifestJson !== null) {
		try {
			const parsed = JSON.parse(manifestJson) as Record<string, unknown>;
			const d = parsed["open_loop_dirs"];
			if (Array.isArray(d)) {
				// Vault-relative plain paths only: no absolute paths, no
				// dot-dot segments, no backslashes — a misconfigured entry
				// must not walk the scan outside the vault root.
				const valid = d.filter(
					(x): x is string =>
						typeof x === "string" &&
						x.length > 0 &&
						!x.startsWith("/") &&
						!/^[A-Za-z]:/.test(x) &&
						!x.includes("\\") &&
						!x.split("/").includes("..") &&
						!x.split("/").includes("."),
				);
				if (valid.length > 0) dirs = valid;
			}
			const s = parsed["open_loop_sections"];
			if (
				Array.isArray(s) &&
				s.length > 0 &&
				s.every((x) => typeof x === "string" && x.length > 0)
			) {
				sections = s as string[];
			}
		} catch {
			/* malformed manifest → defaults */
		}
	}
	const sectionRe = new RegExp(
		`^##+\\s+(${sections.map((s) => escapeRegex(s)).join("|")})`,
		"i",
	);
	return { dirs, sectionRe };
}

/**
 * Count live follow-up signals in a note: unchecked `- [ ]` items inside a
 * configured follow-up section, plus explicit waiting-on / watch-for lines
 * anywhere. Pure — exported for tests.
 */
export function countOpenLoops(content: string, sectionRe: RegExp): number {
	let inActionSection = false;
	let count = 0;
	for (const line of content.split("\n")) {
		if (/^##+\s/.test(line)) {
			inActionSection = sectionRe.test(line);
			continue;
		}
		const unchecked = /^\s*-\s\[\s\]/.test(line);
		if (inActionSection && unchecked) count++;
		else if (OPEN_LOOP_PHRASE.test(line)) count++;
	}
	return count;
}

function findOpenLoops(
	root: string,
	nowMs: number,
	config: OpenLoopConfig,
): OpenLoop[] {
	const candidates: string[] = [];
	for (const dir of config.dirs) {
		candidates.push(...walkMarkdown(root, dir));
	}

	const out: OpenLoop[] = [];
	// Overlapping configured dirs must not scan a file twice — duplicates
	// would crowd the cap.
	for (const rel of [...new Set(candidates)]) {
		// Archive notes hold historical bulk by convention — a "waiting on"
		// line in an archive is a record, not a live loop.
		if ((rel.split("/").pop() ?? "").includes("Archive")) continue;
		let content: string;
		let mtimeMs: number;
		try {
			const full = join(root, rel);
			content = readFileSync(full, "utf-8");
			mtimeMs = statSync(full).mtimeMs;
		} catch {
			continue;
		}
		const ageDays = Math.floor((nowMs - mtimeMs) / 86_400_000);
		if (ageDays < OPEN_LOOP_DAYS) continue;
		const openItems = countOpenLoops(content, config.sectionRe);
		if (openItems === 0) continue;
		out.push({ path: rel, ageDays, openItems });
	}
	// Oldest first, capped — surface the longest-dead loops, stay quiet-ish.
	return out.sort((a, b) => b.ageDays - a.ageDays).slice(0, OPEN_LOOP_CAP);
}

// ---------------------------------------------------------------------------
// Oversized-note detection. Size is a STRUCTURE signal, never a brevity
// signal: past the threshold a note wants a SPLIT (domain notes / event-log
// satellites / a cluster folder — verbatim, index left behind), never
// trimming. Vault-wide by design — existing large chronological logs flag
// immediately and become the split backlog, not noise.
// ---------------------------------------------------------------------------

export const MONOLITH_BYTES = 25_000;

/**
 * Bulk-by-design note types are exempt from the split prompt.
 *
 * CLAUDE.md's Note Types table documents TWO such types, and this predicate
 * used to cover only the first:
 *
 *   - "Archive note"        — `<Live Name> Archive[ — <window>]`, described
 *                             verbatim as "Bulk by design, hygiene-exempt".
 *   - "Event-log satellite" — `<Core> — <Event> Log` or a dated title,
 *                             described verbatim as "chronological bulk".
 *
 * Leaving satellites unexempted meant every accreting session log tripped the
 * 25KB flag and got "split this" advice that contradicts the vault's own
 * taxonomy. Hit 2026-08-15: `Memories — Recent Context Log.md` reached 24,631
 * bytes against a 25,000 threshold with ~2,286-byte appends, so it would have
 * re-flagged within one session of being split — and the next `/om-tidy` run
 * would produce another satellite that walks into the identical wall.
 *
 * The satellite match is deliberately narrow: it requires one of the two forms
 * the table actually documents — an em-dash separator, or a leading ISO date.
 * A first attempt matched any trailing " Log", which silently exempted plain
 * notes like `Delivery Log.md` and `Fat Log.md`; the existing suite caught it.
 * An ordinary note that merely ends in the word "Log" still gets flagged.
 */
export function isMonolithExempt(filename: string): boolean {
	if (filename.includes("Archive")) return true;
	// `<Core> — <Event> Log` — em dash is the documented separator.
	if (/—.*\bLog\.md$/.test(filename)) return true;
	// "…or dated title" — e.g. `2026-07-24 Work Log.md`.
	return /^\d{4}-\d{2}-\d{2}\b.*\bLog\.md$/.test(filename);
}

// Root-anchored prefixes the oversize detector skips: tracked machinery and
// mirrors that git cannot exclude for us because they are legitimately part of
// the repo. Everything git DOES answer — node_modules at any depth, .git,
// .qmd, graphify-out — is gone from this list, because `listVaultNotes` never
// returns those paths in the first place. What remains is exactly the
// root-anchored case, which has never once been the source of a bug.
const OVERSIZE_SKIP_PREFIXES: readonly string[] = [
	".obsidian",
	".claude",
	".codex",
	".gemini",
	".github",
	// Upstream template scaffolding this vault only mirrors. Without it the
	// detector flags third-party skill files (paint/SKILL.md at 34KB,
	// cast/SKILL.md at 26KB) as notes needing a split — advice that cannot be
	// acted on.
	".shardmind",
	"templates",
];

// Recursively collect .md files under a directory, returning paths relative
// to `root`. Tolerates a missing directory (returns []). Shared by every
// detector so subfoldered workstreams are never skipped (#104).
export function walkMarkdown(root: string, relDir: string): string[] {
	return listVaultNotesUnder(root, relDir);
}

function findCompletedInActive(root: string): string[] {
	const found: string[] = [];
	for (const rel of walkMarkdown(root, ACTIVE_REL)) {
		let content: string;
		try {
			content = readFileSync(join(root, rel), "utf-8");
		} catch {
			continue;
		}
		const status = extractFrontmatterField(content, "status");
		if (status && ARCHIVABLE_STATUS.has(status.toLowerCase())) {
			found.push(rel);
		}
	}
	return found.sort();
}

function findUngroupedClusters(root: string): TopicCluster[] {
	// Only files DIRECTLY in 02 - Active Projects/ root — anything already in a subfolder
	// is considered grouped.
	// Sorted so token→file maps (and the signature dedup that keeps the
	// first token per file-set) are deterministic across filesystems.
	// listVaultNotesUnder returns the whole subtree, so drop anything with a
	// further path segment — those are already grouped.
	const rootFiles = listVaultNotesUnder(root, ACTIVE_REL)
		.map((p) => p.slice(ACTIVE_REL.length + 1))
		.filter((rest) => !rest.includes("/"))
		.sort();

	// Don't nag about grouping when the root is already small — folders are
	// for taming size, not for ceremony.
	if (rootFiles.length < 4) return [];

	// token -> set of filenames containing it
	const byToken = new Map<string, Set<string>>();
	for (const f of rootFiles) {
		for (const t of new Set(titleTokens(f))) {
			(byToken.get(t) ?? byToken.set(t, new Set()).get(t)!).add(f);
		}
	}

	// A token is a groupable topic if it appears in >=2 root files but in no
	// more than half of them (the DF guard that rejects generic words).
	const dfCap = Math.floor(rootFiles.length / 2);
	const clusters: TopicCluster[] = [];
	const seenSignatures = new Set<string>();
	for (const [token, set] of byToken) {
		if (set.size < 2 || set.size > dfCap) continue;
		const files = [...set].sort();
		// Dedup tokens that produce the same file set.
		const sig = files.join("|");
		if (seenSignatures.has(sig)) continue;
		seenSignatures.add(sig);
		clusters.push({ token, files });
	}
	// Largest clusters first; ties broken by token for stable output.
	return clusters.sort(
		(a, b) => b.files.length - a.files.length || a.token.localeCompare(b.token),
	);
}

function findOversizedNotes(
	root: string,
	infraRootFilenames: readonly string[],
): OversizedNote[] {
	const out: OversizedNote[] = [];
	for (const rel of listVaultNotes(root)) {
		if (isSkippedPath(rel, OVERSIZE_SKIP_PREFIXES)) continue;
		const slash = rel.lastIndexOf("/");
		const base = slash === -1 ? rel : rel.slice(slash + 1);
		if (isMonolithExempt(base)) continue;
		// Root-level infrastructure docs (README + translations, CLAUDE.md, …)
		// are repo files, not vault notes — their bulk is not a split candidate.
		if (slash === -1 && isInfraFilename(base, infraRootFilenames)) continue;
		try {
			const size = statSync(join(root, rel)).size;
			if (size >= MONOLITH_BYTES) {
				out.push({ path: rel, sizeKb: Math.round(size / 1000) });
			}
		} catch {
			/* unreadable → skip */
		}
	}
	return out.sort((a, b) => b.sizeKb - a.sizeKb);
}

// ---------------------------------------------------------------------------
// Write-time detectors — the same logic the scan uses, moved to the moment
// of write so drift is caught at the keystroke instead of the next session
// boundary. validate-write.ts calls these.
// ---------------------------------------------------------------------------

/**
 * Write-time cluster sensor: when the just-written note sits loose in the
 * 02 - Active Projects/ root and joins a distinctive-token cluster, return that cluster.
 * Reuses findUngroupedClusters wholesale — same tokenizer, same DF guard,
 * same small-root skip — so scan-time and write-time can never disagree.
 */
export function newNoteClusterCandidate(
	filePath: string,
	vaultRoot: string,
): TopicCluster | null {
	const normalized = filePath.replaceAll("\\", "/");
	const rootPrefix = `${vaultRoot.replaceAll("\\", "/")}/${ACTIVE_REL}/`;
	if (!normalized.startsWith(rootPrefix)) return null;
	const base = normalized.slice(rootPrefix.length);
	if (base.includes("/")) return null; // already in a topic folder
	for (const cluster of findUngroupedClusters(vaultRoot)) {
		if (cluster.files.includes(base)) return cluster;
	}
	return null;
}

export function formatClusterHint(cluster: TopicCluster): string {
	return [
		`🗂️  This note joins ${cluster.files.length - 1} loose sibling(s) in 02 - Active Projects/ sharing "${cluster.token}": ${cluster.files.join(", ")}.`,
		"Convention: once a workstream has >1 note it gets a folder (02 - Active Projects/<Topic>/, `git mv`, mirror the folder in work/archive/ later).",
		"Token overlap is BLIND — judge whether these genuinely share context before grouping; if they don't, say so and move on.",
	].join("\n");
}

export function formatMonolithHint(path: string, sizeBytes: number): string {
	return `📐 \`${path}\` is now ${Math.round(sizeBytes / 1000)}KB — past the ${MONOLITH_BYTES / 1000}KB organization threshold. Do NOT trim the content; SPLIT it while you have the context: domain notes / event-log satellites / a cluster folder, moved verbatim, with a one-liner index left behind and inbound links retargeted. If a split genuinely doesn't fit yet, say why in the session instead of ignoring this.`;
}

export function scanActiveHygiene(
	root: string,
	nowMs: number = Date.now(),
	openLoopConfig: OpenLoopConfig = parseOpenLoopConfig(null),
	infraRootFilenames: readonly string[] = [],
): ActiveHygieneReport {
	return {
		completedInActive: findCompletedInActive(root),
		ungroupedClusters: findUngroupedClusters(root),
		oversizedNotes: findOversizedNotes(root, infraRootFilenames),
		openLoops: findOpenLoops(root, nowMs, openLoopConfig),
	};
}

/**
 * Render the report as markdown lines for hook output. Returns [] when the
 * vault is clean, so callers can skip emitting a section entirely.
 */
export function formatActiveHygiene(report: ActiveHygieneReport): string[] {
	const { completedInActive, ungroupedClusters, oversizedNotes, openLoops } =
		report;
	if (
		completedInActive.length === 0 &&
		ungroupedClusters.length === 0 &&
		oversizedNotes.length === 0 &&
		openLoops.length === 0
	) {
		return [];
	}
	const lines: string[] = [];

	if (completedInActive.length > 0) {
		lines.push(
			`⚠️  ${completedInActive.length} note(s) marked done but still in 02 - Active Projects/ — archive to work/archive/YYYY/ (try /om-project-archive):`,
		);
		for (const p of completedInActive) lines.push(`   - ${p}`);
	}

	if (ungroupedClusters.length > 0) {
		if (lines.length > 0) lines.push("");
		lines.push(
			"⚠️  Loose 02 - Active Projects/ notes that look like one topic — consider a folder (02 - Active Projects/<Topic>/):",
		);
		for (const { token, files } of ungroupedClusters) {
			lines.push(`   - "${token}": ${files.join(", ")}`);
		}
	}

	if (oversizedNotes.length > 0) {
		if (lines.length > 0) lines.push("");
		lines.push(
			`⚠️  ${oversizedNotes.length} note(s) past the ${MONOLITH_BYTES / 1000}KB organization threshold — do NOT trim content; SPLIT (domain notes / event-log satellites / a cluster folder, verbatim, one-liner index behind):`,
		);
		for (const { path, sizeKb } of oversizedNotes) {
			lines.push(`   - ${path} (${sizeKb}KB)`);
		}
	}

	if (openLoops.length > 0) {
		if (lines.length > 0) lines.push("");
		lines.push(
			`⚠️  ${openLoops.length} note(s) with open follow-ups untouched ${OPEN_LOOP_DAYS}+ days — close, chase, or consciously park (paths + counts only by design):`,
		);
		for (const { path, ageDays, openItems } of openLoops) {
			lines.push(`   - ${path} (${ageDays}d, ${openItems} open item(s))`);
		}
	}

	return lines;
}
