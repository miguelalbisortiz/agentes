---
description: "Desglosa un plan aprobado en tareas atomicas con estado (pending/in_progress/done), cada una ligada al AC que sirve y a los archivos que toca. Genera docs/tasks/{plan}.tasks.md reanudable. Use post-/plan y antes de implementar — nunca implementar sin tasks."
agent: planner
---

# Tasks Command

Desglosar en tareas: $ARGUMENTS

---

## PASO 0 — Localizar el plan y su PRD (OBLIGATORIO)

1. Si `$ARGUMENTS` es path/nombre de plan → usarlo.
2. Si no → `docs/plans/*.plan.md` con `status: APPROVED` y sin `status: DONE` (el más reciente).
3. Leer el plan **entero** y su frontmatter (`prd:`, `status`).
4. Leer el PRD referenciado por `prd:` → sección `## Success Criteria`.
5. Si **no hay plan aprobado** → decir: *"No hay plan aprobado. Corre `/plan` primero."* y parar.
6. Si el plan **ya tiene** `docs/tasks/{mismo-nombre}.tasks.md` → ofrecer continuar desde el estado actual, no regenerar desde cero.

---

## PASO 1 — Reglas de desglose

Cada tarea debe ser **atómica y verificable**. Esta es la diferencia entre un plan útil y uno decorativo.

| Regla | Ejemplo |
|---|---|
| **Una tarea = un resultado verificable** | ✅ "Crear tabla `crops` con 5 columnas" · ❌ "Trabajar en el modelo de datos" |
| **Si supera ~30 min de trabajo → partirla** | ❌ "Implementar todo el módulo de pagos" |
| **Toda tarea sirve a 1+ AC** · si no → `SIN-AC` y preguntar | `→ sirve a: SC-2` |
| **Toda tarea define su verificación** | `flutter test test/crops_test.dart` |
| **Sin archivos → no es tarea de código** | tarea de investigación/documentación va igual, pero marcada `type: research` |
| **Orden por dependencia**, no por gusto | migración → modelo → UI → test |

Tipos: `code` · `test` · `docs` · `config` · `research` · `chore`

---

## PASO 2 — Generar el desglose

Recorrer **cada fase** del plan y emitir sus tareas. No saltarse fases. No agregar trabajo que no esté en el plan (si lo ves → `⚠ FUERA-DE-ALCANCE` y preguntar).

```markdown
---
prd: docs/prds/{...}.prd.md
plan: docs/plans/{...}.plan.md
status: PENDING
created: YYYY-MM-DD_HHMM
---

# Tasks: {Feature Name}

## Resumen
- Total: {N} · pending: {N} · done: 0 · blocked: 0
- AC cubiertos: {N}/{total del PRD}
- AC SIN cobertura: {lista o "ninguno"}

## Fase 1: {nombre}

- [ ] T-001 `code` Crear modelo `Crop` en `lib/models/crop.dart`
      → sirve a: SC-1
      → verifica: `flutter analyze` sin errores
- [ ] T-002 `test` Test de `Crop.fromJson` con JSON valido e invalido
      → sirve a: SC-1
      → verifica: `flutter test test/crop_test.dart`

## Fase 2: {nombre}

- [ ] T-003 `config` ...
```

**Formateo obligatorio por tarea:**
```
- [ ] T-NNN `tipo` {accion concreta + archivo}
      → sirve a: {SC-N / AC-NNN}
      → verifica: {test / comando / "manual: {qué ve el usuario}"}
```

### Cobertura de AC (OBLIGATORIA)

Al terminar, emitir la matriz. **Ningún AC puede quedarse sin tarea:**

```markdown
| AC | Criterio (resumen) | Tareas | Estado |
|----|--------------------|--------|--------|
| SC-1 | ... | T-001, T-002 | pending |
| SC-2 | ... | T-003 | pending |
| AC-003 | ... | — | ⚠ SIN TAREA |
```

- Si un AC queda `⚠ SIN TAREA` → **preguntar antes de continuar**.
- Si hay tareas `SIN-AC` → **preguntar antes de continuar** (¿es alcance legítimo o deriva?).

---

## PASO 3 — Gate de confirmación

```
Tasks generadas: {N} en {M} fases
AC cubiertos: {X}/{Y} · sin tarea: {Z}
Fuera de alcance detectado: {lista o "ninguno"}

¿Guardo docs/tasks/{nombre}.tasks.md y empiezo? (sí/no/ajustar)
```

**NO** implementar nada hasta `sí`.

---

## PASO 4 — Flujo de estado (el día a día)

El archivo es **vivo**, no un entregable de una vez. Actualizar siempre:

| Evento | Acción |
|---|---|
| Empezar tarea | `- [ ]` → `- [~]`, `status: IN_PROGRESS` |
| Terminar tarea | `- [~]` → `- [x]`, agregar línea `✓ {fecha} — {qué quedó}` |
| Bloqueada | `- [ ]` → `- [!]`, línea `⛔ {motivo}`, `status: BLOCKED` |
| Fase completa | Marcar `## Fase N` con `✅ COMPLETA` |
| **Todas done** | `status: DONE` → ofrecer `/verify` |

**Regla**: nunca marcar `[x]` sin haber dejado la línea `→ verifica:` cumplida. Tarea sin verificación no se cierra.

---

## Tras terminar

Cuando `status: DONE` → ofrecer una sola vez:

> "Tasks completas. ¿Corro `/verify` (multi-stack + cruce de AC del PRD)? (s/n)"

Y en `/verify`, la columna de evidencia debe apuntar a estas tareas.

---

## State Persistence (REQUIRED)

```bash
node .opencode/bin/state.js init tasks "" [<plan-path>]
node .opencode/bin/state.js update "" breakdown '{"agentsInvoked":["planner"],"filesModified":[]}'
node .opencode/bin/state.js update "" executing '{"agentsInvoked":["planner"],"filesModified":["<tasks>"]}'
node .opencode/bin/state.js complete ""
node .opencode/bin/state.js fail "" "<mensaje>"
```
