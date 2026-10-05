---
description: "Initialize, refresh, or check the status of docs/PROJECT.md. Use when starting a new project in this codebase, when PROJECT.md is stale, or to verify project context before a non-trivial task."
agent: build
---

# Project Init Command

Run the `project-init.js` CLI to manage `docs/PROJECT.md` — the always-on project context that every non-trivial task depends on (AGENTS.md behavior #9).

## Your Task

### Detect the mode

Based on `$ARGUMENTS`:

| Argument | Mode | What happens |
|----------|------|--------------|
| (empty) | `--ensure` | Check + auto-bootstrap if missing/stale (quiet, auto-run mode) |
| `init` | `--init` | Create `docs/PROJECT.md` from template + detected data (overwrites) |
| `init --force` | `--init --force` | Same, but skips the overwrite prompt |
| `refresh` | `--refresh` | Re-detect data, preserve manual sections (Non-Negotiables, Architecture Notes, Open Questions, Glossary, Build & Run overrides) |
| `status` | `--status` | Show freshness: `🟢 fresh` / `🟡 aging` / `🔴 stale` / `⚪ no project context` |
| `check` | `--check` | Exit 1 if stale/missing (for CI/pre-commit) |
| `dry-run` | `--dry-run` | Print to stdout, don't write |
| `event <type> <file> [meta]` | `--append-event` | Append a single event to Recent Activity. `<file>` is the link target, relative to `docs/`. |

### Run the CLI

```bash
# Default: ensure (auto-bootstrap if needed)
node .opencode/bin/project-init.js --ensure

# Explicit modes
node .opencode/bin/project-init.js --init
node .opencode/bin/project-init.js --init --force
node .opencode/bin/project-init.js --refresh
node .opencode/bin/project-init.js --status
node .opencode/bin/project-init.js --check
node .opencode/bin/project-init.js --dry-run
node .opencode/bin/project-init.js --append-event plan plans/2026-07-27_1830-user-auth.plan.md "12/15 steps complete"
```

## When to use

- **At the start of a session** for a new project: run `node .opencode/bin/project-init.js --ensure` once. It will bootstrap `docs/PROJECT.md` if missing, or refresh it if stale (>7 days).
- **Before a non-trivial task** (per AGENTS.md #9): run `--ensure` if you're not sure PROJECT.md is current.
- **After major project changes** (new stack, new conventions, new docs): run `--refresh` to re-detect.
- **In CI / pre-commit**: `project-init.js --check` to fail builds when project context is stale.

## What it preserves

`--refresh` and `--ensure` keep these sections untouched across runs:

- **Non-Negotiables** — your hard rules (license, security policies, etc.)
- **Architecture Notes** — your design decisions
- **Open Questions** — things you're still figuring out
- **Glossary** — domain terms
- **Build & Run / Conventions overrides** — anything after `<!-- Override -->`

## Related

- `.opencode/templates/PROJECT.md.template` — the template (v2.1, 16 sections)
- `docs/PROJECT.md` — the output (regenerated each time)
- AGENTS.md behavior #9 — Always-On Project Context
