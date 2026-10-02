# Changelog

All notable changes to this starter pack are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/), and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Full-stack Builder Agents (2026-09-21)

Added 10 new agents and 10 new skills for complete application building, not just reviewing.

### Added
- **`fullstack-builder`** agent — generates complete frontend + backend + database stacks (Next.js, React, Vue, Supabase, PostgreSQL)
- **`auth-builder`** agent — implements authentication systems (NextAuth, Clerk, Auth0, Supabase Auth, Firebase Auth)
- **`payment-integrator`** agent — integrates payment providers (Stripe, PayPal, MercadoPago) with subscriptions and webhooks
- **`devops-deploy`** agent — Docker, CI/CD, deployment to Vercel/Railway/AWS
- **`mobile-builder`** agent — React Native, Expo, Flutter, Swift app creation
- **`api-integrator`** agent — third-party API integration (Stripe, Twilio, SendGrid, Resend, OpenAI)
- **`graphql-builder`** agent — GraphQL APIs with Apollo Server, Yoga, Pothos
- **`realtime-builder`** agent — WebSockets, SSE, live updates, chat
- **`testing-auto`** agent — automated test generation (unit, integration, E2E)
- **`legacy-modernizer`** agent — framework/language migration (Angular→React, JS→TS, etc.)
- **`stripe-integration`** skill — Stripe patterns for payments, subscriptions, webhooks
- **`clerk-auth`** skill — Clerk authentication patterns
- **`supabase-patterns`** skill — Supabase database, auth, realtime, storage
- **`firebase-patterns`** skill — Firebase Firestore, Auth, Storage, Cloud Functions
- **`docker-patterns`** skill — Docker multi-stage builds, optimization, compose
- **`github-actions`** skill — CI/CD workflows, testing, deployment
- **`vercel-deploy`** skill — Vercel deployment, serverless, edge functions
- **`railway-deploy`** skill — Railway deployment and database setup
- **`turso-libsql`** skill — Turso/libSQL edge database patterns
- **`drizzle-patterns`** skill — Drizzle ORM type-safe queries, migrations
- **Supabase MCP** — database, auth, storage access via MCP
- **Vercel MCP** — deployment and project management via MCP
- **Stripe MCP** — payment management via MCP

### Changed
- **`router`** skill updated with new agent and skill routing rules
- **`opencode.json`** — added Supabase, Vercel, Stripe MCPs
- **README.md** — updated counts (83 agents, 40 skills, 4 MCPs)

### Token consumption optimization (2026-08-12) — PRD: `docs/prds/2026-08-12-optimize-pack-token-consumption.prd.md`

Cut boot/turn token usage for OpenCode Zen free tier: AGENTS.md 61→25 lines (7.2KB→3.0KB, -58%), MCPs closed by default, plugins conservative, `/tone` + `/mcp-on`/`/mcp-off` commands, measurable via `measure-tokens.js` (-71% estimated boot vs baseline).

### Changed
- **`.opencode/AGENTS.md`** compacted 61 → 25 lines (-58% bytes). Prompt Defense Baseline kept **verbatim**; 9 mandatory behaviors now 1-line rules with pointers to on-demand skills (`caveman`, `intent-driven-development`, `git-workflow`, `verification-loop`, `task-decomposition`, `router`, `pack-reference`, `security-review`, `tdd-workflow`, `testing-patterns`). Security guidelines collapsed to 1 line + `security-review` skill pointer.
- **`opencode.json`** — removed `mcp` block: `context7` and `playwright` no longer auto-load (were always-on). Plugin list unchanged. `default_agent`, `permission`, `tool_output`, `compaction` untouched.
- **`.opencode/mcp.optional.json`** — `context7` and `playwright` added to the optional catalog; all MCPs are now opt-in via `/setup-mcp`, `/mcp-on`, `/mcp-off`.
- **`.opencode/dcp.json`** (new) — DCP in conservative mode: `manualMode.enabled: true` (no auto-compress nudges), `automaticStrategies: true` (dedup + purgeErrors still save tokens), soft nudge force, high context limits (80k/160k).
- **`.opencode/vibeguard.config.json`** (new) — `enabled: false` by default (plugin no-op per its README). Enable by flipping to `true` or deleting the file.

### Added
- **`/tone <lite|full>`** command — switch primary agent communication density. Default `lite`; auto-escalates to `full` on multi-step keywords (`planificar|implementar|refactorizar|desplegar|auditar|migrar` + length >120 chars), then returns to `lite`.
- **`/mcp-on <name>`** / **`/mcp-off <name>`** commands — toggle optional MCPs at runtime (patch `opencode.json`, restart required).
- **`.opencode/bin/measure-tokens.js`** — zero-dep estimator: reports AGENTS.md/MCP/plugin boot tokens vs baseline, savings %, and `--scenario=greeting` asserting ≥40% greeting reduction (NFR-008). Exit 0/1.

### Measured (this pack)
- AGENTS.md: 7192 → 2997 bytes (25 lines)
- Estimated boot: ~2948 → ~849 tokens (**-71%**, goal ≥40%)
- MCPs: 2 always-on → 0 default
- vibeguard: ON → off; dcp: auto → manual/conservative
- Per-turn input: **tail_turns 5→2** + **tool_output 150/8192→60/4096** (see below)

### Per-turn reduction (2026-08-12, follow-up) — addresses Zen free-tier quota
User-reported: paid-tier dashboard showed ~64–75K input tokens per request (5–10× normal). Root cause: conversation history + tool outputs re-injected each turn. Fix tightens two `opencode.json` knobs:

- **`compaction.tail_turns`**: 5 → 2 (only last 2 turns kept verbatim; older turns compacted sooner).
- **`tool_output.max_lines` / `max_bytes`**: 150/8192 → 60/4096 (any tool output above this is truncated before being re-sent in history).

**Expected per-request reduction 10–20K input tokens** (verified by user after restart; session `VyHnkcPo` will show lower `ENTRADA` next turn).

### Fixed — plugin crash (2026-08-12, follow-up)
- **`.opencode/plugins/hookify.js`** — module was exporting `{ SecretBlocker, DestructiveWarner }` (an object), but the opencode plugin contract requires a factory function `(input, options?) => Promise<Hooks>`. Plugin silently failed to load every session; the two security hooks (secret-file blocker, destructive-command warner) were dead. Refactored to a single factory that returns one combined `tool.execute.before` handler dispatching to both. Verified load succeeds: `export type: function, hooks: ['tool.execute.before']`.

### Fixed — Mandatory routing drained Zen free quota (2026-08-12, follow-up)
User-reported: "Free usage exceeded, subscribe to Go" triggered on every project that loaded this pack, even on greetings ("hola") — but not when the pack was absent. Root cause: AGENTS.md behavior #8 was **Mandatory routing** ("dispatcha 1-3 sub-agentes + 1-2 skills **antes de responder**; leer >1 archivo = SIEMPRE route"). Every primary turn spawned 1–3 subagent sessions (each = its own LLM call + small-model title generation), multiplying API requests per turn and exhausting the Zen free tier quota in seconds. Log evidence: `general 1428 / explore 311 / tdd-guide 157 / prd-agent 98 / code-explorer 95 / planner 89` subagent streams over a single day.

- **`.opencode/AGENTS.md`** rule #8: **Mandatory routing → Conditional routing**. Default zero subagents. Greetings, Q&A, one-liners, "qué es X", and explicit agent/skill mentions are answered directly. Router loads only for unmistakable implementation/fix/review/refactor/plan/audit work that needs >1 file read.
- **`.opencode/agents/build.md`** description + "What it does" updated to reflect conditional routing (Q&A → no dispatch).
- **`.agents/skills/router/SKILL.md`** — added a "Free-tier override" section: on quota-limited plans, "if in doubt, answer directly". Existing "When NOT to load" already covered the cases; the new override makes the default explicit instead of "if in doubt, route".

**Expected per-turn reduction**: 1–3 subagent dispatches → 0 for Q&A/greetings; for work tasks, 1 dispatch only when the match is clear (vs the previous always-3). Estimated savings: 60–80% on the per-turn request count on Zen free tier.

### Fixed — Zen free-tier burst throttling in pack-loaded projects (2026-08-12, follow-up)

User-reported symptom: big-pickle works in bare projects (`mcdyd`) but "Free usage exceeded, subscribe to Go" in the pack project, even on "hola". Empirically bisected via `opencode run --model opencode/big-pickle` across directories: same account, same model, same minute → pack project FAILs, bare project OK, full pack copy under `/tmp` (different projectID) OK. `--pure` (plugins off) still FAILs. Conclusion: Zen free tier enforces a **per-project/workspace rolling request limit** (free models ≈ 50 req / 5h window; retries + title generation + subagent dispatches all count). The pack burned the project's allowance by spawning 1–3 subagents per turn (mandatory routing). Once tripped, every request in that project — including the tiny title call — is rejected until the window rolls over. Human-paced usage recovers (observed 29 consecutive successful big-pickle streams after the window reset).

Changes (reduce per-session request count and boot payload so the project stays under the free-tier window):

- **`.opencode/skill`** (symlink → `.agents/skills`) **removed** — opencode was registering every skill twice (one per path), doubling skill metadata and discovery. `git` records the deletion.
- **`opencode.json`** — `mcp` block reduced to a single active MCP: **`context7`** (user decision — keeps the boot context small by being the only MCP; no `playwright`). All other MCPs live in `.opencode/mcp.optional.json` (opt-in via `/setup-mcp` / `/mcp-on`).
- **`.opencode/plugins/hookify.js`** — verified it loads cleanly as a plugin factory (auto-discovered from `.opencode/plugins/`); no model calls, purely `tool.execute.before`.

Net effect on `/open`: fewer requests per turn (conditional routing), no duplicate skill registration, single-MCP boot. big-pickle now survives the free-tier window under normal human-paced usage.

### Fixed — ROOT CAUSE: custom primary agent `build.md` breaks Zen free models (2026-08-12)

The burst-throttling fixes above reduced usage but did NOT stop the failures. Fresh copies of the pack in clean projects (Flutter/Nest) still failed with free models while bare projects worked. Systematic bisection via `opencode run --model opencode/big-pickle` on a minimal repo (`opencode.json` + `AGENTS.md` + agents) isolated the trigger:

- 72 minimal subagents → OK
- 72 minimal subagents + a `build.md` file (custom primary) → **FAIL** ("Rate limit exceeded")
- `mode: primary` or not, renamed to `bob` or `build` → **FAIL** whenever a custom primary agent file exists
- Repeated A/B (50s gaps, interleaved): no-`build.md` OK / with-`build.md` FAIL, 6+ times, deterministic.

Request capture (local MITM) showed the difference is the **system prompt**: custom primary → `# build\nDo nothing.\nYou are powered by...` (≈8KB); built-in primary → standard opencode system prompt `You are opencode, an interactive CLI tool...` (≈16.5KB). Tools/max_tokens/tool_choice identical. Conclusion: the OpenCode Console free tier recognizes requests by the standard opencode system prompt; a custom primary agent sends a non-standard system prompt and is treated as a third-party client → strict API rate limit ("Rate limit exceeded") instead of the free-tier allowance. This is why the pack failed everywhere it was installed while `mcdyd` (default `build` agent) always worked.

Fix:

- **`.opencode/agents/build.md` moved to `.opencode/agents-backup/build.md`** (outside the scanned `agents/` dir). `default_agent: build` now resolves to opencode's built-in `build` agent, which keeps the standard system prompt. The pack's behavior (9 mandatory behaviors, conditional routing, prompt-defense baseline, pointers) is preserved because it lives in `AGENTS.md`, injected via `opencode.json` `instructions` into every agent — it does NOT need a custom primary file.
- `opencode.json` untouched for model selection (user still picks the model).
- Verified: `opencode run --model opencode/big-pickle "hola"` in `/home/marcelo/dev/open` → OK.

## [1.2.0] — 2026-07-28

PROJECT.md workflow: pack-resident template + CLI with auto-bootstrap. Closes the gap where AGENTS.md behavior #9 ("Always-On Project Context") was documented but not auto-wired.

### Added
- **`.opencode/templates/PROJECT.md.template` v2.1** — 16 sections (13 always + 3 conditional: Data Model, API Surface, Dependencies), 5 marker types (`auto`, `manual`, `auto-managed`, `auto+manual`, `conditional:KEY`), header status indicator (`{STATUS_EMOJI} {STATUS_LABEL} ({AGE_TEXT})` — 🟢/🟡/🔴/⚪), Recent Activity with file links, Build & Run section auto-detected from package.json/Makefile/justfile, Glossary section for domain terms. Source of truth for `docs/PROJECT.md` regeneration.
- **`.opencode/bin/project-init.js`** — template-driven PROJECT.md generator (~430 lines, zero deps, CommonJS, cross-platform). Detects from 5 sources: project files (package.json, pyproject.toml, Cargo.toml, go.mod, pubspec.yaml), git (remote + conventional commits), `docs/` (PRDs/plans/audits/sessions for Recent Activity), pack catalog (for opencode-pack detection), and an opencode-pack heuristic (`.opencode/` + `.agents/` + `opencode.json` + pack artifacts). Special handling for opencode packs: uses directory basename as Name, prefixes description with "opencode starter pack — ...", sets Framework = "opencode", includes live counts in Directory Layout.
- **`--ensure` mode** — auto-bootstrap mode for AGENTS.md behavior #9. Runs `--check`; if `PROJECT.md` is missing → runs `--init`; if stale (>7d) → runs `--refresh`; if fresh → no-op (exit 0). All output to stderr so it doesn't pollute agent stdout. The trigger point for the primary agent's "always-on project context" guarantee.
- **`/project-init` command** — thin slash command wrapper around `project-init.js` with a mode-detection table. Default is `--ensure` (auto-bootstrap). Explicit modes: `init`, `init --force`, `refresh`, `status`, `check`, `dry-run`, `event <type> <name> [meta]`.

### Changed
- **AGENTS.md behavior #9** now points to `node .opencode/bin/project-init.js --ensure` (was: `refresh-project.js --auto`). The old `refresh-project.js` is preserved but deprecated for this purpose. Manual sections preserved across `--refresh` / `--ensure`: Non-Negotiables, Architecture Notes, Open Questions, Glossary, plus Build & Run / Conventions overrides after `<!-- Override -->`.

### Applied to this pack
- `node .opencode/bin/project-init.js --refresh` ran successfully: wrote 5318 bytes to `docs/PROJECT.md`, 4 Recent Activity entries detected (2 plans, 2 audits), manual sections preserved (Non-Negotiables: License, Open Questions: "(none — starter context)"), Architecture Notes cleaned (was ` ``` ` placeholder, now template placeholder).

### Gates final
- smoke-test: 20 PASSED, 0 WARN, 0 FAIL
- validate-frontmatter: 388 PASSED, 0 WARN, 0 FAIL (was 386: +1 new command, +1 new CLI frontmatter)
- project-init --status: `🟢 fresh (19h ago)`
- project-init --ensure: exits 0 in all 3 cases (fresh, missing, stale)

## [1.1.0] — 2026-07-27

Pack 1.1 polish: bug fixes, drift cleanup, scaffolding. **+1 primary, -11 trivial commands, -2 +1 skills (router merge), +4 CLIs, ~62% lighter boot-time `AGENTS.md`.** Full plan: `docs/plans/2026-07-27_1122-pack-1.1-polish.plan.md`. Gates final: `smoke-test.js` 20/0/0, `validate-frontmatter.js` 386/0/0.

### Changed
- **Merged `agent-router` + `skill-router` into single `router` skill** (pack 1.1 polish). Single 240-line SKILL.md covers both agent selection matrix (72 agents) and skill selection matrix (20 skills) plus pairing table. Saves ~10K tokens per non-Q&A turn. Old skill dirs deleted. References in `AGENTS.md`, `manual/`, `commands/`, `examples/` updated. System prompt will reflect this on next opencode session (auto-discovery). If you have local code referencing `agent-router` / `skill-router`, rename to `router`.
- **Converted `build.md` from marker to real primary agent** (M1). Previously a no-op marker file referenced by 40 slash commands as `agent: build` — the file had `permission: deny` on every tool. Now `mode: primary` with full tool access + a 30-line body describing what the primary does (routes requests, executes meta-workflows, enforces 9 mandatory behaviors). Affects 39 commands that were implicitly falling back to the system default — they now route to this explicit primary with documented behavior. Only `/prd` was re-pointed to `prd-agent` (the one body that explicitly delegated).
- **Slimmed `AGENTS.md` from 155 → 59 lines (-62%)** (M2). Each of the 9 mandatory behaviors is now a 1-line rule + pointer to the skill/cmd that holds the detail (`caveman`, `intent-driven-development`, `git-workflow`, `verification-loop`, `task-decomposition`, `router`). Saves ~1.2KB boot tokens. Kept inline: prompt-defense baseline (GLOBAL, can't move), security guidelines (CRITICAL), tool truncation (CRITICAL). Reference material that was mixed in is now in the `pack-reference` skill (on-demand).
- **`.opencode/AGENTS.md` is now a marker comment + link** in some downstream contexts. Self-referential reference to itself in the marker is intentional and short-circuits the read.

### Fixed
- **Stale "33/65" numbers in `build.md` marker comment** (C1) — actual counts are 40/72. Replaced with auto-generated numbers via `counts.js`.
- **`code-reviewer.md` had `bash: deny`** (L6) — reviewer agents need to run their own smoke tests, `git diff`, `tsc --noEmit`, etc. Changed to `bash: allow`.
- **72 agent files had `§ Prompt Defense` line in 3 encodings** (C2): 50 were non-utf-8 with correct content, 13 were utf-8 with `·` or `�` instead of `§`, 1 (`report-auditor.md`) had no line at all. All 72 now have the canonical `§ Prompt Defense Baseline: see INSTRUCTIONS.md § Prompt Defense Baseline (GLOBAL)` line in UTF-8. Plus 24 agent files had 284 double-encoded em-dash (`—`) characters and 1 had triple-encoded em-dash + Windows-1252 control chars — all cleaned.
- **9 broken skill cross-references in agent bodies** (C3a): `python-patterns`, `mle-workflow`, `fsharp-testing`, `dotnet-patterns`, `csharp-testing`, `swift-concurrency-6-2`, `swiftui-patterns`, `swift-protocol-di-testing`, `swift-actor-persistence`, `e2e-testing`, `laravel-patterns`, `laravel-security`, `laravel-tdd`, `postgres-patterns`, `database-migrations`. All re-pointed to existing skills (`backend-patterns`, `coding-standards`, `testing-patterns`, `security-review`, `tdd-workflow`, `task-decomposition`, `frontend-patterns`). One ref in `typescript-reviewer.md` acknowledged it didn't ship; rewording applied.
- **Added `validateBodySkillRefs()` to `validate-frontmatter.js`** (C3b). New check finds `skill(s):` keyword, extracts backticked names from rest-of-line, warns on missing skills against `.agents/skills/` catalog. Caught 5 more broken refs the original audit missed (laravel/postgres/db) and is now durable. Currently 25 body-refs, all valid.

### Added
- **`counts.js` — single source of truth for pack surface-area numbers** (H1). Scans filesystem for agents/commands/skills/CLIs/plugins/MCPs and emits JSON. `--update <files...>` injects/replaces a `## Counts` block (between `<!-- COUNTS-START -->` / `<!-- COUNTS-END -->` markers) in any markdown file. `--check` mode exits non-zero if any tracked file is stale. Both `build-agents-index.js` and `build-skills-index.js` now use `counts.compute()` for their footers — no more hardcoded numbers that drift.
- **`.opencode/AGENTS.md` is now ~1.2KB lighter at boot** — see M2 above.
- **3 scaffolders** (M3) for downstream extension without hand-writing frontmatter:
  - `node .opencode/bin/scaffold-new-project.js <name>` + `/new-project` — creates `docs/{prds,plans,reports,audits,sessions,state,instincts}/` + `PROJECT.md` template + `docs/README.md` index
  - `node .opencode/bin/scaffold-new-skill.js <name>` + `/new-skill` — creates `.agents/skills/<name>/SKILL.md` with frontmatter (name, description, triggers) + 8-section body template
  - `node .opencode/bin/scaffold-new-agent.js <name>` + `/new-agent` — creates `.opencode/agents/<name>.md` with frontmatter (description, mode, permission block) + prompt-defense reference + body template
  - All support `--help`, `--dry-run`, `--force`, validate names against `/^[a-z][a-z0-9-]*$/`, validate mode against `subagent|primary`, refuse to overwrite by default, print next steps.
- **10 optional MCP templates** in `.opencode/mcp.optional.json` (was 2, +8). Grouped by 5 categories: `code-hosting` (github, gitlab), `data` (postgres, filesystem), `observability` (sentry), `productivity` (linear, notion, slack), `web` (brave-search, fetch). `setup-mcp.js` now groups display by category and defaults `type: local` from `_meta.defaults` (removed 10 redundant `"type": "local"` fields). `_meta.schema_version: 2`.

### Removed
- **11 trivial 5-line command wrappers** (H3): `cpp-build`, `cpp-review`, `cpp-test`, `flutter-build`, `flutter-review`, `flutter-test`, `kotlin-build`, `kotlin-review`, `kotlin-test`, `python-review`, `react-review`. Each was a 1-line dispatch alias to a resolver agent — the `router` skill already does this dynamically. Kept 4 useful dispatch wrappers: `model-route`, `quality-gate`, `react-build`, `react-test`. Commands: 72 → 61 → 64 (after +3 scaffolders).
- **2 skills merged into 1**: `agent-router` and `skill-router` deleted (see "Changed"). Skills: 21 → 20.

### Surface (1.1.0)
```
agents:         72  (unchanged)
commands:       64  (was 72: -11 trivial, +3 scaffolders)
skills:         20  (was 21: -1 from router merge)
clis:           13  (was 9: +counts, +3 scaffolders)
plugins:         4  (3 npm + 1 local, unchanged)
mcps:           12  (2 active + 10 optional, optional was 2)
```

### Added
- **Agent `angular-reviewer`**: Angular code reviewer (RxJS, signals, OnPush, DI, zone.js, template type-checking, accessibility). Pair con `typescript-reviewer` para PRs con `.ts`/`.html` Angular. Cubre el gap de frontend coverage (Angular faltaba aunque `reports/templates/angular.md` ya existía).
- **Agent `angular-build-resolver`**: Diagnostica y fixa Angular build errors con cambios mínimos. Cubre ng build / ng serve / ng test / Ivy / esbuild builder / SSR / Angular CLI workspace errors. Surgical fixes, no refactor.
- **Agent `incident-responder`**: On-call helper. Lee logs (de Sentry/Datadog/CloudWatch si MCP está activo), encuentra regresión, sugiere fix, escribe postmortem. Distinto de `silent-failure-hunter` (que es estático sobre código) — este es dinámico, time-sensitive, con runbook awareness.
- **Skill `observability`**: Patterns de logging estructurado (pino/winston/structlog/logrus/zap), OpenTelemetry tracing, métricas (prom-client/Datadog/CloudWatch), health checks (`/health`, `/ready`, liveness vs readiness), graceful shutdown, error tracking (Sentry SDK patterns). Hueco grande cubierto — antes `security-review` cubría pitfalls pero no patterns de implementación.
- **Optional MCPs (template opt-in)**: GitHub MCP (`@modelcontextprotocol/server-github`) y Postgres MCP (`@modelcontextprotocol/server-postgres`) definidos como templates en `.opencode/mcp.optional.json`. **No se cargan por default** — el user los activa con `/setup-mcp <github|postgres|both>`, que pide los tokens/DSN y patchea `opencode.json`. Rationale: 100% del value cuando lo necesitás, 0% del costo (no boot lento, no leaks de tokens) cuando no.
- **Optional MCPs expanded (2 → 10 templates)**: agregados 8 templates más en `.opencode/mcp.optional.json` para cubrir los use cases más comunes: `filesystem` (allowlisted FS access fuera del project root), `sentry` (error tracking query), `linear` (issue tracking), `notion` (docs/knowledge base), `slack` (workspace comms triage), `brave-search` (web search para info reciente fuera del training data), `fetch` (HTTP genérico con HTML→markdown), `gitlab` (alternativa a GitHub para self-hosted/gitlab.com). Todos siguen el mismo shape: `package` + `type: local` + `command` (con `${ENV_VAR}` interpolation) + `env` con `{description, secret, required}` + `use_when` con trigger phrases. `setup-mcp.js --list` los muestra todos sin cambios al binario. Total: 10 templates opt-in, 0 cargados por default. `opencode.json` no se toca salvo activación explícita.
- **Command `/setup-mcp`**: wizard interactivo para activar MCPs opcionales. Lee `mcp.optional.json`, lista los disponibles, pide al user qué activar y colecta secretos. Patches `opencode.json` y verifica que arranque. Reversible con `node .opencode/bin/setup-mcp.js disable <name>`.
- **Command `/list-mcps`**: lista los MCPs disponibles en este proyecto (activos desde `opencode.json` + opcionales desde `mcp.optional.json`) con type, command, env vars, use-when, y línea de activación. Reemplaza el `_optional_mcps` metadata block que rompía Zod strict validation.
- **Command `/context-budget`**: wrap del `bin/context.js` CLI existente. Reporta skills inventory, agents/commands/sessions counts, project size, y recomendaciones para mantener el context window liviano. Antes `context.js` era orphan utility (sin wiring) — ahora es invocable.
- **Skill `testing-patterns`**: patrones de testing por stack (jest/pytest/go/junit/swift): AAA, test doubles, mocking, builders, integration con testcontainers, E2E con Playwright, parameterized tests, coverage strategy, anti-patterns. Complementa `tdd-workflow` (metodología) con patterns concretos.
- **Skill `refactoring-patterns`**: catálogo Fowler (Extract/Inline/Rename/Move/Replace Conditional with Polymorphism/etc), code smells reference, red-green-refactor, tools (jscodeshift/codemod). Antes el pack tenía `refactor-cleaner` agent pero cero knowledge sobre qué refactor aplicar.
- **Skill `debugging-patterns`**: diagnostic workflow, logging strategies, correlation IDs, interactive debugging, profiling (CPU via perf/py-spy/pprof/clinic.js, memory via heap snapshots, I/O), postmortem templates, common bug categories. Hueco grande — el pack tenía `incident-responder` agent (producción) pero nada sobre debugging local.
- **Agent `code-quality-analyzer`**: consolida 5 micro-reviewers (`comment-analyzer`, `code-simplifier`, `silent-failure-hunter`, `type-design-analyzer`, `pr-test-analyzer`) en un agente con 5 modos seleccionables: `comments`, `tests`, `silent-failures`, `types` (todos read-only, advisory) + `simplify` (único modo con edit). 4 modos advisory NO editan sin aprobación explícita. Net: 72→68 agents, menos surface area, mismo coverage.
- **Command `/opensource-pipeline`**: orquesta las 3 etapas existentes (`opensource-forker` → `opensource-sanitizer` (gate) → `opensource-packager`) con gate automático: si sanitizer verdict es FAIL → para. Si PASS-WITH-WARNINGS → pide confirmación. Si PASS → continúa. NO pushea a GitHub — el user hace push manual post-review. Hard rules documentadas: nunca skip sanitize, nunca push, nunca borrar source. Antes los 3 agents existían pero no había orchestrator (descripciones referenciaban un "opensource-pipeline skill" inexistente).
- **Agent `iac-reviewer`**: Infrastructure-as-Code reviewer para Terraform / OpenTofu / Pulumi / CloudFormation / CDK / Ansible. Caza 0.0.0.0/0 en SSH/RDP/database ports, IAM wildcards, state file en bucket público, secrets hardcoded, missing encryption, módulos sin version pin, sin `terraform plan` en CI, AMI hardcoded, sin `default_tags`. 9 CRITICAL + 13 HIGH + 8 MEDIUM. Diferencia clara de `network-config-reviewer` (que es para router/switch ACLs) y `security-reviewer` (app-layer). Pair con `k8s-reviewer` para IaC + K8s en el mismo PR.
- **Agent `k8s-reviewer`**: Kubernetes / Helm / Kustomize reviewer. Caza `privileged: true`, host namespaces, root sin justificación, `clases.SYS_ADMIN`/`ALL`, secrets en ConfigMap, `image: latest` + `pullPolicy: Always`, sin `resources.requests/limits`, sin `NetworkPolicy`, automounted SA tokens, `livenessProbe` con external deps, Helm `default ""` hiding misconfig, Kustomize `commonLabels` rompiendo selector immutability. 8 CRITICAL + 11 HIGH + 9 MEDIUM. Pair con `iac-reviewer` cuando el PR toca cloud provider resources + workloads.
- **Pack examples (`.opencode/examples/`)**: 3 minimal downstream demos que ejercitan el pack end-to-end. Cada uno es runnable, tiene tests passing out of the box, y un README con "Suggested exercises" para probar workflows específicos del pack.
  - `01-node-api/` — Node 20 + TypeScript (strict) + Fastify + `node:test`. Demos: `tdd-guide`, `typescript-reviewer`, `code-quality-analyzer` (simplify), `/quick-prd`, `/verify`, `/flow-bugfix`. 4 tests passing.
  - `02-python-data/` — Python 3.11 + FastAPI + SQLite + pytest + ruff. Demos: `tdd-guide`, `python-reviewer`, `database-reviewer`, `security-reviewer`, `/flow-bugfix`. 4 tests passing.
  - `03-react-app/` — React 18 + Vite 5 + TypeScript (strict) + Vitest + Testing Library + jsdom. Demos: `tdd-guide`, `react-reviewer`, `a11y-architect`, `performance-optimizer`, `/flow-bugfix`. 3 tests passing.
  - Top-level `examples/README.md` explica cómo elegir demo según stack + tabla de qué pack surface ejercita cada uno.
  - Total: 33 files (10-11 per demo + 1 top-level README). Pensados para borrarse tras grokking el pack.
- **Local plugin `.opencode/plugins/hookify.js`**: 2 production hooks auto-cargados por opencode, zero install. **SecretBlocker** (strict, `tool.execute.before` en edit/write) bloquea writes a `.env`, `*.key`, `*.pem`, `id_rsa*`, `.aws/credentials`, `.kube/config`, `secrets/`, etc. Allowlist para `.env.example|.sample|.template` (convención de commit). **DestructiveWarner** (soft, `tool.execute.before` en bash) detecta `rm -rf /<path>`, `rm -rf ~`, `rm -rf ../`, `git push --force`, `git reset --hard`, `DROP TABLE`, `TRUNCATE`, `DELETE FROM <x>;`, `mkfs`, `dd to /dev/`, `shutdown`/`reboot`/`halt` y loguea a `.opencode/logs/destructive.log` (gitignored). No bloquea — el user confirma via flujo normal de opencode. 46/46 tests pass (positive + negative cases). Complementa el baseline de AGENTS.md (consentimiento explícito para acciones destructivas) con un audit trail objetivo.
- **AGENTS.md compression**: 35.5KB → 20.2KB (43% reduction, 802 → 278 lines). Cortes principales: code examples (2-3 per section → 1 line reference a skill), tablas de "Approve/Warning/Block" reescritas inline, secciones redundantes consolidadas (Reinicio, Verificacion, Success Metrics, Common Patterns cortadas — info generica ya cubierta por skills), `Mandatory Security Checks` 8 bullets → 1 linea con `·` separators, estructura tree slimmed (cada path comment mas corto). 9 comportamientos obligatorios preservados verbatim (son el corazon del pack). Counts actualizados a 68 agents / 72 commands / 20 skills. Plugin local hookify referenciado en seccion Plugins. Validaciones siguen verdes: validate-frontmatter 389 PASS, smoke-test 20 PASS.
- **Agent `vue-reviewer`**: Vue 3 + Nuxt 3 code reviewer (180 lines). Cubre Composition API + `<script setup>`, reactivity (ref vs reactive, destructuring loss, computed/watch pitfalls), `v-html` sanitization, URL scheme validation on `:href`/`:src`, Nuxt 3 server routes + `useFetch` keying + `useState` vs Pinia, SFC diagnostics (`vue-tsc --noEmit`, `eslint-plugin-vue vue/vue-recommended`). Pair con `typescript-reviewer` para PRs con `.vue`+`.ts`. Cubre el gap de frontend coverage (Vue faltaba aunque `build-agents-index.js` regex ya lo esperaba).
- **Agent `svelte-reviewer`**: Svelte 5 + SvelteKit code reviewer (180 lines). Cubre runes (`$state`/`$derived`/`$effect`/`$props`/`$bindable`/`$inspect`) vs Svelte 4 legacy (`export let`, `$:`, `on:click`, event modifiers, slots → snippets), `{@html}` sanitization, URL scheme validation, SvelteKit `+page.server.ts` form actions + `+server.ts` endpoints + `load` function auth, `data-sveltekit-*` directives, `svelte-kit sync && svelte-check --tsconfig`. Pair con `typescript-reviewer` para PRs con `.svelte`+`.ts`.

### Changed
- **Doc numbers sync**: AGENTS.md, README.md, manual/START-HERE.md, manual/COMMANDS.md, manual/ROUTE.md, commands/help.md, commands/start-here.md, commands/pack-doctor.md, CHANGELOG — todos actualizados a los numeros reales (72 agents, 17 skills, 71 commands, 2 MCPs active + 10 optional). Antes el CHANGELOG decia "0 MCPs" cuando ya habia 2; AGENTS.md decia "67 commands" cuando son 71; manual/START-HERE.md decia "16 skills" pero CHANGELOG decia "14" (stale). Resync completo. **Updated for v1.1**: 69→71 commands (added `/list-mcps` + `/context-budget`).
- **`opencode.json > mcp`**: documentado como "active by default" + link a `/setup-mcp` para opt-ins.
- **`bin/state.js`**: agregada flag `--dry-run` para `init` y `update` (preview sin escribir). Refactor del argv parser para separar flags de positionals (antes `--dry-run` se metía dentro del context JSON cuando se pasaba combined). Helper `resolveStatePath()` permite pasar basename (de `state.js list`) en vez de full path. Help text actualizado. Bug fix que rompía `--dry-run` con context inline.
- **`caveman` skill description**: rewrite para arrancar con "Use when..." (convention del pack, antes era la única skill que no cumplía).
- **State filename convention**: `CONVENTIONS.md` y `AGENTS.md` actualizados. Pattern real = `docs/state/{command}-{YYYY-MM-DDTHH-MM-SS}.json` (command first, ISO timestamp second). Docs previos decían `{YYYY-MM-DD_HHMM}-{command}.state.json` que no matcheaba con `state.js`. Doc/README alineado al código (ISO timestamps son más grep-friendly, command-first agrupa en `ls`).
- **`docs/PROJECT.md` y `docs/AGENTS_INDEX.md` regenerados**: contadores sincronizados (72 agents, 17 skills, 71 commands).
- **Token optimization — `opencode.json`**: `tool_output.max_lines` 200→150. Truncado marginalmente más agresivo en tool results largos (el cap real sigue siendo `max_bytes: 8192`). Bajo riesgo, ~0-2K tokens/sesion en tool-heavy runs.
- **Token optimization — `AGENTS.md` caveman default**: diferenciado por rol. Primary agent (responde al user) sigue en `full`. Sub-agents (reviewers, analyzers, fixers, build-resolvers) ahora usan `lite` por default — sus outputs son intermediarios que el primary los sintetiza. Resultado: ~30-50% menos tokens en outputs de sub-agents sin sacrificar claridad en la respuesta final al user. Switch via `/caveman lite|full|ultra|wenyan-*` sigue funcionando per-agent.
- **Token optimization — `opencode.json` `compaction.tail_turns: 5`** (default 15). Los últimos 5 turnos quedan uncompressed; los anteriores se resumen. Ahorro ~10-15K tokens/sesion larga (turno 15+). **Trade-off**: sesiones iterativas que referencian turnos 6-14 (e.g. debug profundo, refactor multi-step) verán contexto resumido en vez de raw. Mitigación: bumpear a 8 o 10 si notás pérdida de contexto. Lineales (Q&A, single-task work) no se ven afectadas.
- **AGENTS.md split → `pack-reference` skill (on-demand)**: AGENTS.md baja de 20.2KB a 12.6KB (-37%) moviendo reference material (estructura, convenciones, plugins, project docs, memory layers, agent orchestration) a nueva skill `pack-reference` (6KB) que el primary carga on-demand. **Core rules se quedan en AGENTS.md** (always loaded): Prompt Defense Baseline, 9 Comportamientos Obligatorios, Security Guidelines, Tool Result Truncation. Tambien eliminadas secciones redundantes (Coding Style, Testing, Git Workflow, Code Review) que ya tienen skills dedicadas. Ahorro ~1.9K tokens al boot. Total: 21 skills, 0 perdida de funcionalidad — el agent consulta `pack-reference` cuando necesita path/naming/plugin info.

### Fixed
- **`bin/state.js` --dry-run + context bug**: antes, pasar `--dry-run` con un context JSON inline (e.g. `state.js update $F 1 '{"k":1}' --dry-run`) rompía porque el argv parser metía `--dry-run` dentro del context string. Refactor: flags separados de positionals antes de slicing. Ahora funciona como esperado.
- **State file basename resolution**: antes `state.js update <basename>` fallaba con "state file not found" aunque el archivo existiera en `docs/state/`. Ahora `resolveStatePath()` chequea el path as-is, después cae a `STATE_DIR/{basename}`. Aplica a `update`, `complete`, `fail`, `archive`.
- **`state.js -h` standalone flag**: antes no se reconocía (solo `help` y `--help` funcionaban). Ahora `-h` se trata como help flag.
- **Test command routing mismatch**: 4 commands (`/react-test`, `/flutter-test`, `/kotlin-test`, `/cpp-test`) enrutaban a su `*-build-resolver` (que es para fix de build errors, no testing). Ahora los 6 test commands (`/go-test`, `/rust-test`, `/react-test`, `/flutter-test`, `/kotlin-test`, `/cpp-test`) enrutan a `tdd-guide`, que es el especialista correcto. Build-resolvers nunca debieron manejar testing.

### Changed
- **Doc numbers sync**: AGENTS.md, README.md, manual/START-HERE.md, manual/COMMANDS.md, manual/ROUTE.md, commands/help.md, commands/start-here.md, commands/pack-doctor.md, CHANGELOG — todos actualizados a los numeros reales (72 agents, 17 skills, 69 commands, 2 MCPs active + 10 optional). Antes el CHANGELOG decia "0 MCPs" cuando ya habia 2; AGENTS.md decia "67 commands" cuando son 69; manual/START-HERE.md decia "16 skills" (correcto) pero CHANGELOG decia "14" (stale). Resync completo. **Updated post-consolidation**: 72→68 agents (5 micro-reviewers merged into `code-quality-analyzer`), 17→20 skills (+testing-patterns, +refactoring-patterns, +debugging-patterns), 71→72 commands (+/opensource-pipeline). **Updated post-#8/#9**: 70→72 agents (+vue-reviewer, +svelte-reviewer, +iac-reviewer, +k8s-reviewer). **Updated post-#10**: added 3 downstream demos in `.opencode/examples/` (33 files, runnable, tests passing out of the box).
- **`opencode.json > mcp`**: documentado como "active by default" + link a `/setup-mcp` para opt-ins. La key `_optional` agrega los templates sin cargarlos.

## [1.0.0]

### Added
- **Skill `agent-router`** (paralelo a `skill-router`): matriz compacta intent → agent para los 69 subagentes del pack, agrupados por purpose (planning, implementation, review, test, refactor, docs, domain specialists, meta). Pairing tipico agent + skill incluido. Cross-referenciado desde `skill-router`. Habilita el Mandatory Routing Protocol (#8 abajo).
- **Mandatory Routing Protocol** (comportamiento obligatorio #8 en `AGENTS.md`): el primary agent DEBE clasificar el request (action verb + domain noun + stack + stage + risk), load `agent-router` + `skill-router` skills, y dispatchar 1-3 agents + 1-2 skills antes de responder, salvo pure Q&A. Anti-patterns documentados. Pairing table incluida. Integra con flow suggestions (#7) sin colisionar (routing es first, flow es second).
- **Always-On Project Context** (comportamiento obligatorio #9 en `AGENTS.md`): el primary agent garantiza que `docs/PROJECT.md` esté vigente antes de cualquier task no-trivial. Lee Layer 1 al boot, check freshness via `refresh-project.js --status`, auto-busca si missing, auto-refresca si stale (>7 dias), silent write con `--auto`. Cuando dispatcha a un sub-agent (prd-agent en particular), le pasa el path de `docs/PROJECT.md` y le instruye leerlo primero — stack, conventions, non-negotiables se vuelven restricciones del task, no preguntas. Cuando el user pregunta "que es este proyecto / que stack usa", el primary lee PROJECT.md y responde de ahi, NO escanea el codebase en vivo. Slash command `/project-status` agregado para check manual. Integra con PRD-first (#2) en cadena: PROJECT.md fresh → PRD → plan → code.
- **Enhanced `refresh-project.js`**: deteccion rica para `docs/PROJECT.md`. Sumado: TypeScript strict mode, monorepo (Turbo/Nx/pnpm/npm/yarn workspaces), frameworks extendidos (vue/svelte/angular/fastify/koa/hono/nestjs/electron), test runner (vitest/jest/playwright/pytest/phpunit), coverage (c8/nyc/codecov), linter (eslint flat+legacy, biome, ruff, pylint, golangci-lint, clippy), formatter (prettier, biome, black, rustfmt, gofmt), CI (GitHub Actions count, GitLab CI, CircleCI, Travis, Jenkins), container (Dockerfile, docker-compose), env vars parser (.env.example), entry points. Nuevas secciones en template: **Tooling** (test/coverage/linter/formatter/CI/container/env), **Entry Points**. Nuevos flags: `--status` (freshness check, no write, exit 0/1), `--auto` (silent write, solo loggea cambios). Behavior #9 usa `--auto` para bootstrap silencioso.

### Changed
- **Folder rename: `.opencode/docs/` → `.opencode/manual/`**: el nombre `docs/` colisionaba con el directorio `docs/` del proyecto (donde viven PRDs/plans/reports). Renombrar a `manual/` elimina la confusion y deja la convencion explicita: pack = manual, proyecto = docs. 8 archivos actualizados (AGENTS.md, README.md, CHANGELOG.md, commands/help.md, commands/start-here.md, bin/validate-frontmatter.js, bin/smoke-test.js, docs/README.md).
- **Merge: `INSTRUCTIONS.md` → `AGENTS.md`**: el boot de opencode cargaba dos archivos (`.opencode/AGENTS.md` 344 lineas + `.opencode/instructions/INSTRUCTIONS.md` 502 lineas). Consolidados en un solo `.opencode/AGENTS.md` de 686 lineas con secciones claras (Prompt Defense Baseline, estructura, convenciones, comportamientos obligatorios, security, coding/testing/git/review standards, agent orchestration, common patterns, reinicio). Se borra `.opencode/instructions/`. `opencode.json > instructions` ahora tiene 1 sola entrada. Smoke test actualizado (drop 2 checks de instructions/). Resultado: 1 archivo de boot en vez de 2, ahorra ~1K tokens por turno y elimina una carpeta de la estructura.
- **Docs sync (Tiers A-D)**: 14 archivos actualizados para reflejar el estado real del pack. Números canónicos fijados (69 agents, 14 skills, 65 commands, 5 plugins, 9 CLIs, 0 MCPs). Paths corregidos (`agentes/`→`agents/`, `comandos/`→`commands/`, `instincts/` ahora existe con `.gitkeep`). 13 commands faltantes agregados a `COMMANDS.md` en 4 secciones nuevas. `@intent-driven-development` corregido en EXAMPLES.md (es skill, no agent).

### Restructure (path consolidation)
- **Skills unificadas en `.agents/skills/`**: las 14 pack skills se movieron de `.opencode/skills/` a `.agents/skills/`. La junction `.opencode/skill` ahora apunta a `../.agents/skills/` (backwards compat 1.17.x). opencode descubre skills de ambos paths, pero ahora hay un solo lugar canónico.
- **Project docs consolidados en `docs/`**: todo el contenido generado por el proyecto vive en `docs/` (un solo directorio, fácil de llevar con rsync/tar). Movido:
  - `docs/PROJECT.md` (desde `.agents/PROJECT.md`)
  - `docs/AGENTS_INDEX.md` (desde `.opencode/AGENTS_INDEX.md`)
  - `docs/prds/`, `docs/plans/`, `docs/reports/`, `docs/audits/`, `docs/sessions/`, `docs/state/`, `docs/instincts/`
- **Empty template dirs removidos de `.opencode/`**: `.opencode/{prds,plans,reports,audits,state,instincts}/` ya no existen como placeholders. La estructura ahora vive en `docs/` (template para nuevos clones).
- **Pack docs en `.opencode/docs/`** (renombrado a `.opencode/manual/` poco después para evitar la colision con el `docs/` del proyecto): la documentación del PACK (no del proyecto) sigue en una carpeta separada — no se mezcla con el contenido del proyecto.
- **7 CLIs actualizados** (refresh-project, state, instinct, build-agents-index, build-skills-index, context, smoke-test) para escribir/leer desde las nuevas rutas.
- **14 slash commands actualizados** (orchestrate, plan, prd, prd-reviewer, audit-report, archive-reports, refresh-project, flow-{feature,bugfix,refactor,security}, verify, tdd, code-review, learn, etc).
- **3 agents actualizados** (prd-agent, prd-reviewer, planner) — críticos, referencian paths en sus instrucciones.
- **`.opencode/AGENTS.md`** reescrito con la nueva estructura y tree.
- **`.opencode/CONVENTIONS.md`** actualizado: define los nuevos paths como canonical.
- **`.gitignore` actualizado** (root + `.opencode/.gitignore`).
- **Nuevo `docs/README.md`** (índice de navegación del directorio de project docs).
- **EXAMPLES.md**: nuevo "Ejemplo 6" mostrando `/quick-prd` + `/flow-bugfix` workflow. Tabla "Patrones comunes" extendida con 4 patrones nuevos (`/quick-prd`, `/flow-*`, `/audit-report`, `/pack-doctor`). Header actualizado a "6 ejemplos".

## [1.0.0] — 2026-06-29

**MILESTONE**: El pack deja de ser "starter" y se considera completo. Incluye todos los flujos de trabajo, auditoría post-ejecución, archivado automático, validación de salud y convenciones de naming estandarizadas.

### Changed (breaking)
- **Estructura del pack consolidada en `.opencode/`**: todos los archivos del pack viven en `.opencode/`. Cero conflicto con archivos del proyecto del user (su `README.md`, `CHANGELOG.md`, `AGENTS.md` ya no chocan con los del pack). Cambio de paths en `opencode.json > instructions`:
  - Antes: `["AGENTS.md", ".opencode/instructions/INSTRUCTIONS.md"]`
  - Ahora: `[".opencode/AGENTS.md", ".opencode/instructions/INSTRUCTIONS.md"]`
- **Naming convention formalizada**: `YYYY-MM-DD_HHMM-{slug}.{ext}` con guion bajo entre fecha y hora. Documentado en `.opencode/CONVENTIONS.md`. Anteriormente el patron era `YYYY-MM-DD-HHMM-` con guion (mas dificil de tipear y parsear).

### Added
- **Reportes y auditoria post-ejecucion (paquete completo)**:
  - `report-auditor` agent: auditor lightweight (no exhaustivo). Cruza report contra PRD origen y skills cargadas, emite veredicto PASS / PASS-WITH-NITS / FAIL. ~30-60 lineas de output, sin tablas decorativas.
  - `/audit-report` command: invoca el auditor. Soporta `--separate` (auditoria en archivo aparte), `index` / `--index` (regenera INDEX global), `quick {name}` (solo veredicto), `compare {a} {b}` (diff de veredictos).
  - `/archive-reports` command: mueve reports viejos a `docs/reports/_archive/{YYYY}/`. NUNCA borra. Default: COMPLETADO >30d. Flags: `--older-than Nd`, `--all-completed`, `--dry-run`.
  - `/quick-prd` command: mini-PRD de 10 lineas para bugs/fixes/one-liners. Auto-regenera a PRD completo si crece en scope.
- **Auto-report al cerrar flujos**:
  - `/orchestrate` ahora tiene Phase 4 OBLIGATORIA: genera `docs/reports/{YYYY-MM-DD-HHMM}-{name}.report.md` con agentes usados, decisiones, criterios PRD, desvios, skills, archivos.
  - `/verify` exitoso auto-genera report (cuando hay cambios + PRD activo). Ofrece auditar al final.
  - `/code-review`, `/security`, `/plan`, `/tdd` ofrecen guardar el output como report y auditar contra el PRD origen.
- **Cross-link plans↔PRDs**: frontmatter obligatorio al inicio de cada plan con `prd:`, `status:`, `created:`. El auditor usa este link cuando el report no nombra el PRD directamente.
- **INDEX global** (`docs/reports/INDEX.md`): tabla de todos los reports con status, criterios, veredicto, skill gaps. Se regenera en cada `/audit-report` (silent). Seccion "Skill gaps recurrentes" con flag para refactor si >3 ocurrencias.
- **Skills feedback loop**: el auditor emite NIT "skill gap" cuando una skill se cargo pero se ignoro, o cuando deberia haberse cargado y no se cargo. Esto mantiene las skills vivas.
- **Regla de idioma en PRDs**: espanol por default. Ingles solo para identificadores de codigo, terminos tecnicos sin traduccion natural, siglas. Sin espanglish tipo "el button de push". Documentado en `prd-agent.md` con ejemplos good A/B.
- **`/pack-doctor` command**: valida la salud del pack completo. Detecta frontmatter invalido, agents duplicados, commands huerfanos (que apuntan a agents inexistentes), skills sin descripcion, permalinks rotos, archivos >800 lineas.
- **4 workflows pre-hechos** (`/flow-*`): bajan el costo cognitivo. Cada workflow es un slash command que encadena los commands existentes.
  - `/flow-bugfix`: `/quick-prd` → fix → `/verify` → report → audit
  - `/flow-feature`: `/orchestrate` → implement → `/verify` → report → audit
  - `/flow-refactor`: `/plan` → refactor → `/verify` → report → audit
  - `/flow-security`: `/security` → fix → `/verify` → report → audit
- **Plantillas de report por stack** en `docs/reports/templates/`: `default.md`, `angular.md`, `python.md`, `rust.md`. El orquestador auto-elige segun `docs/PROJECT.md`.
- **Recovery state**: cada command escribe `docs/state/{command}.state.json` con el progreso. Al reabrir, `/session-start` detecta estados interrumpidos y ofrece resumir.
- **Stats del pack** en `/pack-doctor`: cuenta agents/skills/commands/PRDs/reports/audits. Utilidad baja en tokens, valor alto de orientacion.

### Changed
- **`prd-agent.md`**: seccion "Idioma del PRD" agregada. Default espanol, ingles solo para terminos tecnicos. Reglas explicitas con ejemplos bad/good.
- **`orchestrate.md`**: Phase 4 obligatoria con template completo de report. Coordinacion rule #7 ("Report always") agregada.
- **5 commands existentes** (`/code-review`, `/security`, `/verify`, `/plan`, `/tdd`): bloque "Post-X: Audit" agregado al final. Indica cuando aplica y cuando no. `/verify` es el unico con auto-snapshot, el resto solo ofrece.
- **`audit-report.md`**: INDEX con columna "Skill gaps" + seccion recurrente.
- **AGENTS.md**: pendiente actualizar con la nueva seccion "Comportamientos obligatorios" que cubra auto-report y audit.

### Removed
- Nada. Todo es aditivo.

---

## [0.8.0] — 2026-06-29

### Added
- **`validate-frontmatter.js`**: nuevo CLI cero-deps que valida el frontmatter de los 65 agentes, 10 skills y 52 comandos (descripción requerida, modo `subagent`, `name` igual al directorio, descripción de skill entre 1-1024 caracteres, descripción con prefijo "Use when..."). Reporta PASS/WARN/FAIL con códigos de salida. Integrado en `smoke-test.js` y en CI.

### Changed
- **`opencode.json > instructions`**: se eliminaron las 10 skills de la lista de instrucciones siempre cargadas. El catálogo `<available_skills>` ya las expone, así que cargarlas duplicaba contenido y desperdiciaba ~30K tokens por turno. Solo quedan `INSTRUCTIONS.md` y `AGENTS.md` como capa 1.
- **`autoupdate`**: cambiado de `"notify"` a `false` para skippear el HTTP check al startup de opencode. La verificación de updates online estaba causando lentitud al abrir el TUI.
- **PRD filename format**: la convención de nombres pasó de `{YYYY-MM-DD}-{name}.prd.md` a `{YYYY-MM-DD-HHMM}-{name}.prd.md` (incluye hora en formato 24h). Evita colisiones cuando se crean varios PRDs el mismo día. Actualizado en `prd-agent.md`, `commands/prd.md`, `commands/orchestrate.md`, `AGENTS.md`, `docs/ARCH.md`, `docs/EXAMPLES.md`.
- **PRD confirmation vocabulary**: el `prd-agent` ahora acepta un set más amplio de confirmaciones, no solo "confirmo" u "OK" mayúscula. Acepta también `dale`, `ok`, `sí`, `aprobado`, `hazlo`, `perfecto`, `procede`, `va`, `adelante` (y equivalentes en inglés). Esto resuelve el caso donde el prd-agent generaba el Intention Map pero no escribía el archivo porque la confirmación no era reconocida.
- **`docs/PROJECT.md`**: se rellenó con el contenido real del pack (stack, convenciones, no negociables, arquitectura de 4 capas). Antes era un template con placeholders, lo que dejaba al prd-agent sin contexto en Fase 0.
- **`STARTER.md` movido a `.opencode/docs/README.md`**: el archivo se renombró y se movió dentro de `.opencode/` para que viaje con el pack al copiarlo a otros proyectos. Toda la documentación del pack ahora vive en `.opencode/docs/` (en español neutro, sin voseo). El `README.md` raíz queda solo como landing de GitHub.
- **`smoke-test.js`**: 24 comprobaciones (antes 23). Añadido check `validate-frontmatter.js runs`. Actualizado para apuntar a `.opencode/docs/README.md` en vez del antiguo `STARTER.md`.
- **README.md**: updated to use `cp` instead of setup scripts. Quick start is now a single copy command.
- **smoke-test.js**: removed `setup.ps1`/`setup.sh` checks; added `CHANGELOG.md` check.
- **STARTER.md**: updated stats (65 agents, 10 skills, 52 commands, 4 CLIs).

### Removed
- **`setup.sh`** and **`setup.ps1`**: deleted. Install is now manual via `cp`. Reason: scripts duplicated logic, added complexity, and required maintenance. `cp -r` of the portable files is atomic and works on all platforms.

## [0.7.0] — 2026-06-23

### Added
- **`/refresh-project` slash command** + `refresh-project.js` CLI: regenerate `docs/PROJECT.md` from current project state. Detects stack from `package.json` / `pubspec.yaml` / `pyproject.toml` / `Cargo.toml` / `go.mod` / etc. Preserves manual sections (Non-Negotiables, Architecture Notes, Open Questions). Backups to `.bak.{timestamp}` before overwrite. Auto-runs in `/session-end` Step 6.
- **`/prd` slash command**: explicit invocation of prd-agent. Same as `@prd-agent` but discoverable via slash menu.
- **Step 6 in `/session-end`**: refresh `docs/PROJECT.md` if stale. Reports lines added/removed.
- **PRD timestamp convention**: filenames now use `{YYYY-MM-DD}-{name}.prd.md` for chronological sorting and disambiguation. Conflicts auto-suffix with `-2`, `-3`, etc.
- **Per-turn consent rule** documented in INSTRUCTIONS.md: permission to commit/push from a previous turn does NOT carry over.

### Changed
- **PRD agent description** rewritten as "MANDATORY FIRST STEP for any non-trivial task" to enforce auto-trigger.
- **AGENTS.md** restructured around 4 mandatory behaviors (caveman, PRD-first, session memory, no-destructive) plus the no-git-push rule.
- **prd-agent** filename convention updated: `docs/prds/{kebab-case-name}.prd.md` → `docs/prds/{YYYY-MM-DD}-{kebab-case-name}.prd.md`.

## [0.6.0] — 2026-06-23

### Added
- **`/context` slash command** + `context.js` CLI: shows context budget report (skills inventory, agents count, commands count, sessions, project size, recommendations). Supports `--skills`, `--recommend`, and full report.
- **Tool result truncation rules** in INSTRUCTIONS.md: cap `grep -m 50`, `head -n 100`, prefer Read tool over `cat`, sub-agent discipline (pass paths not contents).
- **Smoke test** (`smoke-test.js`): self-verifies the starter pack is healthy. Checks structure, counts, junctions, bin scripts, frontmatter, broken paths. Reports 23 checks. Exits non-zero on failure.

### Changed
- **Skill frontmatter** (`intent-driven-development`): added `origin: ECC` for consistency with other skills.
- **Agents** (5): cleaned broken ECC references. `chief-of-staff.md` (`.claude/rules/` → `instructions/`), `harmonyos-app-resolver.md` (`rules/arkts/` → opencode-native), `react-build-resolver.md` and `react-reviewer.md` (rules/react/* + skills/react-* → coding-standards + security-review), `learn.md` (`rules/[category].md` → `instructions/INSTRUCTIONS.md`).
- **INSTRUCTIONS.md** expanded with ECC consolidated rules: Research & Reuse step 0, Pre-Review Checks, Code Review Standards (with severity CRITICAL/HIGH/MEDIUM/LOW), Security Review Triggers, Parallel Task Execution, Multi-Perspective Analysis, Skeleton Projects pattern.

## [0.5.0] — 2026-06-22

### Added
- **Session memory system** (4-layer hierarchy):
  - Capa 1: always loaded — `AGENTS.md` + `INSTRUCTIONS.md` + `docs/PROJECT.md` (~2K tokens)
  - Capa 2: loaded on session start — `docs/sessions/LATEST.md` (~1-3K tokens)
  - Capa 3: on-demand — skills, files, sub-agents (variable)
  - Capa 4: never loaded — git history, PRDs, plans, instincts (disk only)
- **`/session-start` slash command**: reads Capa 1+2, reports compact 1-2 line summary, waits for user direction.
- **`/session-end` slash command**: writes session snapshot to `docs/sessions/{DATE}-{SLUG}.md`, updates `LATEST.md`, includes "Decisions made", "Files touched", "Open questions", "Next steps", "Commits this session".
- **`docs/sessions/` folder** with README.md explaining the lifecycle.
- **prd-agent** (`.opencode/agents/prd-agent.md`, 12 KB, mode: all): the MANDATORY FIRST STEP for any non-trivial task. Runs a 4-phase Understanding Protocol: Phase 0 (verify/create `docs/PROJECT.md`), Phase 1 (active listening), Phase 2 (build Intention Map), Phase 3 (resolve ambiguities, max 3 at a time), Phase 4 (confirm Intention Map with explicit user OK). Output: `docs/prds/{name}.prd.md` with full template.
- **`docs/PROJECT.md` template** (1.6 KB): project's source of truth for stack, conventions, non-negotiables. prd-agent reads at Phase 0; auto-generates from existing project files if missing.

### Changed
- **`/orchestrate` command** rewritten with Phase 0 (MANDATORY): dispatch to prd-agent FIRST before any planning, then existing 1-5 phases.
- **AGENTS.md** structured around 4 mandatory behaviors (caveman, PRD-first, session memory, no-destructive) + 5th rule (no-git-push).
- **prd-agent description** aggressive: "MANDATORY FIRST STEP for any non-trivial task. The primary agent MUST delegate to this agent before any planning."

## [0.4.0] — 2026-06-22

### Added
- **`instinct.js` CLI** (14 KB, zero deps): replaces ECC's continuous-learning-v2 Python plugin. Commands: `status`, `projects`, `promote`, `evolve`, `export`, `import`, `add`. Storage: `~/.config/opencode/instincts/` (global) + `docs/instincts/` (project). Format: ECC-compatible JSON (instincts[], metadata).
- **`docs/instincts/`** directory: project-scope instinct storage.
- **`docs/prds/`** directory: PRD artifacts.

### Changed
- **6 commands migrated** to use `node .opencode/bin/instinct.js`:
  - `instinct-status.md` (was python3 plugin)
  - `evolve.md` (was python3 plugin)
  - `projects.md` (was python3 plugin)
  - `promote.md` (was python3 plugin)
  - `instinct-export.md` (was python3 plugin)
  - `instinct-import.md` (was python3 plugin)
- **`security-scan.md`**: removed broken `skills/security-scan/` reference; uses `npx ecc-agentshield` standalone.

## [0.3.0] — 2026-06-22

### Added
- **No destructive actions without explicit consent rule** in AGENTS.md and INSTRUCTIONS.md: agent NEVER does `git commit` / `push` / `rm -rf` / `DROP TABLE` without explicit verb from user. "dale" / "ok" alone are NOT consent.
- **"Acciones destructivas requieren consentimiento explicito"** section in AGENTS.md with full list of protected actions.

## [0.2.0] — 2026-06-22

### Added
- **5 mandatory behaviors** consolidated in AGENTS.md:
  1. Caveman mode (terse responses, ~75% token reduction)
  2. PRD-first (any non-trivial task → prd-agent)
  3. Session memory (auto-snapshot on close signals)
  4. No destructive actions without consent
  5. No git push/commit without explicit per-turn consent
- **STARTER.md** rewritten with new "Flutter quiz" example (9 steps from command to commit), summary tables, "Lo que NO tuviste que pedir" section explaining auto-invoked specialists.
- **Tool truncation table** in INSTRUCTIONS.md.
- **Token optimization analysis** documented: 4-layer hierarchy, on-disk vs in-context mental model.

## [0.1.0] — 2026-06-22

### Added
- **Initial starter pack** (forked from ECC, restructured for opencode-native).
- **64 agents** migrated from ECC, normalized to `mode: all` + `permission:` block.
- **11 skills** with consistent frontmatter (name, description, origin).
- **47 commands** extracted from opencode.json into `.opencode/commands/*.md`.
- **Setup scripts** (`setup.ps1`, `setup.sh`) with robocopy/rsync node_modules exclusion.
- **Junctions** (`.opencode/agent` → `agents/`, `.opencode/skill` → `skills/`) for opencode 1.17.x backwards compat.
- **MCP servers**: `context7` (docs search), `playwright` (browser automation).
- **Plugins**: `dynamic-context-pruning`, `skillful`, `vibeguard`, `pty`.
- **Permission**: `skill: "allow"` global.
- **2 hidden junctions** + `.opencode/.gitignore` to exclude node_modules.
- **AGENTS.md** with caveman rules, structure, conventions.
- **INSTRUCTIONS.md** with security, coding style, testing, git workflow, agent orchestration, common patterns.
- **README.md** (409 B): GitHub landing pointing to STARTER.md.
- **STARTER.md** (22 KB): complete documentation including 47-command table, real example (Node.js API endpoint), command/skill/agent comparison.
- **`opencode.json`** (1.3 KB): minimal config — mcp, plugin, instructions. NO `model`/`small_model` (each user configures their own).

### Fixed
- `singular` vs `plural` folder names: renamed `.opencode/agent/` and `.opencode/skill/` to `.opencode/agents/` and `.opencode/skills/` per opencode 1.17.x standards. (Note: `.opencode/skill/` junction now points to `../.agents/skills/` after the v1.x restructure.)
- `opencode.json` bloat: 63 KB (with inline commands) → 1.3 KB (commands in .md files).
- **node_modules** bloat: pack was 53.85 MB → 1.38 MB (97% reduction) by deleting `node_modules` and excluding in setup scripts. Regenerated by `bun install` on first `opencode .` (~30s).
- **Junction untracking**: removed `.opencode/agent/*` and `.opencode/skill/*` from git tracking (75 files were duplicates via junction).

---

## Summary by numbers

| Metric | 0.1.0 (init) | 0.8.0 | 1.0.0 (current) | Delta total |
|--------|-------------|-------|------------------|-------------|
| Source pack size | 53.85 MB | 1.38 MB | ~1.5 MB | -97% |
| `opencode.json` size | 63 KB | 1.3 KB | 1.3 KB | -98% |
| Files in repo root (pack) | 7 | 3 | **1** (opencode.json) | -86% |
| Agents | 64 | 65 | 66 | +2 |
| Skills | 11 | 10 | 10 | -1 |
| Commands | 47 | 52 | 60 | +13 |
| Bin CLIs | 0 | 4 | 4 | +4 |
| Mandatory behaviors | 0 | 5 | 6 | +6 |
| Report templates | 0 | 0 | 4 (default/angular/python/rust) | +4 |
| Recovery state | 0 | 0 | 1 (documented) | +1 |
| Naming convention | ad-hoc | informal | formal (`CONVENTIONS.md`) | formal |
| Token reduction (typical) | baseline | ~80% | ~85% | -85% |
| Auto-destructive actions blocked | no | yes | yes | safety+ |

## Commands added across versions

| Version | Command | Purpose |
|---------|---------|---------|
| 0.4.0 | (migrated) instinct-status | Show learned instincts with confidence |
| 0.4.0 | (migrated) evolve | Analyze and suggest evolved structures |
| 0.4.0 | (migrated) projects | List registered projects and instinct counts |
| 0.4.0 | (migrated) promote | Promote project instincts to global scope |
| 0.4.0 | (migrated) instinct-export | Export instincts for sharing |
| 0.4.0 | (migrated) instinct-import | Import instincts from external sources |
| 0.5.0 | /session-start | Load minimal context (Capa 1+2) |
| 0.5.0 | /session-end | Write session snapshot |
| 0.6.0 | /context | Show context budget report |
| 0.7.0 | /refresh-project | Regenerate docs/PROJECT.md from current state |
| 0.7.0 | /prd | Quick invocation of prd-agent |

## Architecture (current — v1.0.0)

```
D:\dev\2026\open\
├── opencode.json       (root, ONLY this. 1.3 KB: mcp + plugin + instructions)
├── .agents/            (user-installed skills + project context)
│   ├── PROJECT.md      (auto-refreshable)
│   ├── sessions/       (1 .md per session + LATEST.md)
│   └── skills/caveman/ (user-installed)
└── .opencode/          (TODO el pack vive aca — zero conflict con archivos del user)
    ├── AGENTS.md       (reglas del pack, referenciado en opencode.json)
    ├── README.md       (doc del pack)
    ├── CHANGELOG.md    (version history)
    ├── CONVENTIONS.md  (naming + estados + frontmatter schemas)
    ├── agents/         (66 .md, mode: all|primary|subagent)
    ├── skills/         (10 .md, on-demand)
    ├── commands/       (60 .md, slash commands)
    ├── instructions/   (INSTRUCTIONS.md, 8 KB, capa 1)
    ├── reports/        (reports + templates + INDEX)
    ├── audits/         (auditorias separadas)
    ├── prds/           (PRD artifacts, YYYY-MM-DD_HHMM-{slug}.prd.md)
    ├── plans/          (planes, YYYY-MM-DD_HHMM-{slug}.plan.md)
    ├── state/          (recovery state por sesion)
    ├── bin/            (4 CLIs, zero deps)
    ├── instincts/      (JSON store)
    ├── docs/           (ROUTE, COMMANDS, EXAMPLES, ARCH, SURFACES)
    ├── node_modules/   (regenerable con bun install)
    ├── package.json    (deps de plugins/MCPs)
    ├── agent           (junction → agents/)
    └── skill           (junction → skills/)
```

## Token efficiency (cumulative)

| Layer | Mechanism | Savings |
|-------|-----------|---------|
| Output | caveman mode | ~75% |
| Chat history | dynamic-context-pruning plugin | 30-50% |
| Resume | session memory 4-layer | ~80% |
| Sub-agents | task tool isolated contexts | 70-90% in parallel |
| Skills | on-demand via `<available_skills>` | ~95% on unused |
| Tool results | truncation rules in INSTRUCTIONS.md | 20-40% |
| PROJECT.md | auto-refresh keeps it accurate | avoids re-derivation |
| Instincts | persistent learnings in JSON | avoids re-explanation |
| **Total** | | **~85% reduction vs unoptimized starter** |
