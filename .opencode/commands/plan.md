---
description: "Create implementation plan from PRD: hereda los Acceptance Criteria literalmente, mapea cada AC a su fase, evalúa riesgos/dependencias, y actualiza el PRD origen (columna Plan). WAIT for confirmation before code."
agent: planner
---

# Plan Command

Create a detailed implementation plan for: $ARGUMENTS

---

## PASO 0 — Localizar el PRD origen (OBLIGATORIO)

1. Si `$ARGUMENTS` es path o nombre de PRD → usarlo.
2. Si no → buscar `docs/prds/*.prd.md` con `Status != COMPLETADO` (el más reciente).
3. Si hay PRD → **leerlo entero**. El plan se **deriva** del PRD; no es una interpretación nueva.
4. Si NO hay PRD → preguntar:
   > "No encontré un PRD activo. ¿Corro `/prd` primero (recomendado) o armo el plan sin spec (menos confiable, sin criterios verificables)?"
   y **esperar respuesta**.

**Regla anti-deriva**: no re-preguntar al usuario lo que el PRD ya respondió (objetivo, alcance, usuarios, restricciones, fuera de alcance). Eso es precisamente lo que evita que el plan se desvíe del spec.

---

## PASO 1 — Requirements Restatement

Restate QUÉ se va a construir, **derivado del PRD** (no inventado):

### Requirements Restatement
[2-4 frases basadas en `## Objective` + `## Out of Scope` del PRD]

Si algo del PRD es ambiguo para planificar → marcar `⚠ NEEDS-CLARIFICATION: {qué}` y preguntar **una sola vez**, agrupando dudas.

---

## PASO 2 — Acceptance Criteria heredados (SECCIÓN OBLIGATORIA)

Copiar **literalmente** desde el PRD (o Acceptance Brief asociado):

- cada checkbox de `## Success Criteria`
- cada `AC-NNN` si existe

**NO resumir. NO reescribir. NO inventar criterios que no estén en el PRD.**

Luego mapear **dónde se verifica** cada uno:

```markdown
### Acceptance Criteria (heredados del PRD)

| # | Criterio (literal del PRD) | Fase que lo implementa | Cómo se verifica |
|---|---|---|---|
| SC-1 | {texto exacto} | Fase 2 | {test / comando / verificación manual} |
| SC-2 | {texto exacto} | Fase 3 | {test / comando / verificación manual} |
| AC-001 | {texto exacto} | Fase 1 | {test / comando} |
```

**Reglas:**
- Si un criterio **no puede** mapearse a ninguna fase → `⚠ SIN IMPLEMENTAR` y preguntar antes de continuar.
- Si un criterio es ambiguo → `⚠ NEEDS-CLARIFICATION`.
- La columna "Cómo se verifica" es **obligatoria**: es lo que `/verify` usará después. Si no se puede verificar, escribir `manual — requiere confirmación del usuario`.

> **Este mapeo es el eslabón que faltaba**: sin él, `/verify` no sabe qué evidencia buscar para cada criterio.

---

## PASO 3 — Implementation Phases

Desglose en fases. **Cada paso debe referenciar los AC que sirve**:

```markdown
### Fase 1: {nombre}
- Step 1.1 — {qué hacer} (File: path/archivo) → sirve a: SC-1, AC-001
- Step 1.2 — {qué hacer} (File: path/archivo) → sirve a: SC-1

### Fase 2: {nombre}
- Step 2.1 — {qué hacer} (File: path/archivo) → sirve a: SC-2
```

Si un paso **no sirve a ningún AC** → es trabajo fuera del spec. Preguntar o moverlo a "Fuera de alcance".

---

## PASO 4 — Dependencies

[Dependencias externas: APIs, servicios, librerías, credenciales necesarias]

---

## PASO 5 — Risks

- **HIGH**: [riesgos críticos que pueden bloquear]
- **MEDIUM**: [riesgos a addressar]
- **LOW**: [menores]

---

## PASO 6 — Estimated Complexity

[Alta/Media/Baja con estimación de tiempo]

---

**WAITING FOR CONFIRMATION**: ¿Procedo con este plan? (sí/no/modificar)

---

**CRITICAL**: NO escribir código hasta que el usuario confirme explícitamente con "sí", "proceed" o afirmativo equivalente.

---

## PASO 7 — Tras la aprobación (OBLIGATORIO)

Solo después de que el usuario apruebe:

### 1. Escribir el plan

Guardar en `docs/plans/{YYYY-MM-DD_HHMM}-{name}.plan.md` con este frontmatter **obligatorio**:

```markdown
---
prd: docs/prds/{YYYY-MM-DD_HHMM}-{name}.prd.md
status: APPROVED
created: YYYY-MM-DD_HHMM
---

# Implementation Plan: {Feature Name}
```

> Sin el campo `prd:` el `report-auditor` no puede cruzar criterios contra el spec original.

### 2. Actualizar el PRD origen

En el archivo del PRD, en `## Delivery Milestones`:

| Antes | Después |
|---|---|
| `\| 1 \| {name} \| {outcome} \| pending \| — \|` | `\| 1 \| {name} \| {outcome} \| in-progress \| docs/plans/{plan}.plan.md \|` |

- Columna **Plan** ← path del plan recién creado
- **Status** ← `in-progress` (en el milestone que este plan implementa)

### 3. Confirmar en una línea

```
Plan creado: docs/plans/{...}.plan.md · PRD actualizado: docs/prds/{...}.prd.md
Siguiente: implementar → /verify → /audit-report
```

---

## Post-Plan: Audit al Implementar

Después de que el plan sea aprobado e implementado, el flujo termina con `/verify` que auto-genera un report (ver `/verify`). Si no se corre verify, documentar manualmente:

1. Al cerrar la implementación, generar `docs/reports/{YYYY-MM-DD_HHMM}-{name}.report.md` referenciando el plan.
2. Ofrecer: "¿Audito contra el PRD origen con `/audit-report {name}`? (s/n)".

El auditor verifica que TODOS los milestones del PRD (no solo los del plan) quedaron cumplidos.

**Cuándo aplicar**: planes que producen cambios de código, especialmente cuando hay un PRD origen.
**Cuándo NO aplicar**: planes de investigación, planes descartados, planes revertidos.

---

## State Persistence (REQUIRED)

Este flujo escribe en `docs/state/` para poder resumirse tras una interrupción. Ver `docs/state/README.md` para el schema.

```bash
# Al inicio del flujo
node .opencode/bin/state.js init plan "" [<prd-path>]
# Capturar el path que imprime

# Después de cada fase
node .opencode/bin/state.js update "" <phase> '{"agentsInvoked":["..."],"filesModified":["..."]}'

# Al terminar bien
node .opencode/bin/state.js complete ""

# En error
node .opencode/bin/state.js fail "" "<mensaje de error>"
```

El flujo es reanudable: si se interrumpe, `/session-start` detecta states activos en `docs/state/` y ofrece resumir desde `currentPhase`.
