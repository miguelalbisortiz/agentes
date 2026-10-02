---
description: "Gate unico de cierre: cruza /verify + /eval + /audit-report + /trace en UN solo veredicto PASS/NO-CLOSE con la lista exacta de lo que bloquea. Responde '¿esto esta listo para dar por terminado?' sin correr 4 comandos a mano. Use al final de un feature, antes de merge/commit grande, o cuando el user diga '¿ya esta listo?'"
agent: report-auditor
---

# Definition of Done Command

Evaluar cierre de: $ARGUMENTS

> **Por qué existe:** hoy para saber si algo está listo cruzas `/verify`, `/eval`,
> `/audit-report` y `/trace` a mano. Este comando los agrega en **un veredicto** y
> **una lista de bloqueos**. No reemplaza a esos comandos — los **consume**.

---

## PASO 0 — Reunir evidencia (lee, no re-ejecuta)

Buscar y leer lo que ya exista:

| Fuente | Qué saca de ahí |
|---|---|
| `docs/prds/{...}.prd.md` | Los criterios reales (`SC-*`/`AC-*`) + milestones |
| `docs/tasks/{...}.tasks.md` | Estado de tareas (`[x]`/`[~]`/`[!]`) y `status` |
| `docs/reports/{...}.report.md` | Último `/verify`: PASS/FAIL + tabla de criterios |
| Sección `## Auditoria` del report | Veredicto de `/audit-report` |
| `/trace --gap` (si se puede correr) | ACs sin plan/tasks/tests |

**Si falta la fuente → no la inventes**, marcarla como `SIN DATOS`.
**Si no hay PRD activo** → decir: *"No hay PRD: no hay definición de 'listo'."* y parar.

Si falta evidencia **reciente** (verify no se corrió tras el último cambio) → **no asumir PASS**; marcar `DESACTUALIZADO` y ofrecer correr `/verify`.

---

## PASO 1 — Los 6 criterios de cierre

Un feature está **listo** solo si los 6 pasan. Cero excepciones:

| # | Criterio | Fuente | Si falla |
|---|---|---|---|
| **D1** | **Spec** — todos los `SC-*`/`AC-*` tienen estado `PASS` (no `FAIL`, no `NOT-VERIFIED`) | report `/verify` + `/eval` | bloquea |
| **D2** | **Técnicas** — analyze/lint/types/tests/build en verde para el stack | report `/verify` | bloquea |
| **D3** | **Tareas** — `docs/tasks` en `status: DONE`, sin `[!]` bloqueadas | tasks | bloquea |
| **D4** | **Auditoría** — `/audit-report` con veredicto `PASS` (no `PASS-WITH-NITS` con pendientes) | sección `## Auditoria` | bloquea |
| **D5** | **Trazabilidad** — ningún AC con `⚠ SIN PLAN` / `SIN TAREA` / `SIN TEST` | `/trace --gap` | bloquea |
| **D6** | **Seguridad** — sin findings ALTOS abiertos | report / `security-reviewer` | bloquea |

**Umbral:** **D1–D6 son binarios.** No existe "listo con 5 de 6". Si D1 falla, no está listo aunque todo lo demás esté verde — eso es exactamente el error que este comando existe para evitar.

---

## PASO 2 — Emitir veredicto

```markdown
## Definition of Done — {feature}

> **Veredicto:** ✅ READY TO CLOSE  |  🟡 READY WITH BLOCKERS  |  ❌ NOT READY
> **Evaluado:** YYYY-MM-DD_HHMM · **Fuente PRD:** {path}

| # | Criterio | Estado | Evidencia |
|---|---|---|---|
| D1 | Spec cumplido | ✅ / ❌ / ⚠ SIN DATOS | {N}/{M} AC en PASS |
| D2 | Checks técnicos | ✅ / ❌ / ⚠ DESACTUALIZADO | {stack} — último verify {fecha} |
| D3 | Tareas completas | ✅ / ❌ | {X}/{Y} done, {Z} bloqueadas |
| D4 | Auditoría | ✅ / ❌ / ⚠ SIN DATOS | veredicto {PASS/PASS-WITH-NITS/FAIL} |
| D5 | Trazabilidad | ✅ / ❌ | {huecos o "sin huecos"} |
| D6 | Seguridad | ✅ / ❌ / ⚠ SIN DATOS | {findings} |

### Bloqueos (los que impiden cerrar)

1. **[D1]** {AC-007 NOT-VERIFIED — falta evidencia de X} → accion: `/verify`
2. **[D3]** {T-012 bloqueada — {motivo}} → accion: {qué desbloquear}

### Pendientes no bloqueantes (opcional cerrar después)
- {lista, si la hay}
```

### Regla de veredicto

| Situación | Veredicto |
|---|---|
| D1–D6 todos ✅ | **✅ READY TO CLOSE** |
| D1–D3 y D6 ✅, pero hay `⚠ SIN DATOS` o `PASS-WITH-NITS` | **🟡 READY WITH BLOCKERS** (cerrable solo con decisión explícita del usuario) |
| 1+ ❌ en cualquiera | **❌ NOT READY** |

> `⚠ SIN DATOS` **nunca se cuenta como ✅**. La falta de evidencia no es evidencia de que está bien.

---

## PASO 3 — Acción

- **✅** → ofrecer commit/PR (el usuario da el verbo; **nunca** commitear por tu cuenta).
- **🟡** → mostrar los pendientes y preguntar: *"¿Los cierro igual con tu aprobación explícita, o los atiendo?"*
- **❌** → lista ordenada de qué corregir y en qué orden, con el comando exacto para cada uno. **No** pedir commit.

---

## Cuándo correr

- Al terminar un feature, antes de merge o commit grande
- Cuando el user diga *"¿ya está listo?"*, *"¿lo cerramos?"*, *"¿puedo hacer PR?"*
- Después de `/audit-report` para tener el veredicto único

## Cuándo NO correr

- Con cambios sin commitear a medio camino → primero `/verify`
- Sin PRD → no hay definición de "listo"
- Para bugs triviales → usar `/verify` directo
