# Start Here

> 5-minute orientation to the opencode starter pack. Read this first; everything else is discoverable.

## What this is

A portable, zero-deps starter pack for [opencode](https://opencode.ai):

- **72 agents** — specialist roles (reviewers, builders, planners, domain experts)
- **20 skills** — on-demand reference material (patterns, checklists, frameworks)
- **64 commands** — slash-commands for common flows (`/plan`, `/prd`, `/code-review`, etc.)
- **9 bin scripts** — local CLIs (`context.js`, `instinct.js`, `build-agents-index.js`)
- **3 example projects** — minimal apps in `.opencode/examples/` (delete after grokking)

No `package.json` at the project root. No build step. Drop the `.opencode/` folder in any repo and it works.

## The 80/20: 6 things to know

| # | What | When |
|---|------|------|
| 1 | `/start-here` | Get an overview of commands and how to use this pack |
| 2 | `/list-agents` | See the full agent catalog with descriptions |
| 3 | `/list-skills` | See the full skill catalog with triggers |
| 4 | `/prd <request>` | Start any non-trivial feature (PRD-first) |
| 5 | `/plan <prd-path>` | Turn a PRD into a phased implementation plan |
| 6 | `/verify` | Validate the result against the original PRD |

## Common flows

### I have an idea, want to build it

```
/prd "user profile editing with avatar upload"
  → produces docs/prds/2026-06-30_1430-profile.prd.md
  → asks clarifying questions, builds Intention Map

/plan docs/prds/2026-06-30_1430-profile.prd.md
  → produces phased implementation plan with risks
  → wait for confirmation

/tdd "implement profile edit form"
  → strict RED → GREEN → REFACTOR
  → 80%+ coverage required

/verify
  → runs lint + typecheck + tests
  → produces docs/reports/{ts}-{slug}.report.md

/audit-report profile
  → crosses report against PRD, emits PASS/PASS-WITH-NITS/FAIL
```

### I just wrote code, want it reviewed

```
/code-review
  → runs code-reviewer + security-reviewer + typescript-reviewer in parallel
  → severity-grouped findings with exact file:line

# or for a PR
/pr-review 42
  → fetches PR diff via gh
  → dispatches 5 reviewers in parallel
  → unified verdict: APPROVE | WARN | BLOCK
```

### Something is broken

```
/build-fix
  → runs build-error-resolver with minimal diffs
  → only fixes build/type errors, no architectural changes

# or for merge conflicts
/merge-conflict
  → classifies conflicts (both-added, both-modified, logic-divergence, etc.)
  → proposes resolution + validates with typecheck + tests
```

### I want to refactor safely

```
/refactor-clean
  → runs refactor-cleaner (knip, depcheck, ts-prune)
  → identifies dead code, duplicates, unused exports
  → safe removal with verification
```

### I want to migrate something (DB, framework, monorepo)

```
@migration-planner "migrate from REST to GraphQL"
  → produces migration plan with strategy, phases, rollback
  → risk register + data integrity checks
```

### I want to discover what exists

```
/list-agents                       # all 72 agents
/list-agents react                 # filter by keyword
/list-agents "Language Reviewers"  # filter by category
/list-skills                       # all 16 skills
```

## Mental model: 4 layers

The pack uses a 4-layer memory architecture to keep your context window lean:

| Layer | What | When | Size |
|-------|------|------|------|
| 1 | `AGENTS.md` + `docs/PROJECT.md` | always | ~2K tokens |
| 2 | `LATEST.md` session snapshot | `/session-start` | ~1-3K tokens |
| 3 | Skills (on-demand), specific files, sub-agents | when needed | variable |
| 4 | Full git history, all PRDs, instincts | never (disk only) | unlimited |

**Rule**: anything that can live on disk → disk. Only "live" things go in context.

## The agents you should know by name

These are the agents you'll see most often. Each has a focused specialty and a short context footprint.

| Agent | Use when |
|-------|----------|
| `prd-agent` | Any non-trivial feature, before any other agent |
| `planner` | Turn a goal/PRD into a phased plan |
| `code-reviewer` | After writing code, always |
| `security-reviewer` | After auth, input handling, secrets, payments |
| `code-architect` | Design before code on a non-trivial feature |
| `code-explorer` | Understand an unfamiliar codebase |
| `tdd-guide` | Enforce test-first on new code |
| `code-quality-analyzer` (mode: silent-failures) | Catch swallowed errors and bad fallbacks |
| `migration-planner` | DB/framework/monorepo migrations |
| `report-auditor` | Cross-check a report against the source PRD |

For the full catalog: `/list-agents` or `.opencode/AGENTS_INDEX.md`.

## The skills you should know

Skills are loaded on-demand. You don't need to call them — they're triggered by your request's keywords. The `router` skill has the full trigger map (merged agent + skill selection).

Most commonly auto-loaded:

- `frontend-patterns` — React/JSX/TSX patterns (any UI work)
- `backend-patterns` — server-side layered architecture (any API work)
- `api-design` — REST/GraphQL contracts
- `security-review` — OWASP Top 10, secrets, injection
- `task-decomposition` — turn a PRD into a DAG of tasks
- `verification-loop` — post-change validation
- `coding-standards` — shared floor (naming, immutability, code quality)

For the full catalog: `/list-skills` or `.agents/skills/INDEX.md`.

## Conventions (enforced, not optional)

These 9 behaviors are enforced by the pack:

1. **Caveman mode** — compact responses by default (~75% token savings). Override with `stop caveman` or `normal mode`.
2. **PRD-first** — non-trivial work starts with a PRD via `/prd`. Skip only for one-liners, pure Q&A, or explicit user opt-out.
3. **Git safety** — `git commit` / `git push` / `rm -rf` / `DROP TABLE` need explicit verb. "dale" alone is NOT consent.
4. **Session memory** — auto-snapshot on close ("listo" / "bye"). Manual via `/session-end`.
5. **No destructive actions without consent** — explicit verb required for irreversible operations.
6. **Report + audit** — flows leave artifacts in `docs/reports/` + `docs/audits/`.
7. **Flow suggestions** — primary offers `/flow-*` wrappers when request matches.
8. **Mandatory routing** — primary auto-loads the `router` skill to pick the right subagent + knowledge skill.
9. **Always-On Project Context** — primary ensures `docs/PROJECT.md` is fresh before any non-trivial task.

See `.opencode/AGENTS.md` for the full list.

## How to extend

Add a new agent:
```bash
# Create .opencode/agents/<name>.md
# Required frontmatter:
#   description (1-line, triggers: "Use when...")
#   mode: subagent
#   permission: { edit: deny }   # minimum
node .opencode/bin/validate-frontmatter.js    # check
node .opencode/bin/build-agents-index.js       # refresh catalog
```

Add a new skill:
```bash
mkdir .agents/skills/<name>
# Create <name>/SKILL.md
# Required frontmatter:
#   name: <name>
#   description (third person, "Use when...")
# Optional: triggers: [react, hooks, jsx]
node .opencode/bin/build-skills-index.js       # refresh catalog
```

Add a new command:
```bash
# Create .opencode/commands/<name>.md
# Frontmatter:
#   description: "..."
#   agent: <which agent to dispatch>
```

## When something goes wrong

| Symptom | Fix |
|---------|-----|
| "agent not found" | Restart opencode (`Ctrl+C`, `opencode .`) |
| Skills/agents not loading | `node .opencode/bin/validate-frontmatter.js` |
| AGENTS_INDEX.md missing | `node .opencode/bin/build-agents-index.js` |
| Junk in catalog | Edit the agent/skill description |
| Want to start fresh | `/session-end` then close + reopen |
| Pack feels heavy | `node .opencode/bin/context.js` |

## See also

- `.opencode/AGENTS.md` — full rules and pack structure
- `.opencode/manual/SURFACES.md` — when to use agent vs skill vs command
- `.opencode/CHANGELOG.md` — version history
