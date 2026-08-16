/**
 * Detect a real `git mv` / `git rm` invocation inside a Bash command string.
 *
 * Why this exists: settings.json's `if: "Bash(git mv *)"` filter is
 * documented as BEST-EFFORT — it "fails open, running your hook regardless
 * of pattern, when the Bash command can't be parsed"
 * (https://code.claude.com/docs/en/hooks-guide.md). Shell constructs the
 * parser can't read — brace groups `{ a; b; }`, `for ... do ... done`,
 * backslash-escaped spaces — therefore fire the hook on commands with no
 * git content at all. Verified 2026-08-15: `{ echo one; echo two; }` fired
 * the reminder twice. The `if` field stays in settings.json as a cheap
 * pre-filter that avoids most spawns; this function is what actually
 * decides whether the reminder is warranted.
 *
 * Approach: split into command segments on shell separators, then require
 * that a segment's FIRST meaningful token is `git` and its subcommand is
 * `mv` or `rm`. Anchoring at the segment head is what keeps `echo git mv x`
 * and `git log -- some/mv/path` from matching.
 */

// Segment separators: `;` newline `&&` `||` `|` `&`. Order matters — the
// two-character operators must be alternated before the single-character
// ones or `&&` would split as two empty `&` segments.
const SEGMENT_SPLIT = /;|\n|&&|\|\||\||&/;

// Shell punctuation and keywords that can lead a segment before the actual
// command word. `{` and `do` are the ones that matter in practice: they're
// exactly the constructs that defeat the built-in filter.
const LEADING_NOISE = new Set([
	"{",
	"(",
	"!",
	"then",
	"do",
	"else",
	"elif",
]);

// Global git flags that consume a SEPARATE following token as their value.
// `--git-dir=.git` carries its value inline and so is not listed here — the
// `=` check below handles that form.
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

/**
 * True when `segment` is a git invocation whose subcommand is `mv` or `rm`.
 */
function segmentIsMoveOrRemove(segment: string): boolean {
	const tokens = segment.trim().split(/\s+/).filter((t) => t.length > 0);
	let i = 0;

	// Skip shell noise and `VAR=value` prefixes so `{ FOO=1 git mv a b` still
	// resolves to the git invocation underneath.
	while (
		i < tokens.length &&
		(LEADING_NOISE.has(tokens[i] as string) ||
			ENV_ASSIGNMENT.test(tokens[i] as string))
	) {
		i += 1;
	}

	// Anchored: the command word itself must be `git`. A bare `git` appearing
	// later in the segment (`echo git mv x`) is an argument, not a command.
	if (tokens[i] !== "git") return false;
	i += 1;

	// Step over global flags to reach the subcommand.
	while (i < tokens.length && (tokens[i] as string).startsWith("-")) {
		const flag = tokens[i] as string;
		i += 1;
		if (!flag.includes("=") && VALUE_TAKING_FLAGS.has(flag)) i += 1;
	}

	const subcommand = tokens[i];
	return subcommand === "mv" || subcommand === "rm";
}

/**
 * True when `command` contains at least one `git mv` or `git rm` invocation
 * and therefore warrants the shared-state reminder.
 */
export function isSharedStateMove(command: string): boolean {
	if (!command) return false;
	return command.split(SEGMENT_SPLIT).some(segmentIsMoveOrRemove);
}
