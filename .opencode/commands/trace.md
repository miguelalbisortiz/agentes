---
description: "Trazabilidad bidireccional spec <-> codigo: dado un AC muestra sus tareas/tests/archivos, y dado un archivo muestra que ACs toca y si quedan sin cubrir. Matrix completa con /trace --matrix. Use para estimar impacto de un cambio o responder 'que se rompe si toco esto'."
agent: planner
---

# Trace Command

Trazar: $ARGUMENTS

**Este comando resuelve las DOS direcciones.** Todo lo demás del pack solo va hacia adelante (spec → plan → verify → audit).

```
Hacia adelante:  AC-001 → plan → tareas → tests → archivos → estado
Hacia atras:     lib/checkout.dart → ¿que ACs toca? → ¿siguen verificados?
```

---

## Parseo de `$ARGUMENTS`

| Entrada | Modo |
|---|---|
| `SC-1`, `AC-004`, `AC-012` | **A**: trazo del criterio hacia adelante |
| `lib/models/crop.dart`, `src/auth.ts`, cualquier path | **B**: trazo del archivo hacia atrás |
| `--matrix`, `matrix`, vacío | **C**: matriz completa |
| `--gap`, `gap` | **D**: solo huecos (AC sin tareas/tests) |

---

## PASO 0 — Cargar el grafo (todos los modos)

Leer, si existen:

1. PRD activo → `## Success Criteria` (los `SC-*`/`AC-*`)
2. Plan asociado → `docs/plans/*.plan.md` con `prd:` apuntando a ese PRD
3. Tasks → `docs/tasks/{plan}.tasks.md`
4. Tests → buscar en el stack detectado:
   - Flutter: `test/**/*_test.dart`
   - Node: `**/*.test.ts`, `**/*.spec.ts`
   - Python: `test_*.py`, `*_test.py`
   - Rust: `#[test]` en `src/`
   - Go: `*_test.go`
5. Último report → `docs/reports/*.report.md` con la tabla de criterios (para el **estado** de cada AC: PASS/FAIL/NOT-VERIFIED)

**Si falta el PRD** → *"No hay PRD activo: no hay nada que trazar."* y parar.

> Si falta `docs/tasks/`, avisar y sugerir `/tasks` — la traza hacia adelante queda incompleta sin él.

---

## Modo A — De un AC hacia adelante

```bash
# entrada: AC-004
```

```markdown
## Trazo: AC-004

**Criterio (del PRD):** {texto literal}
**Último estado:** PASS | FAIL | NOT-VERIFIED | SIN VERIFICAR  (fecha, del report)

| Capa | Dónde | Estado |
|---|---|---|
| Plan | `docs/plans/{...}.plan.md` → Fase 2, Step 2.3 | aprobado |
| Tasks | T-004, T-005 | T-004 ✓ · T-005 pending |
| Tests | `test/checkout_test.dart` → `testCheckoutUnderThreeClicks` | pasa |
| Archivos | `lib/checkout/page.dart`, `lib/checkout/controller.dart` | — |

**Cobertura:** completa (plan ✓ · tasks ✓ · test ✓ · estado ✓)

**Si el estado es FAIL o NOT-VERIFIED** → accion concreta:
> "AC-004 NOT-VERIFIED: falta evidencia de `testCheckoutUnderThreeClicks`. Correr `/verify` o confirmación manual."
```

**Nota:** los tests se asocian por nombre/descripción que contenga el id del AC (`AC-004`, `ac_004`) o por la columna `→ verifica:` de la tarea. Si ninguno coincide → `Tests: — (sin vincular)` y es un hallazgo, no un error.

---

## Modo B — De un archivo hacia atrás

```bash
# entrada: lib/checkout/page.dart
```

```markdown
## Trazo inverso: lib/checkout/page.dart

| AC | Criterio (resumen) | Tareas que lo tocan | Estado |
|---|---|---|---|
| SC-1 | checkout en <3 clics | T-004 | PASS |
| AC-004 | persistencia del carrito | T-005 | NOT-VERIFIED |

**Impacto:** 2 ACs afectados.
**Si cambia este archivo → re-verificar:** SC-1, AC-004
**Tests que lo cubren:** test/checkout_test.dart
**Tests que NO lo cubren:** — (ninguno) | {lista}
```

Si el archivo **no está vinculado a ningún AC** → decirlo claramente:
> *"Sin vínculo con ningún criterio: es trabajo fuera de spec o falta trazabilidad (¿corres `/tasks`?)"*

Esto es exactamente lo que responde *"¿qué se rompe si cambio esto?"*.

---

## Modo C — Matriz completa (`--matrix`)

```markdown
## Matriz de trazabilidad — {PRD}

| AC | Criterio | Plan | Tasks | Tests | Archivos | Estado |
|----|----------|:----:|:-----:|:-----:|:--------:|--------|
| SC-1 | ... | ✓ | T-004 ✓ | ✓ | 2 | PASS |
| SC-2 | ... | ✓ | T-006 pending | ✗ | 1 | NOT-VERIFIED |
| AC-003 | ... | ✗ | — | — | — | ⚠ SIN PLAN |

**Leyenda:** ✓ completo · ✗ ausente · — no aplica

**Totales**
- ACs: {N} · con plan: {X} · con tasks: {Y} · con tests: {Z} · PASS: {P}
- Huecos: {lista}
```

Opcional: escribir en `docs/audits/{fecha}-{prd}.trace.md` si el user lo pide.

---

## Modo D — Solo huecos (`--gap`)

Lista **únicamente** lo que falta, ordenado por riesgo:

```markdown
## Huecos de trazabilidad

1. **AC-003** — sin plan (riesgo ALTO: criterio sin implementar ni estimar)
2. **SC-2** — sin test (riesgo MEDIO: nadie lo verifica)
3. **AC-007** — NOT-VERIFIED desde 2026-10-01 (riesgo MEDIO)
4. `lib/utils/helpers.dart` — sin AC vinculado (riesgo BAJO: posible deriva)

Sugerido: `/tasks` para 1-2, `/verify` para 3.
```

---

## Reglas

- **Nunca inventar** un vínculo AC↔test que no exista en el código. `sin vincular` es una respuesta válida.
- **Nunca marcar PASS** por tener test: el estado real viene del último report, no de la existencia del archivo.
- Si un AC tiene `NOT-VERIFIED` → es **hallazgo**, siempre visible.
- Salida breve: modos A/B/D son cortos. Solo `--matrix` es largo.

---

## Cuándo correr

- Antes de modificar un archivo (¿qué toco?)
- Tras `/tasks` (¿queda algún AC sin cubrir?)
- Antes de cerrar un feature (`--matrix` como resumen final)
- Cuando el user pregunta *"¿qué se rompe si cambio X?"*, *"¿esto está probado?"*, *"¿qué falta?"*
