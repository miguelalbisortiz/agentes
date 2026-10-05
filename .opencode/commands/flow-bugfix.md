---
description: "Workflow completo para bug fix. Encadena: /quick-prd → fix → /verify → report → audit. Para bugs con repro claro."
agent: build
---

# Flow: Bug Fix

Workflow completo para resolver un bug: $ARGUMENTS

## Cadena automatica

```
quick-prd → implement → verify → report → audit
```

## Tu Task

Ejecutar estos pasos en orden, parando en cada checkpoint para pedir confirmacion:

### Paso 1 — Quick PRD

Invocar `/quick-prd "$ARGUMENTS"`. Esto genera un mini-PRD con max 3 criterios.

Si el quick-prd crece en scope durante la generacion (>3 archivos, ambiguedad seria), **detener y recomendar**:

> "Esto ya no es un bug fix chico. Recomiendo `/flow-feature` o regenerar con prd-agent completo. Continuo? (s/n)"

Si continua, proceder con el quick-prd existente.

### Paso 2 — Implement

Implementar el fix siguiendo el quick-prd:
- TDD cuando aplique (test que reproduce el bug primero).
- Sin scope creep.

### Paso 3 — Verify

Invocar `/verify` cuando el fix este listo.

Si **FAIL**: volver a Paso 2.
Si **PASS** o **PASS-WITH-NITS**: continuar.

### Paso 4 — Report

El `/verify` ya auto-genera el report cuando pasa. Confirmar con el user:

> "Report en `docs/reports/{name}.report.md`. Continuo a auditoria? (s/n)"

### Paso 5 — Audit

Si el user acepta, invocar `/audit-report {name}`.

Si veredicto es **FAIL**: volver a Paso 2 con la falla documentada.
Si es **PASS** o **PASS-WITH-NITS**: reportar exito.

## Salida final

```
Bug fix completado.

Resumen:
- Quick-PRD: docs/prds/{name}.prd.md
- Report:    docs/reports/{name}.report.md
- Auditoria: [PASS / PASS-WITH-NITS / FAIL]

Criterios: X/Y pass
Archivos:  N modificados

Siguiente paso: commit (espera instruccion explicita del user)
```

## Cuando usar

- Bug con repro claro y obvio.
- 1-3 archivos afectados.
- Criterio de exito evidente (test que pasa, error que desaparece).

## Cuando NO usar

- Feature nueva (usar `/flow-feature`).
- Refactor (usar `/flow-refactor`).
- Bug con repro vago o ambiguedad seria (usar `prd-agent` completo primero).
- Security bug (usar `/flow-security`).

---

## State Persistence (REQUIRED)

This flow writes to `docs/state/` so it can be resumed after interruption. See `docs/state/README.md` for the schema.

```bash
# At flow start
STATE="$(node .opencode/bin/state.js init flow-bugfix "$ARGUMENTS" [<prd-path>])"
# $STATE holds the path printed by init; reuse it in the calls below

# After each phase
node .opencode/bin/state.js update "$STATE" <phase> '{"agentsInvoked":["..."],"filesModified":["..."]}'

# On success
node .opencode/bin/state.js complete "$STATE"

# On error
node .opencode/bin/state.js fail "$STATE" "<error message>"
```

The flow is resumable: if interrupted, `/session-start` detects active states in `docs/state/` and offers to resume from `currentPhase`.