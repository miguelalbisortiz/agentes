---
description: "Match a user request to the right command, agent, or skill. Use when you don't know what to invoke for a request, the user's intent is ambiguous, or you want to surface options before acting."
agent: build
---

# Route Command

Meta-router across commands, agents, y skills. Given a user request, find the top match + 2 alternatives with reasoning.

## Usage

`/route <request>` — single match request
`/route` — interactive: ask user "que queres hacer?", then route

## Your Task

### Step 1 — Extract intent from $ARGUMENTS

Identify from the request:
- **Action verb**: build, create, fix, review, test, deploy, refactor, document, debug, optimize, ship
- **Domain noun**: feature, bug, UI, API, database, security, test, config, doc, PR
- **Stack hint**: React, Express, Go, Rust, Python, Postgres, etc.
- **Stage hint**: planning, implementing, reviewing, shipping

### Step 2 — Match against the 3 catalogs

Read these 3 indexes in order (auto-generated):

```bash
node .opencode/bin/build-agents-index.js    # .opencode/AGENTS_INDEX.md
node .opencode/bin/build-skills-index.js    # .agents/skills/INDEX.md
# commands have no INDEX but list them via ls + parse frontmatter
```

Score each match:
- **HIGH**: explicit trigger word match (e.g., request says "React" → react-* matches)
- **MEDIUM**: scope match (e.g., request says "build" → any `*build*.md` command or `*-build-resolver` agent)
- **LOW**: domain overlap (e.g., request says "UI" → frontend-patterns skill)

### Step 3 — Output 1 + 2

```text
[route] <request>

→ Recommended: <command-or-agent-or-skill>
  Why: <1-line match reason>
  Type: command | agent | skill
  Path: <file path>

  Alt 1: <option>
       Why: <1-line>
  Alt 2: <option>
       Why: <1-line>

  Run: <exact invocation>
       e.g. "/prd '<verbatim request>'"
       e.g. "@<agent-name>"
       e.g. "load skill <skill-name>"
```

### Step 4 — If no clear match

Output:
```text
[route] No clear match for "<request>".

Closest by domain:
  - <option 1>: <why close>
  - <option 2>: <why close>
  - <option 3>: <why close>

Need clarification:
  - <question to disambiguate>
  - <alternative question>
```

Then ask the user to clarify or pick.

## Routing Tables (Quick Reference)

### Intent → Command

| User intent | Command |
|-------------|---------|
| "agregar feature nueva" / "implementar X" | `/prd "<X>"` (siempre) o `/quick-prd` si es chico |
| "fix bug" / "no funciona Y" | `/flow-bugfix "<repro>"` o `/quick-prd` si es chico |
| "refactor X" | `/flow-refactor "<X>"` o `/refactor-clean` para dead code |
| "review codigo" | `/code-review` o `/pr-review <num>` si es PR |
| "security audit" | `/flow-security` o `/security` para review ad-hoc |
| "verificar / validar" | `/verify` |
| "no se que hacer" / "como uso el pack" | `/start-here` |
| "documentar cambios" | `/update-docs` o `/update-codemaps` |
| "limpiar codigo" | `/refactor-clean` |
| "test coverage" | `/test-coverage` |
| "merge conflict" | `/merge-conflict` |
| "session check" | `/session-start` o `/session-end` |
| "pack health" | `/pack-doctor` |
| "audit report" | `/audit-report <name>` |
| "como se hace X en stack Y" | load `<stack>-patterns` skill o `/list-skills <Y>` |

### Domain → Agent

> **Agentes disponibles:** si el proyecto se instaló con filtro de stack (existe `.opencode/.stack`), algunos agentes de esta tabla pueden no estar instalados. En ese caso usa `code-reviewer` (revisión) o `build-error-resolver` (errores de build) como fallback.

| Stack/Domain | Agent |
|--------------|-------|
| TS/JS | `typescript-reviewer` |
| Python | `python-reviewer` |
| Go | `go-reviewer` |
| Rust | `rust-reviewer` |
| C++ | `cpp-reviewer` |
| C# | `csharp-reviewer` |
| Java/Kotlin | `java-reviewer` / `kotlin-reviewer` |
| Swift | `swift-reviewer` |
| Flutter/Dart | `flutter-reviewer` |
| PHP | `php-reviewer` |
| React | `react-reviewer` |
| Build error (any) | `build-error-resolver` + stack-specific |
| Auth/security sensitive | `security-reviewer` |
| Database | `database-reviewer` |
| API design | `api-design` (skill, not agent) |
| Accessibility | `a11y-architect` |
| E2E tests | `e2e-runner` |
| Refactor | `refactor-cleaner` |
| Plan | `planner` o `code-architect` |
| PRD | `prd-agent` (siempre para features) |

### Topic → Skill

| Topic | Skill |
|-------|-------|
| React/UI | `frontend-patterns` |
| Server/API | `backend-patterns` |
| REST contracts | `api-design` |
| Auth/security | `security-review` |
| TDD/testing | `tdd-workflow` |
| Errors/exceptions | `error-handling` |
| Library docs | `documentation-lookup` |
| MCP servers | `mcp-server-patterns` |
| Git workflow | `git-workflow` |
| Verification | `verification-loop` |
| Requirements | `intent-driven-development` |
| Task breakdown | `task-decomposition` |
| Code quality | `coding-standards` |

## Behavior Notes

- **Always show 1 + 2.** Even when confident, surface alternatives.
- **No file modifications.** This command is read-only. Just routes.
- **If 2+ matches tie**, prefer: command > agent > skill. Commands are the highest-level interface.
- **If user already named a tool** ("run prd"), skip routing and just invoke.
- **If request is multi-step** ("build X then deploy"), break into sub-requests and route each.

## When to Use

- You have a vague user request and don't know where to start.
- Onboarding a new user who says "I have this thing I want to do".
- A user request spans multiple domains and you want to pick the best entry point.
- You want to teach the user what tools exist for their use case.

## When NOT to Use

- User named a specific command ("run /prd"). Just run it.
- Pure Q&A about a single concept. Just answer.
- Bug report with full repro steps. Just invoke `/flow-bugfix` directly.
- User said "skip routing" or "just do it". Skip.

## Integration

- `/list-agents` / `/list-skills` / `/list-mcps` — inventory drill-down
- `/list-agents <keyword>` — for browsing agent catalog
- `/list-skills <keyword>` — for browsing skill catalog
- `router` skill — for skill-only routing (use when the request clearly maps to one skill and you don't need an agent)
- This command is the superset of all of them.
