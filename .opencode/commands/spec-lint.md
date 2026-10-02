---
description: "Linter PREVENTIVO de calidad del spec: valida un PRD antes de aprobarlo contra vaguedad, criterios no medibles, ambiguedad, y secciones faltantes. Devuelve score + fixes concretos linea por linea. Use post-/prd, pre-/plan, o cuando el user dice 'revisa el spec' / 'el PRD esta bien?'."
agent: prd-agent
---

# Spec Lint Command

Lintear el spec: $ARGUMENTS

> **Este comando es PREVENTIVO.** Corre **antes** de que exista código. Su contrario es `/audit-report` y `prd-reviewer`, que son RETROSPECTIVOS (¿se construyó lo que decía el PRD?). Uno evita el problema, el otro lo detecta tarde.

---

## PASO 0 — Localizar el spec

1. Si `$ARGUMENTS` es path/nombre → usarlo.
2. Si no → `docs/prds/*.prd.md` con `Status != COMPLETADO` (el más reciente).
3. Si no hay PRD → *"No hay PRD para lintear. Corre `/prd` primero."* y parar.
4. Leerlo **entero**.

---

## PASO 1 — Reglas (correr TODAS)

### A. Palabras vagas prohibidas

Buscar en `## Success Criteria`, `## Objective` y cualquier `AC-NNN`:

| Categoría | Palabras a marcar | Problema |
|---|---|---|
| Velocidad | rápido, rápido, fast, fluido, optimizado, performante | ¿cuánto ms? |
| Facilidad | fácil, intuitivo, simple, amigable, cómodo, clean | ¿quién lo juzga? |
| Calidad | robusto, escalable, profesional, moderno, bonito, atractivo | ¿cuántos usuarios/conexiones? |
| Cantidad vaga | varios, algunos, muchos, etc., y más, completo, total | ¿cuántos? |
| Modal | debería, probablemente, tal vez, quizás, si es posible, ojalá | ¿es requisito o no? |
| Tiempo | en breve, pronto, cuando se pueda, ASAP | ¿fecha/condición? |

**Excepción legítima** (no marcar): palabras dentro de `## Assumptions` o `## Risks` — ahí la vaguedad es correcta porque es lo que se va a validar.

### B. Criterios no medibles

Un criterio **debe** poder responder: *¿cómo sé, hoy, si se cumplió sí o no?*

```
¿El criterio tiene un umbral o un observable concreto?
├── SI (número, porcentaje, tiempo, estado visible, resultado de test) → OK
├── PARCIAL ("debe cargar bien")                                     → WARN: sin umbral
└── NO (subjetivo: "debe gustar")                                    → FAIL: no verificable
```

### C. Criterios con formato EARS ausente o roto

Verificar que los criterios usen estructura **EARS** (ver skill `intent-driven-development`):

| Patrón | Forma | Ejemplo |
|---|---|---|
| `WHILE` | WHILE {situación}, el sistema SHALL {acción} | WHILE el usuario está offline, el sistema SHALL encolar el guardado |
| `WHERE` | WHERE {contexto}, el sistema SHALL {acción} | WHERE el plan es free, el sistema SHALL mostrar el límite |
| `IF` | IF {evento}, el sistema SHALL {acción} | IF el pago falla, el sistema SHALL mostrar el error y reintentar |
| `WHEN` | WHEN {disparo}, el sistema SHALL {acción} | WHEN el cultivo se crea, el sistema SHALL asignarle ID |
| `UNLESS` | UNLESS {excepción}, el sistema SHALL {acción} | UNLESS es admin, el sistema SHALL denegar el acceso |
| `SHALL` | Requisito obligatorio sin trigger | El sistema SHALL exportar a CSV |
| `SHALL NOT` | Prohibición explícita | El sistema SHALL NO almacenar la tarjeta |

- Criterio sin verbo **SHALL/SHALL NOT** → `WARN: falta modalidad obligatoria`.
- Criterio con **"puede"** (optional) sin marcar `OPTIONAL` → `WARN: opcionalidad ambigua`.

### D. Secciones obligatorias

| Sección | ¿Existe? | ¿No vacía? |
|---|---|---|
| `## Objective` | | |
| `## Success Criteria` (≥1) | | |
| `## Out of Scope` (≥1) | | |
| `## Assumptions` | | |
| `## Risks` | | |
| `## Delivery Milestones` (≥1) | | |
| `Status` en frontmatter | | |

- **`Out of Scope` vacío o ausente** → `FAIL` (sin él, el alcance no tiene borde).
- **0 Success Criteria** → `FAIL`.
- **Criterio duplicado o casi idéntico** → `WARN`.

### E. Anti-patrones de spec

| Regla | Problema |
|---|---|
| Detalles de **implementación** en el PRD (paths de archivo, librerías, nombres de función) | Eso pertenece a `/plan`, no al spec → `WARN` |
| **"TBD" / "por definir"** en un criterio | → `FAIL: criterio no definido` |
| Criterio **contradictorio** con otro | → `FAIL` |
| Criterio **sin Dueño/Evidencia** de cómo se prueba | → `WARN` |

---

## PASO 2 — Emitir resultado

```markdown
## Spec Lint — {nombre del PRD}

**Score: {N}/100** · {PASS | PASS-WITH-NITS | FAIL}

| # | Regla | Severidad | Línea | Problema | Fix sugerido |
|---|---|---|---|---|---|
| 1 | Palabra vaga | WARN | 42 | "rápido" sin umbral | → "carga en <2s en 4G" |
| 2 | Out of Scope vacío | FAIL | — | sección ausente | → añadir al menos 1 ítem |
| 3 | Sin SHALL | WARN | 57 | "el sistema exporta" | → "el sistema SHALL exportar" |

### Resumen
- FAIL: {N} · WARN: {N}
- Criterios linteados: {N} · con EARS: {N} · sin EARS: {N}
```

### Efecto en el veredicto

| Situación | Score | Acción |
|---|---|---|
| 0 FAIL, 0 WARN | **PASS** (100) | Aprobado, pasar a `/plan` |
| 0 FAIL, 1-3 WARN | **PASS-WITH-NITS** (85-99) | Corregir los WARN |
| 0 FAIL, 4+ WARN | **FAIL** (<85) | Demasiada vaguedad: reescribir criterios |
| 1+ FAIL | **FAIL** | **Bloquea `/plan`** hasta corregir |

---

## PASO 3 — Gate

- Si **FAIL** → decir explícitamente: *"Spec con FAIL: no pasa a `/plan`. Corrijo los puntos marcados si me autorizas."*
- Si **PASS-WITH-NITS** → ofrecer aplicar los fixes.
- Si **PASS** → *"Spec limpio. Siguiente: `/plan`."*

Preguntar UNA sola vez si quiere que aplique los fixes. Si dice que no, respetar.

---

## Cuándo correr

- **Después de `/prd`** (recomendado, antes de `/plan`) ← el punto principal
- Cuando el user dice *"revisa el spec"*, *"¿el PRD está bien?"*, *"¿es medible?"*
- Antes de un `/change-request` de riesgo ALTO (para no propagar un spec vago)
- **NO** para auditar si se construyó → eso es `/audit-report`
