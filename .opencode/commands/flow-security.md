---
description: "Workflow completo para security review. Encadena: /security → fix → /verify → report → audit. Para auditorias de seguridad con remediacion."
agent: build
---

# Flow: Security

Workflow completo para security review: $ARGUMENTS

## Cadena automatica

```
security → fix → verify → report → audit
```

## Tu Task

### Paso 1 — Security Review

Invocar `/security "$ARGUMENTS"`. El security-reviewer agent:

- Escanea codigo con lens OWASP Top 10.
- Identifica CRITICAL y HIGH issues.
- Produce lista de remediaciones concretas.

### Paso 2 — Triaje

Para cada issue encontrado:

```
¿CRITICAL o HIGH?
├── SI → Bloqueante. Proceder a fix inmediato.
├── MEDIUM → Recomendar fix, preguntar al user.
└── LOW → Documentar en report, no fix automatico.
```

El user decide si fixear los MEDIUM o solo los CRITICAL/HIGH.

### Paso 3 — Fix

Para cada issue a fixear:

1. Crear quick-PRD si es chico, o mini-plan si es sistematico.
2. Aplicar el fix.
3. Agregar test que cubre el vector de ataque (TDD security).
4. Repetir hasta cubrir todos los issues del triaje.

### Paso 4 — Verify

Invocar `/verify`.

Si **FAIL** (test falla, lint error): el fix introdujo regresion. Volver a Paso 3.
Si **PASS** o **PASS-WITH-NITS**: continuar.

### Paso 5 — Report

Generar `docs/reports/{YYYY-MM-DD_HHMM}-security-{name}.report.md` con:

```markdown
# Security Review: {name} — Report de ejecucion

## Status
COMPLETADO

## Issues encontrados

| # | Severidad | Vector | Status |
|---|-----------|--------|--------|
| 1 | CRITICAL | SQL injection en `users/search` | FIXED |
| 2 | HIGH | XSS en `comments` | FIXED |
| 3 | MEDIUM | CSRF falta token en `forms` | DOCUMENTADO (no fixed) |
| 4 | LOW | Error messages leak info | DOCUMENTADO (no fixed) |

## Fixes aplicados
- [issue 1]: archivo, linea, que cambio
- [issue 2]: archivo, linea, que cambio

## Tests agregados
- `tests/security/sql-injection.test.ts` — reproduce y valida fix de issue 1
- `tests/security/xss.test.ts` — reproduce y valida fix de issue 2

## Issues NO fixeados (justificacion)
- [issue 3]: razon (ej: "out of scope, abrir ticket")
- [issue 4]: razon
```

### Paso 6 — Audit

Invocar `/audit-report {name}`.

El auditor verifica:
- Todos los CRITICAL y HIGH fixeados tienen test.
- No se introdujeron nuevas vulnerabilidades.
- Issues NO fixeados estan justificados en el report.

## Salida final

```
Security review completado.

Resumen:
- Issues encontrados: N (X CRITICAL, Y HIGH, Z MEDIUM, W LOW)
- Issues fixeados: M
- Tests de seguridad: K agregados
- Report:  docs/reports/{name}.report.md
- Auditoria: [PASS / PASS-WITH-NITS / FAIL]

Siguiente paso:
- Si quedan issues MEDIUM/LOW sin fixear, crear tickets
- Commit (espera instruccion explicita del user)
```

## Cuando usar

- Despues de un cambio en auth, endpoints, manejo de datos sensibles.
- Antes de un release.
- Despues de un incidente de seguridad.
- Periodicamente (cada 1-3 meses) en proyectos con datos de usuario.

## Cuando NO usar

- Sin cambios de codigo (usar `npx ecc-agentshield` standalone).
- Refactor puro (usar `/flow-refactor`).
- Bug no relacionado a security (usar `/flow-bugfix`).

---

## State Persistence (REQUIRED)

This flow writes to `docs/state/` so it can be resumed after interruption. See `docs/state/README.md` for the schema.

```bash
# At flow start
STATE="$(node .opencode/bin/state.js init flow-security "$ARGUMENTS" [<prd-path>])"
# $STATE holds the path printed by init; reuse it in the calls below

# After each phase
node .opencode/bin/state.js update "$STATE" <phase> '{"agentsInvoked":["..."],"filesModified":["..."]}'

# On success
node .opencode/bin/state.js complete "$STATE"

# On error
node .opencode/bin/state.js fail "$STATE" "<error message>"
```

The flow is resumable: if interrupted, `/session-start` detects active states in `docs/state/` and offers to resume from `currentPhase`.