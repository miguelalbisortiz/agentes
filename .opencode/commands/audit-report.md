---
description: "Audita un report existente contra su PRD origen via report-auditor. Use post-/verify para cruzar evidencia contra el plan original, o cuando el user dice 'audita X' / 'revisa el report de Y'."
agent: report-auditor
---

# Audit Report Command

Auditar el report: $ARGUMENTS

## Tu Task

1. Si `$ARGUMENTS == "index"` o `$ARGUMENTS == "--index"`:
   - Generar `docs/reports/INDEX.md` con tabla de todos los reports.
   - NO invocar auditor. Solo listar.
2. Si `$ARGUMENTS` vacio:
   - Regenerar INDEX.md (silent).
   - Listar `docs/reports/*.md` con su mtime y status.
   - Preguntar al usuario: "Cual report audito?" (mostrar lista).
3. Si `$ARGUMENTS` es un nombre o path:
   - Resolver a `docs/reports/{name}.report.md`.
   - Invocar `report-auditor` agent con ese path.
4. Si `$ARGUMENTS == "quick {name}"`:
   - Modo rapido — solo veredicto + lista de FAILs.
5. Si `$ARGUMENTS == "compare {name1} {name2}"`:
   - Auditar ambos reports y mostrar diff de veredictos.

## INDEX.md format

```markdown
# Reports Index

> Auto-generated. Ultima actualizacion: YYYY-MM-DD_HHMM

| Report | Status | Criterios PRD | Checks tec. | Veredicto | Skill gaps | Fecha |
|--------|--------|---------------|-------------|-----------|------------|-------|
| ex006-csv-import | COMPLETADO | 10/11 (1 not-verified) | 8/8 | PASS-WITH-NITS | 0 | 2026-06-29 |
| auth-refactor | BLOQUEADO | 3/8 | 5/8 | FAIL | 1 | 2026-06-28 |
| ... | ... | ... | ... | ... | ... | ... |

> **Criterios PRD** = los Success Criteria del PRD (los `SC-*`/`AC-*` que pide el spec).
> **Checks tec.** = analyze/lint/test/build (los que corre `/verify`).
> Son columnas distintas a proposito: 8/8 tecnicos con 3/8 criterios de usuario **es un FAIL**, no un PASS. Antes se reportaba una sola columna `Criterios` y ese matiz se perdia.

## Sin auditar

- {reports sin seccion `## Auditoria`}

## Auditados con FAIL

- {reports con veredicto FAIL — requieren atencion}

## Skill gaps recurrentes

| Skill | Frecuencia | Ultima vez |
|-------|-----------|------------|
| security-review | 3 | 2026-06-28 |
| tdd-workflow | 1 | 2026-06-25 |

Si una skill aparece >3 veces, considerar refactor de la skill o del flujo que la invoca.
```

El INDEX se regenera en cada invocacion del command (silencioso si el user no lo pidio). Asi no se desactualiza.

## Salida esperada del auditor

El agent `report-auditor` genera la seccion `## Auditoria` y pregunta si la inyecta en el report. Respetar la respuesta del usuario.

Si el usuario aprueba, la seccion se persiste en `docs/reports/{name}.report.md` (no en archivo separado — es una capa sobre el report).

Si el usuario quiere la auditoria en archivo separado, usar:
`/audit-report {name} --separate` → escribe `docs/audits/{YYYY-MM-DD_HHMM}-{name}.audit.md`.

## Cuándo correr

- Despues de cerrar un plan que produjo cambios.
- Antes de merge / commit de un feature.
- Cuando el usuario dice "audita X" / "revisa el report de Y" / "verifica el PRD Z".
- `/audit-report index` para ver el estado de todos los reports sin auditar uno especifico.
