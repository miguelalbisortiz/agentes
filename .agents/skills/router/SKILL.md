---
name: router
description: Use when the primary agent must dispatch a subagent and/or load a knowledge skill for any non-Q&A request (building, adding, fixing, reviewing, testing, refactoring, planning, documenting, deploying, or auditing work). Triggers on action verbs (build/add/create/fix/review/test/refactor/plan/deploy/ship/audit/document, plus Spanish crear/agregar/arreglar/revisar/testear/refactorizar/planear/desplegar/auditar/documentar) and on natural-language patterns ("I need to...", "in this folder...", "this project...", "me ayudas con...", "como puedo...", "le pedi sobre un proyecto hacer alguna modificacion"). Also fires on meta-routing questions ("what agent should I use for X", "que skill uso para..."). Maps request intent + domain to the right agent from the 72-agent catalog AND the right skill from the 20-skill catalog. Single combined skill — replaces the legacy `agent-router` + `skill-router` pair.
triggers: [build, create, add, implement, fix, repair, patch, refactor, rewrite, modify, change, update, improve, optimize, review, audit, test, debug, document, deploy, ship, scaffold, setup, configure, install, migrate, design, plan, analyze, investigate, simplify, clean, verify, validate, check, explicar, explain, "show me", "muéstrame", "what is", "qué es", "how does", "cómo funciona", "what's in", "qué hay", list, lista, describe, describe, estructura, structure, overview, resumen, summary, crear, agregar, añadir, hacer, implementar, arreglar, reparar, refactorizar, reescribir, cambiar, modificar, actualizar, mejorar, optimizar, revisar, auditar, probar, testear, debuggear, documentar, desplegar, configurar, instalar, migrar, diseñar, planear, analizar, investigar, simplificar, limpiar, verificar, validar, "I need to", "I want to", "can you", "could you", "this folder", "this project", "in this repo", "puedo agregar", "me ayudas", "podes ayudarme", "como puedo", "como hago", "le pedi", "en esta carpeta", "este proyecto", "agent", "agents", "which agent", "what agent", "que agente", "subagent", "dispatch", "delegate", "skill", "skills", "route", "routing", "which skill", "what skill", "load", "knowledge"]
---

# Router

Decide which **subagent** to invoke and/or which **knowledge skill** to load for a user request. The pack ships 72 agents and 20 skills organized by purpose. This single skill provides the decision matrix so the primary agent doesn't have to scan all 92 descriptions.

> **This is the merged `agent-router` + `skill-router`.** When you needed both before, you load just this one now. Save ~10K tokens of skill content per turn.

## Trigger Conditions (load me when...)

**Default rule**: load this skill for ANY non-Q&A user request, even if no agent or skill is named explicitly. The pack's whole point is that the user shouldn't have to know what exists.

### Direct action verbs (always trigger)
- **English**: build, create, add, implement, fix, repair, patch, refactor, rewrite, modify, change, update, improve, optimize, review, audit, test, debug, document, deploy, ship, scaffold, setup, configure, install, migrate, design, plan, analyze, investigate, simplify, clean, verify, validate, check
- **Spanish**: crear, agregar, añadir, hacer, implementar, arreglar, reparar, refactorizar, reescribir, cambiar, modificar, actualizar, mejorar, optimizar, revisar, auditar, probar, testear, debuggear, documentar, desplegar, configurar, instalar, migrar, diseñar, planear, analizar, investigar, simplificar, limpiar, verificar, validar

### Natural-language patterns (trigger even without an action verb)
- **English**: "I need to...", "I want to...", "can you...", "in this folder...", "this project requires...", "we have to..."
- **Spanish**: "me ayudas con...", "puedes ayudarme a...", "como puedo...", "como hago para...", "en esta carpeta...", "este proyecto necesita...", "le pedi sobre un proyecto hacer alguna modificacion"
- **Context signals**: any folder/project mention + "modification" / "cambio" / "nueva feature" / "new feature" / "agregar algo" / "implementar algo" → strong work signal

### Meta-routing questions (also trigger)
- "what agent should I use for X" / "which agent handles Y" / "que agente uso para..."
- "what skill should I use for X" / "which skill" / "que skill uso para..."

### When NOT to load
- Pure Q&A without implementation intent
- User already named the agent or skill explicitly ("run `code-reviewer`", "load `api-design`")
- One-liner edit the primary can do directly (typo fix, single-line change)
- User said "skip routing" or "just do it" in the current turn

### Anti-patterns (DO NOT skip routing for these reasons)
- **"X is simple enough I can answer directly"** → WRONG. If the answer requires reading > 1 file, route. Reading = exploration = route.
- **"I'll just write a meta-analysis about how the work would be done"** → WRONG. The user asked for the work, not for an analysis of how the work would be done.
- **"The verb is 'analyze' / 'explore' / 'overview' so it must be Q&A"** → WRONG. These are non-Q&A — they imply reading files and producing a report. Route to `explore` or `code-explorer`.
- **"Duda si aplica o no"** → If you must read > 1 file or the request implies work, route. Single-file Q&A and pure explanations do not need routing.

### Free-tier override (applies when on OpenCode Zen free / any quota-limited plan)
- Subagent dispatches burn the free tier quota fast. Default to **zero subagents** if the request can be answered from AGENTS.md + the in-context system prompt alone.
- Greetings ("hola", "hi", "gracias"), pure Q&A, definitions, "qué es X", "cómo funciona", single-file lookups, and tasks where the user named the agent/skill explicitly → **answer directly, no router load, no subagent dispatch**.
- Only load `router` and dispatch when the task is unmistakably implementation/fix/review/refactor/plan/audit work AND needs >1 file read.
- "If in doubt, route" → on free tier, **if in doubt, answer directly**. The user can re-ask with a slash command (`/route`, `/prd`) if they want full dispatch.

## When to Activate

- The user request implies work beyond pure Q&A
- The user describes a need in natural language without naming an agent/skill
- The primary agent is unsure which subagent to dispatch or which skill to load
- The request matches a known intent (auth bug, plan migration, review PR, add validation, etc.)
- A new agent or skill has been added and the agent needs to know when to use it

## Routing Process

### Step 1 — Classify the Request

Extract from the user request:
- **Stage**: plan | implement | fix | review | test | refactor | audit | doc | ship
- **Domain**: ui | api | db | security | auth | infra | config | ci | data | ml | perf
- **Stack**: react | ts | python | go | rust | java | swift | flutter | csharp | cpp | php | kotlin | dart | fsharp
- **Risk**: data loss | security | production | safe

### Step 2 — Match Against the Catalogs Below

Pick the highest-priority match. Ties: prefer specialist over generalist.

### Step 3 — Invoke

For implementation work, ALWAYS layer with `planner` → `tdd-guide` → reviewer (stack-specific) before invoking. Never dispatch implementation directly to a generic agent.

---

# Agent Catalog (by purpose)

## Planning & Architecture

| Request | Primary agent | Alternates |
|---------|---------------|------------|
| "build X" / "add feature" (new work) | `prd-agent` | `planner`, `code-architect` |
| "plan implementation of X" | `planner` | `code-architect`, `architect` |
| "design the system" / architecture decision | `code-architect` | `architect`, `network-architect` |
| "explore how Y works" / map codebase | `code-explorer` | `code-architect` |
| "generate diagram of the system" | `diagram-generator` | `flow-visualizer` (skill) |
| "show database ERD" | `diagram-generator` | `db-schema-visualizer` (skill) |
| "review the PRD" | `prd-reviewer` | `planner` |
| "break down X into tasks" | `planner` | `task-decomposition` (skill) |
| "migrate X to Y" | `migration-planner` | `planner` |
| "generate spec for X" (autonomous loop) | `gan-planner` | `prd-agent` |

## Implementation & Build

| Request | Primary agent | Notes |
|---------|---------------|-------|
| "implement X" (after PRD/plan) | `build` (primary) | Routes to sub-agents as needed |
| "build fullstack app" | `fullstack-builder` | Generates complete frontend+backend+DB |
| "create MVP" / "scaffold project" | `fullstack-builder` | Quick project setup |
| "add auth" / "login system" | `auth-builder` | OAuth, JWT, sessions, roles |
| "integrate payments" / "stripe" | `payment-integrator` | Subscriptions, checkout, webhooks |
| "deploy to production" | `devops-deploy` | Docker, CI/CD, Vercel, Railway |
| "create mobile app" | `mobile-builder` | React Native, Expo, Flutter |
| "integrate API" / "connect service" | `api-integrator` | Third-party API integration |
| "supabase" / "RLS policy" / "migración SQL" | `supabase-builder` | Schema, Row Level Security, Edge Functions, Storage, Realtime, RPC |
| "graphql api" / "apollo server" | `graphql-builder` | GraphQL schemas and resolvers |
| "realtime" / "chat" / "websockets" | `realtime-builder` | WebSockets, SSE, live updates |
| "generate tests" / "write tests" | `testing-auto` | Auto-generate unit/integration/E2E |
| "migrate framework" / "modernize" | `legacy-modernizer` | Framework/language migration |
| "fix this build error" | `build-error-resolver` | Falls back to language-specific |
| Language-specific build error | `{lang}-build-resolver` | cpp, csharp, dart, django, go, java, kotlin, python, pytorch, react, rust, swift |
| "implement feature via autonomous loop" | `gan-generator` | Pairs with `gan-evaluator` |

## Review & Quality

| Request | Primary agent | Alternates |
|---------|---------------|------------|
| "review this code" / "code review" | `code-reviewer` (mode: full) | Stack-specific reviewer |
| "review this PR" | `code-reviewer` (mode: tests) | `code-reviewer` |
| "audit report vs PRD" | `report-auditor` | — |
| "security review" / "is this secure" | `security-reviewer` | `security-review` (skill) |
| "silent failures" / "error handling review" | `code-reviewer` (mode: silent-failures) | `error-handling` (skill) |
| "review comments / are docs accurate" | `code-reviewer` (mode: comments) | `doc-updater` |
| "review types / type design" | `code-reviewer` (mode: types) | Stack reviewer |
| "simplify this code" | `code-reviewer` (mode: simplify) | `refactoring-patterns` (skill) |
| "is this accessible" | `a11y-architect` | — |
| "review SQL / schema" | `database-reviewer` | — |
| "review ML code" | `mle-reviewer` | — |
| "review healthcare code" | `healthcare-reviewer` | — |
| "is this config correct" | `network-config-reviewer` | `network-architect` |

## Stack-specific Reviewers

Use these INSTEAD of `code-reviewer` when the stack is known:

| Stack | Agent |
|-------|-------|
| TypeScript / JS | `typescript-reviewer` |
| React / TSX | `react-reviewer` |
| Vue 3 / Nuxt | `vue-reviewer` |
| Svelte 5 / SvelteKit | `svelte-reviewer` |
| Python | `python-reviewer` |
| Go | `go-reviewer` |
| Rust | `rust-reviewer` |
| C++ | `cpp-reviewer` |
| C# | `csharp-reviewer` |
| Java | `java-reviewer` |
| Kotlin / Android | `kotlin-reviewer` |
| Swift / iOS | `swift-reviewer` |
| Flutter / Dart | `flutter-reviewer` |
| PHP | `php-reviewer` |
| F# | `fsharp-reviewer` |
| Django | `django-reviewer` |
| FastAPI | `fastapi-reviewer` |
| HarmonyOS | `harmonyos-app-resolver` |
| Terraform / Pulumi / CFN / Ansible | `iac-reviewer` |
| Kubernetes / Helm / Kustomize | `k8s-reviewer` |

## Test & QA

| Request | Primary agent | Notes |
|---------|---------------|-------|
| "write tests for X" / "TDD" | `tdd-guide` | Load `tdd-workflow` skill too |
| "run E2E tests" | `e2e-runner` | — |
| "improve test coverage" | `tdd-guide` | — |

## Refactor & Cleanup

| Request | Primary agent | Notes |
|---------|---------------|-------|
| "refactor X" / "clean up" | `refactor-cleaner` | Load `coding-standards` skill |
| "simplify this code" | `code-reviewer` (mode: simplify) | `refactoring-patterns` (skill) |
| "find dead code" | `refactor-cleaner` | — |
| "remove duplicate Y" | `code-reviewer` (mode: simplify) | — |

## Documentation

| Request | Primary agent | Notes |
|---------|---------------|-------|
| "update docs" / "regenerate codemaps" | `doc-updater` | — |
| "generate user manual" | `manual-writer` | After /verify + /audit-report PASS |
| "find docs for library X" | `docs-lookup` | Uses Context7 MCP |
| "find existing skill for X" | `find-skills` (skill) | — |

## Audit & Verification

| Request | Primary agent | Notes |
|---------|---------------|-------|
| "run full audit" / "audit everything" | `audit-orchestrator` | Orchestrates all dimensions |
| "audit report against PRD" | `report-auditor` | Single dimension |
| "security audit" | `security-reviewer` + `security-review` skill | — |
| "check compliance" (GDPR, SOC2, HIPAA) | `compliance-checker` (skill) | — |
| "audit dependencies" | `dependency-audit` (skill) | — |
| "validate API contract" | `api-contract-tester` (skill) | — |
| "check performance budget" | `performance-budget` (skill) | — |

## Domain Specialists

| Domain | Agent |
|--------|-------|
| Network design (enterprise) | `network-architect` |
| Network troubleshooting | `network-troubleshooter` |
| Home / small lab network | `homelab-architect` |
| Performance optimization | `performance-optimizer` |
| Marketing / copy / launch | `marketing-agent` |
| SEO | `seo-specialist` |
| GAN Harness loop | `gan-planner` + `gan-generator` + `gan-evaluator` |
| Autonomous loop operation | `loop-operator` |
| Harness tuning | `harness-optimizer` |

## Meta & Workflow

| Request | Primary agent | Notes |
|---------|---------------|-------|
| "triage my messages" / comms | `chief-of-staff` | — |
| "fork this for open source" | `opensource-forker` | Then `opensource-sanitizer`, `opensource-packager` |
| "sanitize the fork" | `opensource-sanitizer` | — |
| "package for open source release" | `opensource-packager` | — |
| "analyze conversation for hooks" | `conversation-analyzer` | — |
| "what did I learn" / pattern extraction | `learn` (skill) | — |

---

# Skill Catalog (by domain signal)

| If the request mentions... | Load |
|---------------------------|------|
| React, JSX, TSX, hooks, useState, useEffect, useMemo, useCallback, form, prop drilling, render, component, Suspense, Context | `frontend-patterns` |
| Express, FastAPI, NestJS, Spring, repository pattern, service layer, DI, dependency injection, transaction, controller, middleware, auth, validation | `backend-patterns` |
| REST, GraphQL, endpoint, route URL, status code, pagination, API contract, version, rate limit, API design | `api-design` |
| OpenAPI, swagger, contract, API spec, undocumented endpoint, response schema, status code mismatch | `api-contract-tester` |
| auth, password, JWT, session, CSRF, XSS, SQL injection, secret, OWASP, vulnerability, sanitize, CORS, encryption | `security-review` |
| test, TDD, RED, GREEN, REFACTOR, coverage, jest, pytest, vitest, mock, unit test, integration test | `tdd-workflow` |
| error, exception, try/catch, retry, circuit breaker, error message, log error, throw, error boundary | `error-handling` |
| library, framework, API docs, version, example code, latest, deprecated, alternatives | `documentation-lookup` |
| MCP, model-context-protocol, server, tool definition, resource, prompt, stdio | `mcp-server-patterns` |
| commit, branch, PR, merge, rebase, conflict, git workflow, cherry-pick, bisect, stash | `git-workflow` |
| verify, check, audit, validate, regression, post-change, after implementing | `verification-loop` |
| PRD, requirement, acceptance criteria, scope, objective, success criteria, intention map | `intent-driven-development` |
| task graph, dependency, DAG, parallel work, work breakdown, sprint, estimate | `task-decomposition` |
| naming, immutability, code quality, lint, formatting, KISS, DRY, YAGNI, complexity | `coding-standards` |
| refactor, refactoring, extract method, extract function, inline, rename, code smell, Fowler, codemod | `refactoring-patterns` |
| bug, debugging, reproduce, bisect, stack trace, hypothesis, root cause, incident, regression | `debugging-patterns` |
| log, logger, pino, winston, structlog, OpenTelemetry, metric, trace, health check, graceful shutdown | `observability` |
| terse, brief, less tokens, token efficiency, conciso, resumido, "habla menos", "modo caveman" | `caveman` |
| pack, opencode, agent, command, structure, layout, where does X go, where do PRDs go | `pack-reference` |
| npm, audit, dependency, dependencies, license, licenses, CVE, supply chain, vulnerable, outdated, abandoned | `dependency-audit` |
| diagram, flow, diagrama, flujo, sequence diagram, state diagram, architecture diagram, mermaid, flowchart, visual, visualize | `flow-visualizer` |
| schema, ERD, database, base de datos, tablas, relaciones, foreign key, prisma, drizzle, sequelize, typeorm, sqlalchemy, supabase | `db-schema-visualizer` |
| manual, usuario, user guide, user manual, handoff, entrega, end user docs, guía, release notes | `user-manual-generator` |
| performance, budget, LCP, FID, CLS, bundle size, load time, Core Web Vitals, threshold, metric, optimization, speed | `performance-budget` |
| compliance, GDPR, SOC2, HIPAA, PCI-DSS, CCPA, privacy, PII, PHI, consent, audit log, encrypted | `compliance-checker` |
| stripe, payment, checkout, subscription, billing, invoice, webhook, payment_intent | `stripe-integration` |
| clerk, authentication, sign-up, sign-in, user-management, organizations, mfa | `clerk-auth` |
| supabase, postgres, rls, realtime, storage, edge-functions, row-level-security | `supabase-patterns` |
| firebase, firestore, firebase-auth, cloud-functions, realtime-database, firebase-storage | `firebase-patterns` |
| docker, dockerfile, docker-compose, container, image, multi-stage, optimization | `docker-patterns` |
| github-actions, ci-cd, workflow, automation, deployment, actions | `github-actions` |
| vercel, deployment, serverless, edge, domain, preview, production | `vercel-deploy` |
| railway, deployment, paas, database, service, microservice | `railway-deploy` |
| turso, libsql, edge-database, sqlite, embedded-replica, global-database | `turso-libsql` |
| drizzle, orm, schema, migration, type-safe, query-builder, database | `drizzle-patterns` |
| "find a skill", "is there a skill for", extend capabilities, install skill | `find-skills` (global, `~/.agents/skills/`) |

---

# Decision Examples

| User says | Route |
|-----------|-------|
| "build a React form with validation" | `frontend-patterns` (skill) + `backend-patterns` (validation flow) + agent: `planner` → `tdd-guide` → `react-reviewer` |
| "add JWT auth to my Express API" | `backend-patterns` + `security-review` + agent: `prd-agent` → `planner` → `security-reviewer` |
| "review this code" | `code-reviewer` (or stack-specific) + `coding-standards` (skill) + `error-handling` (skill) |
| "fix build error in Go" | `go-build-resolver` (NOT general `build-error-resolver` first) — no skill needed |
| "how do I use Prisma" | `documentation-lookup` (Prisma → Context7) |
| "write tests for this function" | `tdd-workflow` + `tdd-guide` (agent) |
| "plan a DB migration" | `task-decomposition` + `migration-planner` (agent) |
| "fix this git conflict" | `git-workflow` + `merge-conflict` (command) |
| "is this endpoint secure" | `security-review` + `api-design` + `security-reviewer` (agent) |
| "agregar auth con JWT" | `prd-agent` → `planner` → `backend-patterns` + `security-review` → `tdd-guide` → `security-reviewer` |
| "fix el bug en login" | `planner` (repro) → `tdd-guide` (failing test) → `build` → stack reviewer + `debugging-patterns` |
| "como se hace X en React" | `frontend-patterns` + `docs-lookup` |
| "triage my email" | `chief-of-staff` |
| "open source this app" | `/opensource-pipeline` command (orchestrates `opensource-forker` → `opensource-sanitizer` → `opensource-packager`) |
| "audit dependencies for CVEs" | `dependency-audit` + `security-reviewer` (agent) |
| "check if my API matches the OpenAPI spec" | `api-contract-tester` + `api-design` |
| "generate a diagram of the system" | `flow-visualizer` + `code-explorer` (agent) |
| "show me the database ERD" | `db-schema-visualizer` |
| "generate user manual" | `user-manual-generator` + `doc-updater` (agent) |
| "check GDPR compliance" | `compliance-checker` + `security-reviewer` (agent) |
| "validate performance budget" | `performance-budget` + `performance-optimizer` (agent) |

---

# Anti-Patterns

- **Don't dispatch implementation directly to a generic agent.** Use `planner` + `tdd-guide` first.
- **Don't load 5+ agents or 5+ skills for one request.** Top 1-3 each.
- **Don't skip the planner for non-trivial work.** Anything touching >1 file needs a plan.
- **Don't use `code-reviewer` for stack-specific code.** Use `{stack}-reviewer`.
- **Don't invoke `build-error-resolver` for specific languages.** The lang-specific resolver is faster and more accurate.
- **Don't load this router for pure Q&A.** The primary agent answers directly.
- **Don't use `prd-agent` for small fixes.** Use `/quick-prd` flow or skip PRD entirely.
- **Don't load all 20 skills.** Pick the top 1-3 by trigger match.
- **Don't load a skill that doesn't match** (e.g. `frontend-patterns` for a deploy request just because "config" is a shared trigger).

---

# Agent + Skill Pairing (typical)

Most agent invocations benefit from a paired skill:

| Agent | Pair with skill |
|-------|-----------------|
| `{stack}-reviewer` | `coding-standards`, `error-handling` |
| `security-reviewer` | `security-review`, `backend-patterns` |
| `tdd-guide` | `tdd-workflow` |
| `planner` | `intent-driven-development`, `task-decomposition` |
| `prd-agent` | `intent-driven-development` |
| `code-architect` | `frontend-patterns` or `backend-patterns` (whichever applies) |
| `doc-updater` | (no skill needed) |
| `refactor-cleaner` | `coding-standards` |
| `docs-lookup` | (uses Context7 MCP) |
| `debugging` / incident | `debugging-patterns`, `observability` |

---

# Integration

- `/route <request>` — command-level superset (routes across commands, agents, AND skills)
- `/list-agents <keyword>` — browse the full agent catalog
- `/list-skills` — browse the full skill catalog
- `.opencode/AGENTS_INDEX.md` — auto-generated full index of all agents (count via `node .opencode/bin/counts.js`)
- `.agents/skills/INDEX.md` — auto-generated full index of all skills
- This skill replaced `agent-router` + `skill-router` (merged in pack 1.1 — see CHANGELOG)
