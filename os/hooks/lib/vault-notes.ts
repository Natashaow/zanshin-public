/**
 * One answer to "which paths in this vault are notes?"
 *
 * Before this existed, five consumers each hand-rolled the question --
 * `session-start.ts`, `lib/session-start.ts`, `lib/qmd-refresh.ts`,
 * `lib/active-hygiene.ts`, and `validate-write.ts` -- and the same bug class
 * recurred four times in one day (2026-08-15): a skip list matched against the
 * accumulated relative path, so `node_modules` only excluded at the vault root
 * and a nested `zanshin-local/node_modules/` was walked in full. That
 * one instance scanned ~9,494 package READMEs as vault notes.
 *
 * The fix is not a better walker. This vault is a git repo, and `.gitignore`
 * is already the authoritative, recursively-correct answer to "is this junk?".
 * Measured 2026-08-15: `git ls-files '*.md'` returns 759 where a naive
 * `find` returns 1321 -- 562 files (43%) that every walker was re-excluding by
 * hand, including 330 under `node_modules`, of which git tracks exactly zero.
 *
 * WHAT THIS DOES AND DOES NOT REPLACE. git kills the *nested* case
 * structurally -- ignored directories at arbitrary depth, which is where all
 * four bugs lived. It does not replace per-consumer policy: 584 of the 759
 * tracked files sit in legitimately-tracked machinery dirs (`.claude/` alone is
 * 394), so callers still apply their own root-anchored prefix list via
 * `isSkippedPath`. Root-anchored matching is the half that has never once been
 * buggy, so it stays exactly as it was.
 *
 * POLICY STAYS PER-CONSUMER, DELIBERATELY. `session-start.ts` hides
 * `04 - Thinking` from its listing while `active-hygiene.ts` deliberately scans
 * it. Merging the lists into one shared constant would silently change both
 * consumers' behaviour, so this module returns candidates and never filters by
 * policy itself.
 */

import { spawnSync } from "node:child_process";
import { readdirSync, type Dirent } from "node:fs";
import { join } from "node:path";

import { isMarkdownFilename } from "./session-start.ts";

/**
 * Directory names excluded by the non-git fallback at any depth. Only needed
 * when git can't answer -- with git, `.gitignore` covers these recursively and
 * correctly. Kept deliberately short: the fallback is a safety net for adopting
 * vaults that aren't git repos, not a second policy layer to maintain.
 */
const FALLBACK_SKIP_DIR_NAMES: readonly string[] = [
	".git",
	"node_modules",
	".qmd",
	"graphify-out",
];

/**
 * DELIBERATELY NOT CACHED.
 *
 * A module-level cache keyed by root was tried and removed the same hour. It
 * is wrong for the primary caller: `validate-write.ts` runs the hygiene
 * detectors immediately after a note is written, so "the answer cannot change
 * mid-process" is false exactly where it matters -- a freshly written note
 * would be invisible to the check that exists to inspect it. The active-hygiene
 * test suite surfaced this instantly, because its fixtures write-then-scan in
 * the same process, which is precisely the production shape.
 *
 * Cost of not caching, measured on this vault: ~23ms per call including
 * `--others`. If a future caller needs many lookups in one pass, it should hoist
 * one `listVaultNotes` call and pass the array down rather than reintroducing
 * shared mutable state.
 */

/**
 * Ask git for every markdown path it considers part of the repo.
 *
 * `--cached` is tracked files; `--others --exclude-standard` adds files that
 * exist but aren't committed yet while still honouring `.gitignore`. Dropping
 * `--others` would make in-progress notes invisible to every consumer, which is
 * a worse failure than the one being fixed -- a note vanishes from the session
 * listing and the hygiene scan precisely while it's being written.
 *
 * `-z` because this vault's filenames contain spaces, em dashes and other
 * characters git would otherwise quote and escape in its default output.
 *
 * Returns null (rather than throwing or returning []) when git can't answer, so
 * the caller can tell "no notes" apart from "no git" and fall back.
 */
function gitListMarkdown(root: string): string[] | null {
	const res = spawnSync(
		"git",
		["ls-files", "-z", "--cached", "--others", "--exclude-standard", "--", "*.md"],
		{ cwd: root, encoding: "utf8", maxBuffer: 32 * 1024 * 1024 },
	);
	if (res.error || res.status !== 0 || typeof res.stdout !== "string") return null;
	const paths = res.stdout.split("\0").filter((p) => p.length > 0);
	// A deleted-but-still-tracked file is listed by --cached; the caller wants
	// paths it can actually read. Dedupe too: a path staged AND present can
	// appear once from each of --cached and --others in some git versions.
	return [...new Set(paths)];
}

/**
 * Filesystem fallback for vaults that are not git repos. Applies
 * `FALLBACK_SKIP_DIR_NAMES` by directory NAME at every depth -- which is
 * precisely the correctness property the hand-rolled walkers kept getting
 * wrong by testing the accumulated path instead of the entry name.
 */
function walkMarkdown(root: string): string[] {
	const out: string[] = [];
	function walk(relDir: string): void {
		let entries: Dirent[];
		try {
			entries = readdirSync(relDir === "" ? root : join(root, relDir), {
				withFileTypes: true,
			});
		} catch {
			return;
		}
		for (const e of entries) {
			const rel = relDir === "" ? e.name : `${relDir}/${e.name}`;
			if (e.isDirectory()) {
				if (FALLBACK_SKIP_DIR_NAMES.includes(e.name)) continue;
				walk(rel);
			} else if (e.isFile() && isMarkdownFilename(e.name)) {
				out.push(rel);
			}
		}
	}
	walk("");
	return out;
}

/**
 * Every markdown path under `root`, relative and posix-separated, sorted.
 *
 * Callers apply their own policy on top -- typically
 * `isSkippedPath(rel, THEIR_OWN_PREFIXES)`. This deliberately returns
 * everything git considers part of the repo, including `.claude/` and other
 * machinery, because what counts as machinery differs per consumer.
 */
export function listVaultNotes(root: string): string[] {
	const paths = gitListMarkdown(root) ?? walkMarkdown(root);
	return paths
		.map((p) => p.replaceAll("\\", "/"))
		.filter((p) => isMarkdownFilename(p))
		.sort();
}

/**
 * The subset of `listVaultNotes` under a given relative directory, with the
 * same relative-to-root paths. Replaces the per-detector recursive walks in
 * `active-hygiene.ts`, which each re-derived the same exclusions.
 *
 * `relDir` is matched as a path segment, so `"work"` never matches
 * `"workspaces/..."`. Passing `""` or `"."` returns everything.
 */
export function listVaultNotesUnder(root: string, relDir: string): string[] {
	const all = listVaultNotes(root);
	const rel = relDir.replaceAll("\\", "/").replace(/^\.?\/*/, "").replace(/\/+$/, "");
	if (rel === "") return all;
	return all.filter((p) => p.startsWith(rel + "/"));
}
