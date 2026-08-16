#!/usr/bin/env node
/**
 * PreToolUse hook — warns when a Bash call stages the whole git working
 * tree (`git add -A`, `git add .`, `git commit -a`) instead of naming paths.
 *
 * Why: this vault runs several concurrent Claude Code sessions against one
 * working directory and one index, so a broad stage sweeps up whatever every
 * other session has in flight and commits it under this session's message.
 * On 2026-08-15 three sessions lost attribution that way in one afternoon,
 * and it was an upstream cause of three separate authorship investigations —
 * once work lands in someone else's commit, git history can't say who wrote
 * it. CLAUDE.md's Rules section therefore requires `git commit -- <path>`.
 *
 * This is a REMINDER, not a block. Broad staging is legitimate when a session
 * genuinely owns everything dirty, and a hook can't know that — only the
 * session can. Per Claude Code's own hooks guidance, a hard allow/deny
 * belongs in the permission system, not here.
 *
 * This script MUST re-check tool_input itself: settings.json's `if:` filter
 * is best-effort and "fails open, running your hook regardless of pattern,
 * when the Bash command can't be parsed" — brace groups, for-loops and
 * escaped spaces all reach hooks with no git content at all (verified
 * 2026-08-15 on the sibling shared-state-move hook, where the reminder cried
 * wolf on ordinary reads). A reminder that fires on everything trains the
 * reader to dismiss it, which defeats the point of having it.
 *
 * Never blocks the calling command: always exits 0.
 */

import { debug, readStdinJson, writeHookOutput } from "./lib/hook-io.ts";
import { isBroadGitStaging } from "./lib/broad-git-staging.ts";

type HookInput = {
	readonly tool_input?: unknown;
};

const input = await readStdinJson<HookInput>();
if (!input) {
	debug("broad-git-staging: null input");
	process.exit(0);
}

const toolInput = input.tool_input;
if (!toolInput || typeof toolInput !== "object") {
	debug("broad-git-staging: missing tool_input");
	process.exit(0);
}

const command = (toolInput as Record<string, unknown>).command;
if (typeof command !== "string" || !command) {
	debug("broad-git-staging: missing command");
	process.exit(0);
}

if (!isBroadGitStaging(command)) {
	debug("broad-git-staging: no broad staging in command, staying silent");
	process.exit(0);
}

writeHookOutput(
	"PreToolUse",
	"Reminder (standing rule, 2026-08-15): this stages the WHOLE working tree. " +
		"Several sessions share this one git index, so `git add -A` / `git add .` / `git commit -a` " +
		"absorb other sessions' in-flight work into your commit, under your message — that cost three " +
		"sessions their attribution today. Run `git status` first; if anything dirty isn't yours, " +
		"commit only your own paths (`git commit -- <path>`) and tell the owning session via SendMessage. " +
		"If you've checked and everything dirty is genuinely yours, proceed. See CLAUDE.md's Rules section.",
);
process.exit(0);
