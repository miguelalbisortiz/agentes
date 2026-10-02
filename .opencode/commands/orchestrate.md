---
description: "Orchestrate multiple agents for complex tasks. Auto-invokes prd-agent FIRST for intent clarification."
agent: planner
---

# Orchestrate Command

Orchestrate multiple specialized agents for this complex task: $ARGUMENTS

## Your Task

0. **Invoke prd-agent FIRST** (intent clarification + PRD generation)
1. **Analyze task complexity** and break into subtasks
2. **Identify optimal agents** for each subtasks
3. **Create execution plan** with dependencies
4. **Coordinate execution** - parallel where possible
5. **Synthesize results** into unified output

---

## Phase 0 (MANDATORY) — Intent Clarification via prd-agent

**BEFORE any planning, dispatch `prd-agent`** to:
1. Verify/create `docs/PROJECT.md` (project context)
2. Run the Understanding Protocol (active listening, intention map, ambiguity resolution, confirmation)
3. Produce `docs/prds/{YYYY-MM-DD_HHMM}-{name}.prd.md`

**Dispatch via task tool:**

```
task { subagent_type: "prd-agent", prompt: "$ARGUMENTS" }
```

**Wait for prd-agent to finish.** Do not start planning until the user has confirmed the Intention Map and a PRD file exists.

**If the user has already provided a clear, unambiguous request with explicit acceptance criteria** (e.g., a bug report, a fully-specified RFC, a one-liner with full context), you may skip Phase 0 and proceed to Phase 1. Document this skip in your output: "Skipped prd-agent — request already meets PRD criteria."

---

## Available Agents (for Phases 1+)

> **Disponibilidad:** los agentes de lenguaje (p. ej. `go-reviewer`, `go-build-resolver`) se instalan solo si coinciden con el stack del proyecto (marcado en `.opencode/.stack`). Si falta alguno, usa `code-reviewer` o `build-error-resolver`.

| Agent | Specialty | Use For |
|-------|-----------|---------|
| **prd-agent** | **Intent clarification** | **Phase 0 — always first** |
| planner | Implementation planning | Phase 1+ — complex feature design |
| architect | System design | Architectural decisions |
| code-reviewer | Code quality | Review changes |
| security-reviewer | Security analysis | Vulnerability detection |
| tdd-guide | Test-driven dev | Feature implementation |
| build-error-resolver | Build fixes | TypeScript/build errors |
| e2e-runner | E2E testing | User flow testing |
| doc-updater | Documentation | Updating docs |
| refactor-cleaner | Code cleanup | Dead code removal |
| go-reviewer | Go code | Go-specific review |
| go-build-resolver | Go builds | Go build errors |
| database-reviewer | Database | Query optimization |

## Orchestration Patterns

### Sequential Execution
```
prd-agent → planner → tdd-guide → code-reviewer → security-reviewer
```
Use when: Later tasks depend on earlier results

### Parallel Execution
```
              ┌→ security-reviewer
prd-agent → planner →├→ code-reviewer
              └→ architect
```
Use when: Tasks are independent (after PRD is confirmed)

### Fan-Out/Fan-In
```
                   ┌→ agent-1 ─┐
prd-agent → planner →├→ agent-2 ─┼→ synthesizer
                   └→ agent-3 ─┘
```
Use when: Multiple perspectives needed

## Execution Plan Format

### Phase 0: Intent Clarification (ALWAYS FIRST)
- Agent: `prd-agent`
- Task: clarify intent, resolve ambiguities, generate PRD
- Output: `docs/prds/{YYYY-MM-DD_HHMM}-{name}.prd.md` + user confirmation
- Depends on: none

### Phase 1: Planning
- Agent: `planner` (or `code-architect` for system design)
- Task: consume PRD, produce implementation plan
- Depends on: Phase 0 (PRD must exist)

### Phase 2: [Specialists] (parallel when independent)
- Agent A: [specialist-1]
  - Task: [specific task from plan]
- Agent B: [specialist-2]
  - Task: [specific task from plan]
- Depends on: Phase 1

### Phase 3: Synthesis
- Combine results from Phases 0–2
- Generate unified output
- Hand off to user with: PRD path, plan summary, next steps

### Phase 4 (MANDATORY) — Execution Report

**Al cerrar CUALQUIER flujo multi-agente, escribir un report en `docs/reports/{YYYY-MM-DD_HHMM}-{name}.report.md`.**

El report es OBLIGATORIO. No opcional. No se pregunta al usuario — se genera.

**Cuando aplica Phase 4:**
- `/orchestrate` completo (prd-agent + planner + especialistas)
- Cualquier flujo con >=2 agentes especializados
- `/plan` con implementacion (cuando el plan produjo codigo)

**Cuando NO aplica:**
- Pure Q&A (no se invoco ningun agente de trabajo)
- One-liner fix
- Usuario cancelo antes de Phase 1

**Template del report** (escribir en `docs/reports/{YYYY-MM-DD_HHMM}-{kebab-name}.report.md`):

**Selector de plantilla segun stack:**

```
¿Cual es el stack del proyecto (de `docs/PROJECT.md`)?
├── Angular  → `.opencode/reports/templates/angular.md`
├── Python   → `.opencode/reports/templates/python.md`
├── Rust     → `.opencode/reports/templates/rust.md`
└── Otro     → `.opencode/reports/templates/default.md`
```

El orquestador lee `docs/PROJECT.md` y copia la plantilla correspondiente, llenando los placeholders con los datos del flujo.

```markdown
# {Nombre del task} — Report de ejecucion

> Generated by /orchestrate on YYYY-MM-DD_HHMM from PRD:
> `docs/prds/{name}.prd.md`

## Status
COMPLETADO | EN PROGRESO | BLOQUEADO

## Contexto
[1-2 lineas: que se pidio, de donde viene]

## Agentes usados

| Fase | Agente | Output | Status |
|------|--------|--------|--------|
| 0 | prd-agent | `docs/prds/{name}.prd.md` | OK |
| 1 | planner | `docs/plans/{name}.plan.md` | OK |
| 2 | {specialist} | {output} | OK |

## Decisiones tomadas
- [decision 1 + justificacion]
- [decision 2]

## Criterios PRD

| # | Criterio | Estado | Evidencia |
|---|----------|--------|-----------|
| 1 | [resumen] | PASS / FAIL / N/A | [archivo, test, log] |

## Desvios / Incidentes
- [desvio 1: que, por que, impacto]
- [o "ninguno"]

## Skills cargadas
- [skill 1: para que, que dijo]
- [o "ninguna"]

## Archivos modificados
- `path/to/file.ts` — [que cambio]

## Proximos pasos
- [accion 1]

---

*Auditable via `/audit-report {name}` → `docs/audits/{name}.audit.md`.*
```

**Comportamiento al cerrar (Phase 4):**

1. Recopilar agentes invocados, decisiones, archivos modificados.
2. Generar el report.
3. Preguntar UNA vez: "Report en `docs/reports/{name}.report.md`. ¿Audito con report-auditor? (s/n)".
4. Si `s`/`si`/`audita` → invocar `report-auditor` con el path del report.
5. Si `n`/`skip` → respetar.
6. Reportar al usuario: PRD + plan + report + audit (si se genero) + siguiente paso.

## Coordination Rules

1. **PRD first, always** — Phase 0 is mandatory for any non-trivial task
2. **Plan before execute** — Phase 1 consumes the PRD, produces the plan
3. **Minimize handoffs** — Reduce context switching between agents
4. **Parallelize when possible** — Independent tasks in parallel (after Phase 0)
5. **Clear boundaries** — Each agent has specific scope
6. **Single source of truth** — PRD is the contract; plan is the strategy; code is the implementation
7. **Report always** — Every multi-agent flow leaves a `docs/reports/{name}.report.md` artifact

## When to Skip Phase 0

Skip `prd-agent` only when ALL of the following are true:
- Request is a bug report with reproducible steps
- Request is a one-line fix (typo, single-file change)
- Request includes an existing `docs/prds/*.prd.md` to consume
- User explicitly says "skip PRD" or "just do it"

In all other cases, Phase 0 is mandatory. The cost of a clear PRD is one extra round trip; the cost of building the wrong thing is much higher.

---

**NOTE**: Complex tasks benefit from multi-agent orchestration starting with intent clarification. Simple tasks should use single agents directly (`@prd-agent` for new work, `@code-reviewer` for review, `@build-error-resolver` for build issues).

---

## State Persistence (REQUIRED)

This flow writes to `docs/state/` so it can be resumed after interruption. See `docs/state/README.md` for the schema.

``bash
# At flow start
node .opencode/bin/state.js init orchestrate "" [<prd-path>]
# Capture the printed path as 

# After each phase
node .opencode/bin/state.js update "" <phase> '{"agentsInvoked":["..."],"filesModified":["..."]}'

# On success
node .opencode/bin/state.js complete ""

# On error
node .opencode/bin/state.js fail "" "<error message>"
``

The flow is resumable: if interrupted, `/session-start` detects active states in `docs/state/` and offers to resume from `currentPhase`.