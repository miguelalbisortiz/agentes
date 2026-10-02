# COMMANDS

> 71 slash commands, agrupados por intención. Igual que `ROUTE.md` pero para comandos.
> El archivo vive en `.opencode/commands/<nombre>.md` con frontmatter `description` y `agent`.

## "Quiero clarificar antes de implementar"

| Comando | Qué hace | Agent |
|---------|----------|-------|
| `/prd` | Clarifica intención y escribe el PRD. **Primer paso obligatorio** en tareas no triviales. | build |
| `/spec-lint` | **Linter preventivo del spec**: palabras vagas, criterios sin `SHALL`, no medibles, `Out of Scope` vacío. Score + fixes. Corre **antes** de `/plan`. | prd-agent |
| `/plan` | Crea un plan de implementación a partir de un PRD, con archivos, dependencias y orden. | planner |
| `/tasks` | Desglosa el plan en tareas atómicas con estado (`pending/in_progress/done`), cada una ligada a su AC y su verificación. | planner |
| `/orchestrate` | Flujo multi-agente completo. Phase 0 invoca automáticamente al `prd-agent`. | planner |
| `/model-route` | Recomienda el mejor modelo para la complejidad de la tarea. | build |
| `/harness-audit` | Auditoría determinista del repo y devuelve un scorecard priorizado. | build |
| `/aside` | Pregunta rápida sin cambiar el contexto de la sesión. | build |
| `/quick-prd` | Mini-PRD de 10 lineas para bugs, fixes o one-liners. Auto-regenera a PRD completo si crece. | build |
| `/change-request` | Cambio de spec a mitad de ciclo: impacto sobre ACs/fases, renumeración `[revised]`, `Change Log` en el PRD y propagación al plan. | prd-agent |

## "Quiero validar cambios"

| Comando | Qué hace | Agent |
|---------|----------|-------|
| `/verify` | Ejecuta el loop completo: revisión de código, seguridad, revisor por stack. | build |
| `/code-review` | Revisión de código puntual. | code-reviewer |
| `/security` | Auditoría de seguridad comprehensiva. | security-reviewer |
| `/security-scan` | Ejecuta AgentShield contra superficies de agente, hook, MCP, permiso y secreto. | security-reviewer |
| `/e2e` | Genera y ejecuta tests E2E con Playwright. | e2e-runner |
| `/test-coverage` | Analiza y mejora la cobertura de tests. | tdd-guide |
| `/tdd` | Fuerza el workflow TDD con 80%+ de cobertura. | tdd-guide |
| `/eval` | Ejecuta evaluación contra criterios de aceptación. | build |
| `/checkpoint` | Guarda el estado de verificación y checkpoint de progreso. | build |
| `/audit-report` | Cruza un report contra su PRD origen. Veredicto PASS / PASS-WITH-NITS / FAIL. | report-auditor |
| `/trace` | **Trazabilidad bidireccional**: de un AC → plan/tasks/tests/archivos, y de un archivo → qué ACs toca. `--matrix` y `--gap`. Responde "¿qué se rompe si cambio esto?". | planner |
| `/spec-to-tests` | Genera los tests **desde** los Success Criteria del PRD (unit/integration/E2E), nombrados con el id del AC para que `/verify` y `/trace` los vinculen. Marca `MANUAL` lo no automatizable. | testing-auto |
| `/definition-of-done` | **Gate único de cierre**: cruza `/verify` + `/eval` + `/audit-report` + `/trace` en UN veredicto (READY / READY WITH BLOCKERS / NOT READY) con la lista de bloqueos. | report-auditor |

## "Quiero revisar por stack"

### TypeScript/React

| Comando | Qué hace | Agent |
|---------|----------|-------|
| `/react-build` | Arregla errores de build de React. | react-build-resolver |
| `/react-test` | Ejecuta tests de React. | tdd-guide |

### Go

| Comando | Qué hace | Agent |
|---------|----------|-------|
| `/go-review` | Revisa código Go. | go-reviewer |
| `/go-build` | Arregla errores de build y `vet` de Go. | go-build-resolver |
| `/go-test` | Workflow TDD de Go con tests table-driven. | tdd-guide |

### Rust

| Comando | Qué hace | Agent |
|---------|----------|-------|
| `/rust-review` | Revisa código Rust. | rust-reviewer |
| `/rust-build` | Arregla errores de build de Rust y borrow checker. | rust-build-resolver |
| `/rust-test` | Workflow TDD de Rust con unit y property tests. | tdd-guide |

### C++

| Comando | Qué hace | Agent |
|---------|----------|-------|
| _(removed in 1.1: cpp-review/cpp-build/cpp-test eran 5-line aliases del router; el `cpp-*-resolver` agent se dispatcha via /route o "fix C++ build error")_ |

### Kotlin

| Comando | Qué hace | Agent |
|---------|----------|-------|
| _(removed in 1.1: kotlin-review/kotlin-build/kotlin-test eran 5-line aliases del router)_ |

### Python

| Comando | Qué hace | Agent |
|---------|----------|-------|
| _(removed in 1.1: python-review era 5-line alias del router; el `python-reviewer` agent se dispatcha via /route)_ |

### Build genérico

| Comando | Qué hace | Agent |
|---------|----------|-------|
| `/build-fix` | Arregla errores de build y TypeScript con cambios mínimos. | build-error-resolver |

## "Quiero mantener la memoria entre sessions"

| Comando | Qué hace | Agent |
|---------|----------|-------|
| `/session-start` | Lee la Capa 1+2 de memoria y reporta un resumen compacto. Auto en señales de cierre. | build |
| `/session-end` | Escribe snapshot, actualiza `LATEST.md`, refresca `PROJECT.md`, extrae 1-3 instintos. | build |
| `/context-budget` | Audita el presupuesto de contexto: skills, agentes, comandos, sessions. | build |
| `/project-status` | Check freshness de `docs/PROJECT.md` sin escribir. Exit 0/1 (CI-friendly). | build |
| `/refresh-project` | Regenera `docs/PROJECT.md` desde los archivos del proyecto. Soporta `--status`, `--auto`, `--dry-run`, `--check`. | build |

## "Quiero limpiar / refactorizar"

| Comando | Qué hace | Agent |
|---------|----------|-------|
| `/refactor-clean` | Elimina código muerto y consolida duplicados. | refactor-cleaner |

## "Quiero mantener la documentación sincronizada"

| Comando | Qué hace | Agent |
|---------|----------|-------|
| `/update-codemaps` | Actualiza los codemaps para navegación del codebase. | doc-updater |
| `/update-docs` | Actualiza la documentación por cambios recientes. | doc-updater |

## "Quiero aprender / iterar con instintos"

| Comando | Qué hace | Agent |
|---------|----------|-------|
| `/learn` | Extrae patrones y aprendizajes de la sesión actual. | build |
| `/evolve` | Analiza instintos y sugiere o genera estructuras evolucionadas. | build |
| `/instinct-status` | Muestra los instintos aprendidos (proyecto + global) con su confianza. | build |
| `/instinct-export` | Exporta instintos para compartir. | build |
| `/instinct-import` | Importa instintos desde fuentes externas. | build |
| `/promote` | Promueve instintos del proyecto al ámbito global. | build |
| `/projects` | Lista proyectos registrados y conteos de instintos. | build |

## "Quiero mantener el setup"

| Comando | Qué hace | Agent |
|---------|----------|-------|
| `/setup-pm` | Configura la preferencia de package manager. | build |
| `/skill-create` | Genera skills a partir del análisis de git history. | build |

## "Quiero descubrir el pack"

| Comando | Qué hace | Agent |
|---------|----------|-------|
| `/start-here` | Orientación de 5 minutos: 5 flujos típicos con un ejemplo cada uno. | build |
| `/list-agents` | Lista los 72 agents con descripción y triggers. Filtros: keyword, categoría. | build |
| `/list-skills` | Lista las 20 skills con descripción y triggers. Filtros: keyword. | build |
| `/route` | Sugiere el mejor sub-agente + skills para un request libre. Útil como consulta antes de dispatchar. | build |
| `/pack-doctor` | Diagnostica la salud del pack (10 checks: frontmatter, duplicados, permalinks, etc). | build |

## "Quiero usar un workflow pre-hecho"

| Comando | Qué hace | Agent |
|---------|----------|-------|
| `/flow-bugfix` | Bug fix end-to-end: `/quick-prd` → fix → `/verify` → report → audit. | build |
| `/flow-feature` | Feature nueva end-to-end: `/orchestrate` → implement → `/verify` → report → audit. | build |
| `/flow-refactor` | Refactor end-to-end: `/plan` → refactor → `/verify` → report → audit. | build |
| `/flow-security` | Security review end-to-end: `/security` → fix → `/verify` → report → audit. | build |
| `/opensource-pipeline` | Abrir código: `opensource-forker` → `opensource-sanitizer` (gate) → `opensource-packager`. NO pushea. | build |

## "Quiero colaborar via PR"

| Comando | Qué hace | Agent |
|---------|----------|-------|
| `/pr-review` | Review de un PR de GitHub con dispatch paralelo a 5 reviewers. Veredicto: APPROVE / WARN / BLOCK. | build |
| `/merge-conflict` | Analiza conflictos de merge, los clasifica y propone resolución. | build |

## "Quiero mantener reports"

| Comando | Qué hace | Agent |
|---------|----------|-------|
| `/archive-reports` | Mueve reports viejos a `docs/reports/_archive/{YYYY}/`. NO borra. Default: COMPLETADO >30d. | build |

## "Quiero scaffoldear (extender el pack)"

| Comando | Qué hace | Agent |
|---------|----------|-------|
| `/new-project` | Scaffold de un proyecto nuevo: `docs/{prds,plans,reports,audits,sessions,state,instincts}/` + `PROJECT.md` template + `docs/README.md` index. Flags: `--help`, `--dry-run`, `--force`. | build |
| `/new-skill` | Scaffold de un skill nuevo en `.agents/skills/<name>/SKILL.md`. Genera frontmatter (name, description, triggers) + 8 secciones de body template. Flags: `--help`, `--dry-run`, `--force`, `--triggers <csv>`. | build |
| `/new-agent` | Scaffold de un agent nuevo en `.opencode/agents/<name>.md`. Genera frontmatter (description, mode, permission block) + prompt-defense reference + body template. Flags: `--help`, `--dry-run`, `--force`, `--mode <subagent|primary>`. | build |
