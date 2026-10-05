---
description: "Workflow completo para feature nueva. Encadena: /orchestrate → implement → /verify → report → audit. Para features con PRD."
agent: build
---

# Flow: Feature

Workflow completo para implementar una feature: $ARGUMENTS

## Cadena automatica

```
orchestrate → implement → verify → report → audit
```

## Tu Task

### Paso 1 — Orchestrate

Invocar `/orchestrate "$ARGUMENTS"`. Esto:

1. Genera PRD via `prd-agent` (con intent map y confirmation).
2. Genera plan via `planner`.
3. Despues de aprobacion del user, implementa (puede invocar `tdd-guide`, `code-reviewer`, etc).
4. Genera report al cerrar (Phase 4 obligatoria).

El orquestador maneja los sub-pasos internamente. Tu solo lo invocas y esperas.

### Paso 2 — Verify

Despues de que el orchestrate complete (incluso si tuvo nits), correr `/verify`.

Si **FAIL**: el flow se detiene. Volver al orchestrate o abrir quick-prd para cada falla.
Si **PASS** o **PASS-WITH-NITS**: continuar.

### Paso 3 — Report consolidation

Si el orchestrate ya genero report, este se actualiza con los resultados del verify.

Si no hay report todavia (caso raro), generarlo manualmente con el template.

### Paso 4 — Audit

Invocar `/audit-report {name}`.

Si **FAIL**: documentar las fallas y volver al orchestrate para plan de correccion.
Si **PASS** o **PASS-WITH-NITS**: reportar exito.

## Salida final

```
Feature completada.

Resumen:
- PRD:      docs/prds/{name}.prd.md
- Plan:     docs/plans/{name}.plan.md
- Report:   docs/reports/{name}.report.md
- Auditoria: [PASS / PASS-WITH-NITS / FAIL]

Criterios PRD: X/Y pass
Agentes usados: prd-agent, planner, tdd-guide, code-reviewer, ...
Archivos: N modificados

Siguiente paso: commit (espera instruccion explicita del user)
```

## Cuando usar

- Feature nueva con ambiguedad que requiere intent map.
- Feature con multiples criterios de exito.
- Feature que toca >3 archivos.
- Cualquier cosa que justifique un PRD formal.

## Cuando NO usar

- Bug fix chico (usar `/flow-bugfix`).
- Refactor sin cambio de comportamiento (usar `/flow-refactor`).
- Security review de codigo existente (usar `/flow-security`).
- One-liner (no usar flow, hacer directo).

---

## State Persistence (REQUIRED)

This flow writes to `docs/state/` so it can be resumed after interruption. See `docs/state/README.md` for the schema.

```bash
# At flow start
node .opencode/bin/state.js init flow-feature "" [<prd-path>]
# Capture the printed path; use it instead of "" in the calls below

# After each phase
node .opencode/bin/state.js update "" <phase> '{"agentsInvoked":["..."],"filesModified":["..."]}'

# On success
node .opencode/bin/state.js complete ""

# On error
node .opencode/bin/state.js fail "" "<error message>"
```

The flow is resumable: if interrupted, `/session-start` detects active states in `docs/state/` and offers to resume from `currentPhase`.