/**
 * Detect a BROAD git staging command — one that stages the whole working
 * tree rather than named paths.
 *
 * Why this exists: this vault runs several concurrent Claude Code sessions
 * against ONE git working directory and ONE index. `git add -A`, `git add .`
 * and `git commit -a` therefore sweep up whatever every *other* session has
 * in flight, and commit it under this session's message. That happened
 * repeatedly on 2026-08-15 — three sessions lost attribution in one
 * afternoon — which is why CLAUDE.md's Rules section requires committing
 * your own work by explicit pathspec (`git commit -- <path>`).
 *
 * Deliberately duplicates the segment-splitting/anchoring approach from
 * `shared-state-move.ts` rather than importing it: that module doesn't
 * export its internals, and it was mid-flight in another session when this
 * was written, so editing it would have risked a live conflict. Worth
 * consolidating into one shared shell-parsing module once the hook layer
 * settles — flagged as a known choice, not an oversight.
 *
 * Same fail-open caveat applies as there: settings.json's `if:` filter is
 * best-effort and runs the hook anyway when the Bash command can't be
 * parsed, so this function — not the filter — is what decides whether the
 * reminder is warranted.
 */

// Segment separators: `;` newline `&&` `||` `|` `&`. Two-character operators
// must be alternated before the single-character ones or `&&` splits into
// two empty `&` segments.
const SEGMENT_SPLIT = /;|\n|&&|\|\||\||&/;

// Shell punctuation/keywords that can lead a segment before the command word.
const LEADING_NOISE = new Set(["{", "(", "!", "then", "do", "else", "elif"]);

// Global git flags that consume a SEPARATE following token as their value.
// The `--flag=value` form carries its value inline and is handled by the
// `=` check below instead.
const VALUE_TAKING_FLAGS = new Set([
	"-C",
	"-c",
	"--git-dir",
	"--work-tree",
	"--namespace",
	"--exec-path",
	"--super-prefix",
]);

const ENV_ASSIGNMENT = /^[A-Za-z_][A-Za-z0-9_]*=/;

// Flags whose VALUE is free text that may contain anything — including
// strings that look like other flags. Scanning stops here, because
// `git commit -m "add -A support"` must not match on the `-A` inside the
// message. Flags essentially always precede the message in practice.
const FREE_TEXT_FLAGS = new Set(["-m", "--message", "-F", "--file"]);

/** Long flags that stage the whole tree. Exact match — `--amend` must not hit. */
const BROAD_LONG_FLAGS = new Set(["--all", "--update"]);

/** Bare targets that mean "everything from here down". */
const BROAD_TARGETS = new Set([".", ":/", "*"]);

/**
 * True when a combined short-flag cluster (`-Av`, `-am`) contains one of the
 * broad letters. `-A` = all, `-u` = all tracked, `-a` = commit all tracked.
 */
function shortClusterIsBroad(token: string, letters: string): boolean {
	if (!token.startsWith("-") || token.startsWith("--")) return false;
	return token
		.slice(1)
		.split("")
		.some((ch) => letters.includes(ch));
}

/**
 * True when `segment` is a `git add` / `git commit` invocation that stages
 * the whole tree rather than named paths.
 */
function segmentIsBroadStaging(segment: string): boolean {
	const tokens = segment.trim().split(/\s+/).filter((t) => t.length > 0);
	let i = 0;

	// Skip shell noise and `VAR=value` prefixes so `{ FOO=1 git add -A` still
	// resolves to the git invocation underneath.
	while (
		i < tokens.length &&
		(LEADING_NOISE.has(tokens[i] as string) ||
			ENV_ASSIGNMENT.test(tokens[i] as string))
	) {
		i += 1;
	}

	// Anchored: the command word itself must be `git`. A `git` appearing later
	// (`echo git add -A`) is an argument, not a command.
	if (tokens[i] !== "git") return false;
	i += 1;

	// Step over global flags to reach the subcommand.
	while (i < tokens.length && (tokens[i] as string).startsWith("-")) {
		const flag = tokens[i] as string;
		i += 1;
		if (!flag.includes("=") && VALUE_TAKING_FLAGS.has(flag)) i += 1;
	}

	const subcommand = tokens[i];
	if (subcommand !== "add" && subcommand !== "commit") return false;
	i += 1;

	// `-A`/`-u` stage the tree for `add`; `-a` does for `commit`.
	const broadLetters = subcommand === "add" ? "Au" : "a";

	for (; i < tokens.length; i += 1) {
		const token = tokens[i] as string;

		// Stop before free-text values so a commit message can't trigger a match.
		if (FREE_TEXT_FLAGS.has(token)) return false;
		if (token.startsWith("--") && FREE_TEXT_FLAGS.has(token.split("=")[0] as string)) {
			return false;
		}

		if (BROAD_LONG_FLAGS.has(token)) return true;
		if (shortClusterIsBroad(token, broadLetters)) return true;
		// A bare `.` target only counts for `add` — `git commit .` is a pathspec.
		if (subcommand === "add" && BROAD_TARGETS.has(token)) return true;
	}

	return false;
}

/**
 * True when `command` contains at least one broad git staging invocation and
 * therefore warrants the pathspec reminder.
 */
export function isBroadGitStaging(command: string): boolean {
	if (!command) return false;
	return command.split(SEGMENT_SPLIT).some(segmentIsBroadStaging);
}
