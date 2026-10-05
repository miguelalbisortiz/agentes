---
description: "Show context hygiene report: skills inventory, agents/commands/sessions counts, project size, and recommendations for keeping the token window lean"
agent: build
---

# Context Budget Command

Run `node .opencode/bin/context.js` to generate a context hygiene report.

## Usage

- `/context-budget` — full report
- `/context-budget --skills` — only skills inventory (local + global)
- `/context-budget --recommend` — only the recommendations block
- `/context-budget --files` — only file sizes

## What it reports

- **Skills available** — local (`.agents/skills/`) + global (`~/.config/opencode/skills/`), deduped
- **Agents** — count + total bytes + token estimate (with explicit warning: "do not load all")
- **Commands** — count + total bytes
- **Sessions** — count + latest date (helps decide if `/session-start` will resume)
- **Project size** — excluding `.git/` and `.opencode/node_modules/`
- **Recommendations** — heuristic tips based on the above (e.g. "many skills, trust catalog", "use the subagent tool to delegate")

## When to run

- Pre-session check (verify the project is healthy before long work)
- Mid-flow check (verify sub-agents aren't being bloated with full file dumps)
- After a context-heavy op (verify compaction kicked in)
- When the user reports "context feels heavy" or asks about token cost
- Pre-handoff: report state of context before pausing

## Why this exists

`context.js` is a read-only inspector — it cannot read the LLM's actual context window (that's internal to opencode). It can only report on the local environment + the size of files that COULD be loaded. The agent uses this output to decide when to delegate, prune, or use targeted queries.

## Tool output discipline reminder

The full report includes a section reminding the agent to:
- `grep -m 50`, `head -n 100` for big trees
- Read tool with line limits instead of `cat`
- `tail -n 30` on build/test output
- Pass file PATHS to sub-agents, not file contents

This aligns with `.opencode/AGENTS.md` Tool Result Truncation rules.

## Your Task

1. Run `node .opencode/bin/context.js $ARGUMENTS` (append any args passed by user)
2. Print stdout verbatim
3. If user passed no args, run the full report
4. If output exceeds 50 lines, summarize key findings (skills count, agents count, recommendation count) and offer to show full

## Manual invocation (bypass slash)

```bash
node .opencode/bin/context.js                    # full
node .opencode/bin/context.js --skills           # skills only
node .opencode/bin/context.js --recommend        # recs only
node .opencode/bin/context.js --files            # project size
```
