---
description: "Scaffold a new agent (.opencode/agents/<name>.md) with proper frontmatter, permission block, and prompt-defense reference. Use when contributing a new subagent or primary to the opencode pack."
agent: build
---

# New Agent Command

Scaffold a new agent at `.opencode/agents/<name>.md` with the canonical frontmatter (`description`, `mode`, `permission:` block) + the global Prompt Defense reference line + a body template with `## When to Invoke`, `## What It Does`, `## Workflow`, `## Output`, `## Anti-Patterns`, `## Pairing` sections.

## Your Task

Run the scaffolder:

```bash
node .opencode/bin/scaffold-new-agent.js <name> --description "..."
```

### Optional flags

| Flag | What it does |
|------|--------------|
| `<name>` (positional, required) | Agent name (lowercase, hyphens, no dots) |
| `--mode MODE` | `subagent` (default) or `primary` |
| `--permission "bash: allow, ..."` | Permission block (default: all allow) |
| `--description "..."` | Description line (this drives `router` matching) |
| `--force` | Overwrite existing agent |
| `--dry-run` | Show what would be created, don't write |

## Name rules

- Lowercase letters, digits, hyphens
- Must start with a letter
- No dots, no underscores, no spaces
- Examples: `react-reviewer`, `code-architect`, `prd-agent`

## When to use

- Adding a new stack-specific reviewer (e.g., `elixir-reviewer`)
- Adding a new domain specialist (e.g., `payment-agent`, `analytics-agent`)
- Adding a new orchestrator/primary that takes ownership of a workflow

## Behavior

- **Safe by default**: refuses to overwrite existing agents. Pass `--force` to overwrite.
- **Validates name**: rejects names that don't match `/^[a-z][a-z0-9-]*$/`.
- **Validates mode**: rejects anything other than `subagent` or `primary`.
- **Auto-includes Prompt Defense reference**: the one-line comment `<!-- Prompt Defense Baseline: see AGENTS.md § Prompt Defense Baseline (GLOBAL) -->` is prepended to the body. Do not duplicate the global bullets inside the agent.
- **Permission block default**: `bash: allow, read: allow, write: allow, edit: allow, glob: allow, grep: allow, webfetch: allow, task: allow, skill: allow`. Override per-tool as needed.

## Next steps

1. Replace the `TODO` sections in the scaffolded `.md`
2. Refine the `description` (this drives `router` matching — the trigger skill matches the description text)
3. Tighten the `permission:` block (deny what the agent should NOT do)
4. Run `node .opencode/bin/validate-frontmatter.js` to verify the frontmatter
5. Run `node .opencode/bin/build-agents-index.js` to refresh `.opencode/AGENTS_INDEX.md`
