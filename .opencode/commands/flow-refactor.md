---
description: "Workflow completo para refactor. Encadena: /plan → refactor → /verify → report → audit. Para refactors con plan explicito."
agent: build
---

# Flow: Refactor

Workflow completo para refactorizar: $ARGUMENTS

## Cadena automatica

```
plan → refactor → verify → report → audit
```

## Tu Task

### Paso 1 — Plan

Invocar `/plan "$ARGUMENTS"`. El planner genera un plan de refactor:

- Identifica code smells.
- Lista archivos afectados.
- Propone fases (debe ser mergeable incrementalmente).
- **NO requiere PRD** (los refactors no cambian comportamiento).

El plan debe preservar la funcionalidad existente. Si el plan propone cambios de comportamiento, **detener y notificar**:

> "Esto ya no es un refactor puro, es un cambio de comportamiento. Recomiendo `/flow-feature` con PRD. Continuo? (s/n)"

### Paso 2 — Refactor

Implementar el plan:
- Sin tests nuevos (los existentes deben seguir pasando).
- Sin agregar funcionalidad.
- Commit por fase para rollback facil.

### Paso 3 — Verify

Invocar `/verify`.

Si **FAIL** (tests rotos, lint errors, type errors): el refactor rompio algo. **Revertir el ultimo commit** y replantear.

Si **PASS** o **PASS-WITH-NITS**: continuar.

### Paso 4 — Report

Generar `docs/reports/{YYYY-MM-DD_HHMM}-refactor-{name}.report.md` con:

```markdown
# Refactor: {name} — Report de ejecucion

## Status
COMPLETADO

## Contexto
Refactor de {name} segun plan `docs/plans/{name}.plan.md`.

## Cambios
- Archivos refactorizados: N
- LOC eliminados: X
- LOC agregados: Y
- Net: +/- Z

## Verificaciones
- Tests existentes: [PASS/FAIL]
- Coverage: pre X% / post Y%
- Lint: PASS
- Typecheck: PASS

## Comportamiento
- Sin cambios. Todos los tests previos pasan sin modificacion.

## Archivos modificados
- `path/to/file.ts` — [que se refactorizo]
```

### Paso 5 — Audit

Invocar `/audit-report {name}` (sin PRD, asi que audita contra el plan).

El auditor verifica:
- Tests existentes pasan (cobertura preservada).
- Sin cambios de comportamiento.
- Plan implementado segun fases.

## Salida final

```
Refactor completado.

Resumen:
- Plan:     docs/plans/{name}.plan.md
- Report:   docs/reports/{name}.report.md
- Auditoria: [PASS / PASS-WITH-NITS / FAIL]

LOC: pre X / post Y (delta Z)
Tests: pre N / post N (sin cambio, esperado)
Archivos: N modificados

Siguiente paso: commit (espera instruccion explicita del user)
```

## Cuando usar

- Refactor con plan explicito (code smells identificados).
- Cleanup de archivos >800 lineas.
- Extraccion de logica duplicada.
- Cambio de patron (callbacks → async/await, classes → hooks, etc).

## Cuando NO usar

- Refactor chico de 1 archivo (no necesita flow, hacer directo).
- Cambio de comportamiento (usar `/flow-feature`).
- Bug fix (usar `/flow-bugfix`).

---

## State Persistence (REQUIRED)

This flow writes to `docs/state/` so it can be resumed after interruption. See `docs/state/README.md` for the schema.

```bash
# At flow start
STATE="$(node .opencode/bin/state.js init flow-refactor "$ARGUMENTS" [<prd-path>])"
# $STATE holds the path printed by init; reuse it in the calls below

# After each phase
node .opencode/bin/state.js update "$STATE" <phase> '{"agentsInvoked":["..."],"filesModified":["..."]}'

# On success
node .opencode/bin/state.js complete "$STATE"

# On error
node .opencode/bin/state.js fail "$STATE" "<error message>"
```

The flow is resumable: if interrupted, `/session-start` detects active states in `docs/state/` and offers to resume from `currentPhase`.