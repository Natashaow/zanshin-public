# The safety envelope

**[`agents-manifest.md`](agents-manifest.md) proves the agent *graph* is bounded. This file is the other half: what those agents are allowed to *do*.**

A roster of workers with no agent-spawning tool tells you the topology can't grow a third level. It tells you nothing about whether a worker can send mail, deploy, spend money, or delete your originals. That is a separate boundary, enforced by a separate mechanism, and until 2026-08-17 this system did not have it.

## The axis

**Loosen permissions in proportion to your ability to undo the damage.**

That is the whole model. Everything below is it applied. Work that is git-tracked and pushed can be relaxed, because `git revert` is a real undo. Work that touches unversioned originals, leaves the machine, or spends money cannot be undone by anything in the repo, so it keeps a prompt.

## Three tiers, and why every rule is labelled with one

The failure this design targets is not "no rules." It is **rules that read as guarantees but are only intentions.** A safety rule written in a Markdown file is honoured by a cooperating agent and by nothing else. So every rule in the operating layer carries the tier that actually enforces it:

| Tier | Enforced by | How it fails |
|---|---|---|
| `[config]` | The agent runtime's own permission system — `deny` blocks the call, `ask` forces a prompt | **Closed.** The call does not run. |
| `[hook]` | A `PreToolUse` script that inspects the call before it executes | **Open.** It warns; by deliberate design none of this system's git hooks block. |
| `[convention]` | Prose in the always-loaded operating layer | **Silently.** |

The tier is the honest part. A reader can tell at a glance which rules would survive an agent that simply didn't follow instructions.

## What is enforced

Rules evaluate **deny → ask → allow**, first match wins, and specificity does not reorder them — so an `ask` rule outranks a broader `allow` elsewhere in the settings chain.

**`deny` — three entries, verified.** `rm -rf`, `git push --force`, `git push -f`. Deliberately tiny: `deny` is unoverridable mid-session, so anything with a legitimate emergency use is kept out of it. `git reset --hard` is the recovery tool for a corrupted index; denying it would mean the recovery path is "explain git surgery to the operator under deadline."

**`ask` — outbound, irreversible, or costly.** Pushing to a remote, hard-resetting, force-cleaning, every mail and chat tool, every deploy and purchase call, live SQL against a hosted database, page moves in the external knowledge base, and edits to the editor's own plugin configuration. These reach past this machine, and no local revert undoes them.

## What is *not* enforced, stated plainly

This section exists because a safety document that only lists its strengths is marketing.

- **`rm -rf` is a speed bump, not a wall.** The rule matches `rm -rf`. It does not match `rm -fr`, `rm -r -f`, or `rm --recursive --force`. The runtime's own documentation warns that shell patterns constraining arguments are fragile. Anyone who writes "deletion is blocked" here would be wrong.
- **The `ask` tier's prompting behaviour is configured but unverified.** The rules load — the `deny` half of the same block demonstrably fires, live, without a restart. But this machine runs an automatic permission mode, and whether its classifier still surfaces a prompt for each `ask` entry was not confirmed. **A session cannot observe its own permission prompts**; only the operator can confirm it, and they were not watching during the test. It is written here as unverified rather than assumed, and it stays that way until someone checks.
- **The staging guard cannot see the daemon.** [`check-broad-git-staging.ts`](hooks/check-broad-git-staging.ts) catches an agent running `git add -A`. The editor's own auto-commit daemon runs `git add -A` on a timer, inside its own process, never through the agent's shell. **The one actor the prohibition exists to guard against is the one actor the hook is structurally blind to.** It guards sessions, not the repository.
- **The general form, which outlives any individual hook:** hooks constrain agent sessions, never the working tree. Anything else with write access routes around every hook in the configuration by construction.
- **Three of the five operator-facing rules are `[convention]` only** — sandbox-new-tools-first, sample-before-bulk-run, and never-overwrite-originals. They are real practice and they are not enforced by anything. Saying so is the point of the tier column.

## Why this shape

A security scan of this configuration on 2026-08-15 returned a high finding — no deny list — and two mediums: no permissions block, and no `PreToolUse` hook. The operator chose to keep momentum and defer the fix to a focused pass. This is that pass, and the scan's findings are why the file exists rather than a reviewer's checklist.

The deferral is worth naming rather than hiding. The gap was known, written down, and left open for two days under deadline pressure. What closed it was not new information; it was deciding the cost of the prompts was lower than the cost of the exposure.

## Related

- [`agents-manifest.md`](agents-manifest.md) — the capability bound on the agent graph
- [`README.md`](README.md) — the hooks themselves, and what each one removes from the human
- [`../ARCHITECTURE.md`](../ARCHITECTURE.md) — Layer 2, where the topology claim these two files support is made
