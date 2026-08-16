#!/usr/bin/env node
/**
 * PreToolUse hook — reminds to check ListAgents/message peers before a
 * git mv or git rm Bash call (DECISION 2026-08-15, see CLAUDE.md's Rules
 * section and brain/Claude Code - Agents and Parallelism.md's worktree
 * section).
 *
 * This vault regularly runs multiple concurrent interactive Claude Code
 * sessions sharing one git working directory. One real incident: two
 * sessions independently asked the operator the same yes/no question about
 * moving zanshin-local/ and got contradictory confirmations,
 * corrupting a git mv mid-flight. A hook can't call ListAgents or know
 * whether other sessions are actually live — it can only re-surface the
 * standing rule at the moment it matters, non-blocking.
 *
 * This script MUST re-check tool_input itself. settings.json's `if`
 * filter is documented as best-effort and "fails open, running your hook
 * regardless of pattern, when the Bash command can't be parsed" — so
 * brace groups, for-loops, and escaped spaces reached this script with no
 * git content at all, and the reminder cried wolf on ordinary reads
 * (verified 2026-08-15). A reminder that fires on everything trains the
 * reader to dismiss it, which defeats the point of having it.
 *
 * Never blocks the calling command: always exits 0.
 */

import { debug, readStdinJson, writeHookOutput } from "./lib/hook-io.ts";
import { isSharedStateMove } from "./lib/shared-state-move.ts";

type HookInput = {
	readonly tool_input?: unknown;
};

const input = await readStdinJson<HookInput>();
if (!input) {
	debug("shared-state-move: null input");
	process.exit(0);
}

const toolInput = input.tool_input;
if (!toolInput || typeof toolInput !== "object") {
	debug("shared-state-move: missing tool_input");
	process.exit(0);
}

const command = (toolInput as Record<string, unknown>).command;
if (typeof command !== "string" || !command) {
	debug("shared-state-move: missing command");
	process.exit(0);
}

if (!isSharedStateMove(command)) {
	debug(`shared-state-move: no git mv/rm in command, staying silent`);
	process.exit(0);
}

writeHookOutput(
	"PreToolUse",
	"Reminder (standing rule, 2026-08-15): this looks like a directory move/delete on shared vault state. " +
		"Before relying on this, call ListAgents for other live sessions and message any found — two sessions " +
		"getting contradictory confirmations from the operator for the same move already corrupted one git mv today. " +
		"See brain/Claude Code - Agents and Parallelism.md.",
);
process.exit(0);
