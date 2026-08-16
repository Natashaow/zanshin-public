#!/usr/bin/env node
/**
 * Agent-activity hook — logs real agent activity to the shared event feed at
 * work/agent-activity/events.jsonl (DECISION-9, 2026-08-15), consumed by both
 * Apex Logic's live control panel and Second Brain OS/Zanshin's Agent Activity
 * panel.
 *
 * Wired to three different hook families (see settings.json):
 *
 * 1. PostToolUse — matcher "Workflow|CronCreate|ScheduleWakeup|Skill".
 *    Workflow/CronCreate/ScheduleWakeup return as soon as the job is *launched*
 *    or *scheduled*. Skill calls are synchronous (already done when the hook
 *    fires) and log as finished. Only Digital Dojo personas are logged; every
 *    other skill is filtered out so the feed isn't flooded.
 *
 * 1b. TaskCompleted — the completion half of (1), added 2026-08-15. Before it,
 *    nothing fired when a launched background job finished, so those entries
 *    stayed "processing" indefinitely. Payload shape is UNVERIFIED; see the
 *    TaskCompleted branch for what that means and how to close it out.
 *
 * 2. SubagentStart / SubagentStop — the Agent tool does NOT fire PostToolUse,
 *    it fires these two dedicated events. The docs don't publish their fields,
 *    so everything below is from dumping raw stdin. Two independent captures on
 *    2026-08-15 disagreed, and the disagreement is the point:
 *
 *      04:51 — agent_type "Explore" (populated), and background_tasks[0].id
 *              equalled agent_id and carried the stopping agent's own
 *              description.
 *      05:19 — agent_type "" (empty), and background_tasks held a DIFFERENT,
 *              still-running agent — not the one stopping.
 *
 *    So SubagentStop's payload is NOT reliably self-identifying. Do not assume
 *    either shape; what varies between them (agent kind? fork vs. named type?)
 *    is unresolved as of this writing. The consequence that is certain: when
 *    agent_type arrives empty there is nothing for settings.json's matcher to
 *    reject, so the stop matcher cannot be trusted to filter — unfiltered
 *    completions from every concurrent session logged as "unknown-agent" (46
 *    unique COMPLETED agent_ids against 5 LAUNCHED in one afternoon).
 *
 *    Hence: never derive identity from the stop payload. Correlate by
 *    `agent_id`, the one field stable across a subagent's start/stop pair, back
 *    to the launch this feed already recorded, and fail CLOSED — no logged
 *    launch means the agent was filtered at start, so write nothing. That holds
 *    under both observed shapes, which is why it doesn't depend on resolving
 *    which one is canonical.
 *
 * Status vocabulary is constrained by Apex Logic's `statusTokenMap`
 * (processing | idle | paused | approved | halted). AgentBlock.jsx indexes that
 * map with no fallback, so any other value is an uncaught render crash there.
 * "idle" is the in-vocabulary "finished, not on fire" value — never write
 * "completed" as a status, however natural it reads.
 *
 * Never blocks the calling tool: every failure path exits 0 silently.
 */

import { appendFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { debug, readStdinJson } from "./lib/hook-io.ts";

type HookInput = {
	readonly session_id?: unknown;
	readonly tool_name?: unknown;
	readonly tool_input?: unknown;
	readonly tool_response?: unknown;
	readonly hook_event_name?: unknown;
	readonly agent_id?: unknown;
	readonly agent_type?: unknown;
	readonly background_tasks?: unknown;
	// TaskCompleted fields — shape UNVERIFIED, see the TaskCompleted block below.
	readonly task_id?: unknown;
	readonly taskId?: unknown;
	readonly id?: unknown;
	readonly task?: unknown;
	readonly description?: unknown;
};

const input = await readStdinJson<HookInput>();
if (!input) {
	debug("log-agent-activity: null input");
	process.exit(0);
}

const sessionId = typeof input.session_id === "string" ? input.session_id : "unknown-session";
const hookEvent = typeof input.hook_event_name === "string" ? input.hook_event_name : "";

// Apex Logic's statusTokenMap vocabulary — see the header note before changing.
const STATUS_RUNNING = "processing";
const STATUS_DONE = "idle";

// One shared roster, used for two different jobs: filtering the Skill path, and
// tagging `role` on the subagent path. batman/linda/notebook/sarah are live
// slash-commands; bob/derek are subagents as of 2026-08-15 (their commands were
// deleted) — they stay listed so the subagent path tags them correctly, and so
// they'd still work if either is ever reinstated as a command.
const DIGITAL_DOJO_PERSONAS = new Set(["batman", "bob", "derek", "linda", "notebook", "sarah"]);

// Department tags for the persona roster (added 2026-08-15, department-routing
// decision). Purely additive field on agent_status events so Apex Logic can
// group by department; utility agents and unknown personas get none.
const DEPARTMENTS: Record<string, string> = {
	bob: "design",
	sarah: "marketing",
	derek: "research",
	linda: "pm",
};

function firstString(...values: unknown[]): string | undefined {
	for (const v of values) {
		if (typeof v === "string" && v.trim()) return v.trim();
	}
	return undefined;
}

const VAULT_ROOT = process.env["CLAUDE_PROJECT_DIR"] || process.cwd();
const EVENTS_PATH = join(VAULT_ROOT, "work", "agent-activity", "events.jsonl");

/**
 * Find the launch this feed already recorded for `id`. SubagentStop can't
 * identify itself (empty `agent_type`), so its own LAUNCHED entry is the only
 * reliable source of the agent's name and role — and its absence is the signal
 * that this subagent was filtered out at start and must stay out of the feed.
 * Scans newest-first so a re-used id resolves to the most recent launch.
 */
function findLaunch(
	id: string,
): { name: string; role: string; department?: string; ts?: string } | null {
	let lines: string[];
	try {
		lines = readFileSync(EVENTS_PATH, "utf-8").split("\n");
	} catch {
		return null;
	}
	for (let i = lines.length - 1; i >= 0; i--) {
		const line = lines[i];
		if (!line || !line.includes(id)) continue;
		try {
			const e = JSON.parse(line) as Record<string, unknown>;
			if (e["type"] !== "agent_status" || e["agentId"] !== id) continue;
			if (e["status"] !== STATUS_RUNNING) continue;
			return {
				name: typeof e["name"] === "string" ? e["name"] : "Agent: unknown-agent",
				role: typeof e["role"] === "string" ? e["role"] : "vault-agent",
				department: typeof e["department"] === "string" ? e["department"] : undefined,
				ts: typeof e["ts"] === "string" ? e["ts"] : undefined,
			};
		} catch {
			/* a malformed line is not a reason to drop the whole lookup */
		}
	}
	return null;
}

/**
 * Newest still-`processing` launch whose agentId was minted from THIS session,
 * used only when TaskCompleted's payload carries no id this feed recognises.
 *
 * The PostToolUse path mints ids as `<seed>-<first 8 of session_id>`, so the
 * suffix is the correlation key. Restricted to the background tools that have
 * no completion event of their own — a Skill already logs itself finished, and
 * a subagent clears via SubagentStop, so neither should ever be closed here.
 *
 * Deliberately weaker than findLaunch: it picks the most RECENT open launch
 * rather than proving which task finished. With several background jobs open
 * at once it can close the wrong one. That is still strictly better than the
 * current state, where they stay `processing` forever (8 such entries as of
 * 2026-08-15) — but it is a heuristic, and it is why the id-based paths above
 * are tried first.
 */
const SESSION_CLOSEABLE_ROLES = new Set(["workflow", "scheduled-agent", "loop"]);

function findOpenLaunchForSession(
	sessionPrefix: string,
): { agentId: string; name: string; role: string } | null {
	let lines: string[];
	try {
		lines = readFileSync(EVENTS_PATH, "utf-8").split("\n");
	} catch {
		return null;
	}
	const closed = new Set<string>();
	for (let i = lines.length - 1; i >= 0; i--) {
		const line = lines[i];
		if (!line) continue;
		try {
			const e = JSON.parse(line) as Record<string, unknown>;
			if (e["type"] !== "agent_status") continue;
			const id = typeof e["agentId"] === "string" ? e["agentId"] : "";
			if (!id.endsWith(`-${sessionPrefix}`)) continue;
			// Scanning newest-first, so a later terminal status wins: remember it
			// and skip the older launch it already closed.
			if (e["status"] !== STATUS_RUNNING) {
				closed.add(id);
				continue;
			}
			if (closed.has(id)) continue;
			const role = typeof e["role"] === "string" ? e["role"] : "";
			if (!SESSION_CLOSEABLE_ROLES.has(role)) continue;
			return {
				agentId: id,
				name: typeof e["name"] === "string" ? e["name"] : "Agent: unknown-agent",
				role,
			};
		} catch {
			/* malformed line — keep scanning */
		}
	}
	return null;
}

let agentId: string;
let name: string;
let role: string;
let status: string;
let event: string;
let detail: string;
// Additive fields (2026-08-15): department groups the feed by Dojo department;
// duration_ms is computed on stop from the launch pair's ts. Both optional.
let department: string | undefined;
let durationMs: number | undefined;

if (hookEvent === "TaskCompleted") {
	// TaskCompleted (wired 2026-08-15) is the completion event the background
	// tools never had: Workflow/CronCreate/ScheduleWakeup return the moment a
	// job is LAUNCHED, and nothing fired when it finished, so those entries sat
	// at `processing` forever — 8 of them had accumulated when this was added.
	//
	// ⚠️ PAYLOAD SHAPE IS UNVERIFIED (as of 2026-08-15). The docs describe the
	// event ("when a task is being marked as completed", no matcher support)
	// but do not publish its fields, and it could not be captured empirically:
	// a brand-new hook EVENT KEY does not take effect in the session that adds
	// it, so a temporary stdin-dump hook plus a real background task produced
	// nothing. Only the fields common to every hook event — session_id, cwd,
	// hook_event_name — can be relied on here. Everything else below is a
	// guess, tried in order and degrading to a session-scoped fallback.
	//
	// FIRST VERIFICATION AFTER A RESTART SHOULD: capture one real payload
	// (HOOK_DEBUG=1 logs the keys seen) and replace this guesswork with the
	// observed field. Until then treat the correlation as best-effort.
	//
	// Never blocks: TaskCompleted CAN return {"decision":"block"} to prevent a
	// task completing. This hook must never emit that — it only observes.
	const rawId = firstString(input.task_id, input.taskId, input.id, input.agent_id);
	debug(`log-agent-activity: TaskCompleted keys=${Object.keys(input).join(",")}`);

	let resolved: {
		agentId: string;
		name: string;
		role: string;
		department?: string;
		ts?: string;
	} | null = null;

	if (rawId) {
		const launch = findLaunch(rawId);
		if (launch) resolved = { agentId: rawId, ...launch };
	}
	if (!resolved) {
		// No id this feed recognises — fall back to the newest open background
		// launch from this same session. See findOpenLaunchForSession's caveat.
		resolved = findOpenLaunchForSession(sessionId.slice(0, 8));
	}
	if (!resolved) {
		// Fail CLOSED, same discipline as SubagentStop: no matching open launch
		// means this task was never logged as started, so it is not ours to
		// close. Writing a completion for an unknown agent is what produced the
		// "unknown-agent" flood the subagent path had to be hardened against.
		debug("log-agent-activity: TaskCompleted with no matching open launch, skipping");
		process.exit(0);
	}

	agentId = resolved.agentId;
	name = resolved.name;
	role = resolved.role;
	department = resolved.department;
	if (resolved.ts) {
		const launchedAt = Date.parse(resolved.ts);
		if (Number.isFinite(launchedAt)) durationMs = Math.max(0, Date.now() - launchedAt);
	}
	status = STATUS_DONE;
	event = "COMPLETED";
	detail = `${resolved.name} completed`;
} else if (hookEvent === "SubagentStart" || hookEvent === "SubagentStop") {
	const isStart = hookEvent === "SubagentStart";
	const declaredType = firstString(input.agent_type);

	// agent_id is unique per invocation AND identical across the start/stop
	// pair, which the session-derived fallback cannot be (two concurrent runs
	// of one agent would share an id, so one's completion would silently mark
	// the other done). The fallback only applies to starts, where agent_type
	// is guaranteed present.
	agentId =
		firstString(input.agent_id) ??
		`${(declaredType ?? "unknown-agent").toLowerCase()}-${sessionId.slice(0, 8)}`;

	if (isStart) {
		const agentType = declaredType ?? "unknown-agent";
		role = DIGITAL_DOJO_PERSONAS.has(agentType.toLowerCase())
			? "digital-dojo-persona"
			: "vault-agent";
		department = DEPARTMENTS[agentType.toLowerCase()];
		status = STATUS_RUNNING;
		event = "LAUNCHED";
		name = `Agent: ${agentType}`;
		// SubagentStart has no description field, so there is no suffix to add.
		detail = `${agentType} launched`;
	} else {
		// Stop can't name itself — recover identity from the launch, and treat a
		// missing launch as "settings.json filtered this agent out at start".
		const launch = findLaunch(agentId);
		if (!launch) {
			debug(`log-agent-activity: no logged launch for ${agentId}, skipping stop`);
			process.exit(0);
		}
		name = launch.name;
		role = launch.role;
		department = launch.department;
		if (launch.ts) {
			const launchedAt = Date.parse(launch.ts);
			if (Number.isFinite(launchedAt)) durationMs = Math.max(0, Date.now() - launchedAt);
		}
		status = STATUS_DONE;
		event = "COMPLETED";
		detail = `${launch.name.replace(/^Agent:\s*/, "")} completed`;
	}
} else {
	// PostToolUse path — background/scheduled launches and Digital Dojo skills.
	const toolName = firstString(input.tool_name) ?? "Unknown";
	const toolInput = (input.tool_input && typeof input.tool_input === "object")
		? (input.tool_input as Record<string, unknown>)
		: {};

	if (toolName === "Skill") {
		const skillName = firstString(toolInput["skill"]) ?? "";
		if (!DIGITAL_DOJO_PERSONAS.has(skillName)) {
			// Not a Digital Dojo persona — every other skill call is out of scope
			// for this feed, don't flood it.
			process.exit(0);
		}
	}

	const description = firstString(
		toolInput["description"],
		toolInput["title"],
		toolInput["reason"],
		toolInput["name"],
		toolInput["skill"],
		toolInput["args"],
	) ?? `${toolName} call`;

	const roleByTool: Record<string, string> = {
		Workflow: "workflow",
		CronCreate: "scheduled-agent",
		ScheduleWakeup: "loop",
		Skill: "digital-dojo-persona",
	};

	const idSeed = toolName === "Skill"
		? (firstString(toolInput["skill"]) ?? "skill")
		: toolName.toLowerCase();
	agentId = `${idSeed}-${sessionId.slice(0, 8)}`;
	role = roleByTool[toolName] ?? "background-agent";
	if (toolName === "Skill") department = DEPARTMENTS[idSeed];

	// A Skill call has already finished by the time this hook fires; the
	// background tools above have only launched.
	const isDone = toolName === "Skill";
	status = isDone ? STATUS_DONE : STATUS_RUNNING;
	event = isDone ? "COMPLETED" : "LAUNCHED";
	name = `${toolName}: ${description}`;
	detail = `${toolName} ${isDone ? "invoked" : "launched"} — ${description}`;
}

const ts = new Date().toISOString();

const agentStatusEvent = {
	ts,
	type: "agent_status",
	agentId,
	name: name.slice(0, 120),
	role,
	status,
	// Additive optional fields — Apex Logic's renderer indexes only the fields
	// above, so absent-when-unknown is safe and keeps old rows shape-compatible.
	...(department !== undefined ? { department } : {}),
	...(durationMs !== undefined ? { duration_ms: durationMs } : {}),
	metrics: { model: "unknown", latency: 0, tokenVelocity: 0 },
};

const terminalLogEvent = {
	ts,
	type: "terminal_log",
	agentId,
	event,
	detail: detail.slice(0, 200),
};

try {
	const lines = `${JSON.stringify(agentStatusEvent)}\n${JSON.stringify(terminalLogEvent)}\n`;
	appendFileSync(EVENTS_PATH, lines, "utf-8");
	debug(`log-agent-activity: appended 2 events for ${agentId}`);
} catch (err) {
	debug(`log-agent-activity: append failed — ${String(err)}`);
}

process.exit(0);
