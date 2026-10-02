---
description: "List all available skills with their description and triggers, optionally filtered by category or keyword"
agent: build
---

# List Skills Command

Show the catalog of available skills. `$ARGUMENTS` may be a keyword, category, or empty (list all).

## Usage

- `/list-skills` — full catalog grouped by category
- `/list-skills <keyword>` — filter by keyword (matches name, description, triggers)
- `/list-skills <category>` — filter by category
- `/list-skills --triggers` — show only skills with explicit trigger words
- `/list-skills --json` — machine-readable output

## Categories

| Category | Skills |
|----------|--------|
| **API / Design** | api-contract-tester, api-design, error-handling |
| **Code patterns** | backend-patterns, coding-standards, frontend-patterns |
| **Compliance / Audit** | compliance-checker |
| **Data / Visualization** | db-schema-visualizer |
| **Dependencies** | dependency-audit |
| **Documentation** | user-manual-generator |
| **Other** | caveman, debugging-patterns, observability, pack-reference, refactoring-patterns, router, testing-patterns |
| **Performance** | performance-budget |
| **Process** | git-workflow, intent-driven-development, task-decomposition, tdd-workflow, verification-loop |
| **Security** | security-review |
| **Tools** | documentation-lookup, mcp-server-patterns |
| **Visualization** | flow-visualizer |

## Your Task

### Step 1 — Read the Catalog

The full catalog lives in `.agents/skills/INDEX.md` (auto-generated). Read it.

If the file is missing or stale, regenerate it by running:

```bash
node .opencode/bin/build-skills-index.js
```

### Step 2 — Filter

If `$ARGUMENTS` is a keyword, filter to skills whose name, description, or `triggers:` field contains it (case-insensitive).

If `$ARGUMENTS` is a category from the table above, show only that category.

If `--triggers` is set, show only skills with a non-empty `triggers:` field in their frontmatter.

If `--json`, output the INDEX in JSON shape (one object per skill with `name`, `description`, `category`, `triggers`, `size_bytes`).

### Step 3 — Display

For each matching skill, show a 1-line summary:

```
<skill-name>                [<size>KB]  <first 80 chars of description>
  triggers: <comma-separated list or "(none)">
```

Then a count and a hint:

```
Total: <N> skills. Use `/list-skills <keyword>` to filter. See `.agents/skills/INDEX.md` for the full catalog.
```

If filtered to a specific category, show the category header.

## Trigger Routing

When a user request comes in, the primary agent (or `router` skill) decides which skill to load based on trigger words. Quick reference:

| If the user mentions... | Load |
|------------------------|------|
| React, JSX, TSX, hooks, components, useState, useEffect, useMemo, form, prop, state, render | `frontend-patterns` |
| Express, FastAPI, NestJS, repository, service layer, DI, transaction, auth, validation, controller, middleware | `backend-patterns` |
| REST, GraphQL, endpoint, route, status code, pagination, API | `api-design` |
| Angular, NgRx, RxJS, signal, component, directive, pipe, OnPush, zone.js, standalone | `frontend-patterns` (Angular surface) |
| log, logger, pino, winston, structlog, zap, observability, tracing, OTel, OpenTelemetry, metrics, prometheus, Sentry, health check, graceful shutdown | `observability` |
| auth, password, JWT, session, CSRF, XSS, SQL injection, secret, OWASP, vulnerability, sanitize | `security-review` |
| test, TDD, RED, GREEN, coverage, jest, pytest, vitest, mock | `tdd-workflow` |
| error, exception, try/catch, error handling, retry, circuit breaker | `error-handling` |
| React, Next.js, Prisma, library, framework, API docs | `documentation-lookup` |
| MCP, model-context-protocol, server, tool, resource | `mcp-server-patterns` |
| commit, branch, PR, merge, rebase, conflict, git | `git-workflow` |
| verify, check, audit, validate, regression | `verification-loop` |
| PRD, requirement, acceptance criteria, scope, objective | `intent-driven-development` |
| task graph, dependency, DAG, parallel, work breakdown, sprint | `task-decomposition` |
| naming, immutability, code quality, lint, formatting, KISS, DRY, YAGNI | `coding-standards` |

## Behavior Notes

- This command is read-only. No side effects except invoking `build-skills-index.js` when INDEX is stale.
- The catalog is regenerated only when missing or older than 1 hour. Cached otherwise.
- Truncate descriptions to 100 chars max in the listing. Full description is in the skill file.

## When to Use

- You forgot which skill covers a topic.
- You're routing a request and want to see the available knowledge.
- You're auditing the pack for coverage gaps.
- You're onboarding someone to the pack and want to show the menu.

## When NOT to Use

- For a single specific question (just describe the topic — the primary agent routes).
- For full skill contents (use the Read tool on `.agents/skills/<name>/SKILL.md`).
