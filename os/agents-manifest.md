# The worker roster

**This file exists to make one claim checkable: the agent topology is two levels deep, and cannot become three.**

[`ARCHITECTURE.md`](../ARCHITECTURE.md) Layer 2 describes this system as an orchestrator–worker (supervisor) pattern with a deterministic router. That claim rests entirely on capability grants, so the grants are published here rather than asserted one level up.

These are the ten subagents defined in the working vault's `.claude/agents/`, as of **2026-08-17**. Names, roles and tool grants are lifted from each definition's frontmatter. **The definition bodies are not shipped** — they carry vault-specific instructions and, in several cases, the operator's own taste and voice rules, which is private material under Layer 3's boundary. What is published is the part the architectural claim depends on.

| Agent | Role | Tool grant |
|---|---|---|
| `bob` | Design review and execution — UX severity, design systems, typography, IA, a11y | `Read` `Grep` `Glob` `Bash` `Write` `Edit` `AskUserQuestion` `WebSearch` `WebFetch` + browser, Figma and component-catalog MCP |
| `sarah` | Brand-voice copy execution against the operator's locked tone rules | `Read` `Grep` `Glob` `Edit` `WebSearch` `WebFetch` + search MCP |
| `derek` | Multi-source research, synthesised into a durable note | `Read` `Grep` `Glob` `Bash` `Write` `Edit` `WebSearch` `WebFetch` |
| `linda` | Status tracking; routes information to whoever needs it | `Read` `Grep` `Glob` `Bash` `Write` `Edit` |
| `vault-librarian` | Maintenance sweep — orphans, broken links, frontmatter validation | `Read` `Write` `Grep` `Glob` `Bash` |
| `vault-migrator` | Classify and migrate content from a source vault | `Read` `Write` `Edit` `Grep` `Glob` `Bash` |
| `cross-linker` | Finds missing links between notes and proposes them | `Read` `Edit` `Grep` `Glob` `Bash` |
| `context-loader` | Gathers every note, backlink and mention on one topic into a briefing | `Read` `Grep` `Glob` `Bash` |
| `brag-spotter` | Scans recent work for achievements not yet recorded | `Read` `Grep` `Glob` `Bash` |
| `slack-archaeologist` | Reconstructs a conversation thread into an attributed timeline | `Read` `Write` `Bash` `Grep` `Glob` |

## What the table proves

**No worker holds an agent-spawning tool.** Read the third column: every grant is file access, shell, search, or a read-only MCP surface. None of the ten can launch another agent, so a worker cannot become an orchestrator, and the graph is bounded at two levels by capability rather than by a recursion counter someone has to remember to set.

**The router is enumerated, not inferred.** `settings.json` binds `log-agent-activity.ts` to `SubagentStart` and `SubagentStop` behind a matcher that lists all ten names literally. An agent outside that list is not logged — the failure direction is silence, not a wrong record. That file is not shipped (it is vault-path-specific), so this is the part a reader has to take from [`hooks/log-agent-activity.ts`](hooks/log-agent-activity.ts), whose header comment documents the same fail-closed reasoning against an undocumented runtime API.

**Two roles are not covered by any worker**, stated so it is not discovered as an omission: nothing here writes to the dashboard, and nothing here talks to another agent. Lateral coordination between concurrent sessions runs over a messaging call, by convention rather than capability — the weakest edge in the system, and the one Layer 2 names its failures on.
