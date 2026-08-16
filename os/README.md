# The agent layer

**This directory is the answer to one question: what in this system runs without me?**

The dashboard one level up ranks a vault. This is the part underneath that keeps the vault worth ranking — hooks wired to the agent runtime's own lifecycle events, firing with no human in the loop.

It is here because of a specific gap. `src/data/generated/agentActivity.json` was already in this repo, and the dashboard already rendered it, but the thing that *produces* it was not. A reader could see the feed and had to take the agents on trust. Now both halves are here:

```
agents run  ─►  log-agent-activity.ts records it (no human)  ─►  events.jsonl
                                                                      │
                                                                      ▼
                                                     agentActivity.json
                                                                      │
                                                                      ▼
                                            dashboard Agent Activity panel
```

## What's here

| File | Fires on | What it removes from the human |
|---|---|---|
| `hooks/log-agent-activity.ts` | `PostToolUse`, `TaskCompleted`, `SubagentStart`, `SubagentStop` | Records every agent launch and completion to a shared event feed. The producer for the panel above. |
| `hooks/validate-write.ts` | `PostToolUse` on `Write`/`Edit` | Routes and checks every note write against the vault's taxonomy **at write time**, so misfiled knowledge is caught as it happens rather than at cleanup. |
| `hooks/check-shared-state-move.ts` | `PreToolUse` on `Bash(git *)` | Interrupts destructive shared-state operations before they run. |
| `hooks/classify-message.ts` | `UserPromptSubmit` | Classifies incoming input and injects routing hints. |
| `hooks/generate-memory-index.ts` | maintenance run, **not a hook** | Regenerates the memory index from note frontmatter. Operator-invoked — listed here for completeness and labelled so, rather than counted as unattended. |

`hooks/lib/` holds the 14 shared modules those five import. Nothing in here is written for this repo; it is lifted unchanged from the working system.

[`agents-manifest.md`](agents-manifest.md) is the other half: the ten workers those hooks fire around, with the tool grants that bound the agent graph at two levels. It is the only file here written *for* this repo, because the claim it supports lives in configuration that is not shippable.

## Read `log-agent-activity.ts` first

If you only open one file, open that one — specifically its header comment.

It documents an **undocumented** runtime API being mapped by dumping raw stdin. Two captures on the same afternoon disagreed about the payload shape: in one, the stopping agent identified itself; in the other, `agent_type` arrived empty and the attached task list held a *different, still-running* agent. The hook does not pick a winner between them. It correlates by `agent_id` — the one field stable across a subagent's start/stop pair — back to the launch already in the feed, and **fails closed**: no recorded launch means write nothing.

The bug that forced this is in the file: *46 unique COMPLETED agent_ids against 5 LAUNCHED in one afternoon.* Unfiltered completions from every concurrent session were logging as `unknown-agent`.

That reasoning is left in the code deliberately. It is the honest record of what building on an unstable surface actually looks like.

## What is deliberately not here

Same standard this repo already applies to `scripts/sync-vault-data.mjs` (see `../ARCHITECTURE.md`):

- **`settings.json`** — the file that wires these hooks. Not shipped, so **nothing in this directory is wired or runnable from a clone.** These are readable evidence, not an install. The "Fires on" column above describes the real configuration in the private working vault, not something this repo activates.
- **`scripts/session-start.ts`** (553 lines) and **`scripts/stop-checklist.ts`** — the richest of the set, and the most vault-specific. Sanitizing them against a deadline is how a privacy leak happens, so they stayed out.

  > **Name collision worth flagging before you trip on it:** `hooks/lib/session-start.ts` **is** here, and is a *different file*. It is a generic utility module — string formatters, frontmatter parsing, path predicates — pulled in because `generate-memory-index.ts` uses its frontmatter reader. The 553-line hook entry point that shares its name is the one that isn't shipped.
- **`check-broad-git-staging.ts`** — excluded for a different reason worth stating: it is wired to no hook. Shipping it would imply an autonomy that is not actually running.

## Honest status

- These files are lifted from a working vault, so their comments name that vault's own projects and folders (`brain/`, `02 - Active Projects/`, Digital Dojo personas). That is not incidental detail left in by accident — rewriting it would have made the code cleaner and less true, and this repo's claim is that it ships what actually runs.
- No credentials, keys, or personal content are in this directory.
- There is no test suite here, matching the rest of the repo.
