---
description: "Gestiona un cambio de spec a mitad de ciclo: evalua impacto sobre ACs/fases/archivos ya implementados, actualiza el PRD con revision numerada (CR-NN), propaga al plan y marca lo obsoleto. Use cuando el requisito cambia DESPUES de que el PRD fue aprobado."
agent: prd-agent
---

# Change Request Command

Gestionar cambio de spec para: $ARGUMENTS

---

## Cuándo usarlo / NO usarlo

| Situación | Qué usar |
|---|---|
| El requisito cambió **después** de aprobar el PRD | ✅ `/change-request` |
| El PRD aún no existe o está en borrador | ❌ Editar el PRD directo con `/prd` |
| Es solo un detalle de implementación (nombre de archivo, librería) | ❌ Eso va en `/plan`, no toca el spec |
| Se cayó un feature entero | ✅ `/change-request` (lo marca `REMOVED`) |
| El usuario duda entre 2 opciones | ❌ Aclarar con `/prd` antes de escribir nada |

**Regla**: si el cambio altera un criterio de aceptación, el alcance o el objetivo → es change request. Si no lo altera → no lo es.

---

## PASO 1 — Localizar el contexto

1. Si `$ARGUMENTS` es path/nombre de PRD → usarlo.
2. Si no → `docs/prds/*.prd.md` con `Status != COMPLETADO` (el más reciente).
3. Leer el PRD **entero**.
4. Buscar el plan asociado: columna `Plan` en `## Delivery Milestones`, o frontmatter `prd:` en `docs/plans/*.plan.md`.
5. Si **no hay PRD** → decir: *"No hay PRD activo que cambiar. Corre `/prd` primero."* y parar.

---

## PASO 2 — Capturar el cambio (máx 2 preguntas, una sola tanda)

No interrogar. Preguntar **una sola vez**, agrupado:

1. **Qué cambia** — en una frase del usuario (si `$ARGUMENTS` ya lo dice, no preguntar).
2. **Por qué** — el motivo (nuevo requisito, error del spec, cambio de negocio, descubrimiento técnico).

Si algo crítico falta → `⚠ NEEDS-CLARIFICATION: {qué}` y preguntar junto con lo anterior.

---

## PASO 3 — Clasificar e impacto (OBLIGATORIO antes de tocar nada)

Clasificar el cambio:

| Tipo | Significado |
|---|---|
| `ADD` | Agrega un criterio/feature nuevo |
| `MODIFY` | Altera un criterio existente |
| `REMOVE` | Elimina un criterio/feature |
| `DEFER` | Se posterga a un milestone posterior |
| `CORRECTION` | El spec estaba mal/redacción, sin cambio de alcance real |

Luego **medir el impacto** — esta es la parte que evita el desorden:

```markdown
### Impacto del CR-NN

**Tipo:** ADD / MODIFY / REMOVE / DEFER / CORRECTION

**Criterios afectados:**
| AC | Estado actual | Efecto del cambio |
|---|---|---|
| SC-2 | PASS | → MODIFY: ahora pide X en vez de Y |
| AC-004 | implementado | → REMOVE: se vuelve obsoleto |

**Fases del plan afectadas:** Fase 2, Fase 3
**Archivos ya implementados que quedan invalidos:** lib/checkout.dart, lib/widgets/pago.dart
**Trabajo ya hecho que se descarta:** {resumen, si aplica}
**Riesgo:** ALTO | MEDIO | BAJO
```

**Reglas de impacto:**
- Si afecta **1+ criterios ya en `PASS`** → riesgo `ALTO` y **debe** re-verificarse.
- Si el cambio invalida trabajo ya mergeado → mencionarlo explícitamente. Nunca ocultarlo.
- Si **ningún** criterio ni fase cambia → no es un change request; avisar y terminar.

---

## PASO 4 — Gate de confirmación (HUMANO, OBLIGATORIO)

Presentar el impacto y **esperar**:

```
CR-{NN}: {título del cambio}
Tipo: {ADD/MODIFY/...} · Riesgo: {ALTO/MEDIO/BAJO}
Afecta: {N} criterios, {N} fases, {N} archivos ya implementados
Trabajo descartado: {sí/no, cuánto}

¿Aplico el cambio al PRD y al plan? (sí / no / ajustar)
```

**NO** escribir nada hasta `sí` / `proceed` / afirmativo equivalente.

---

## PASO 5 — Ejecutar la propagación (OBLIGATORIO, en este orden)

### 1. Renumerar criterios afectados

- Criterio cambiado → prefijo `[revised]` y **nuevo número** (`AC-004` → `AC-012 [revised]`).
- **Nunca** reutilizar un número viejo: los reports y `/verify` anteriores lo referencian.
- Criterio eliminado → mantener la fila con estado `REMOVED (CR-NN)` en vez de borrarla.

### 2. Actualizar el PRD

- `## Success Criteria`: aplicar adds/modifies/removes con su tag `[revised]` / `[removed by CR-NN]`.
- `## Delivery Milestones`: ajustar outcome/fecha si el alcance cambió.
- `## Change Log` (**añadir sección si no existe**):

```markdown
## Change Log

| CR | Fecha | Tipo | Resumen | ACs afectados | Estado |
|----|-------|------|---------|---------------|--------|
| CR-01 | YYYY-MM-DD | MODIFY | {resumen} | AC-004 → AC-012 [revised] | APLICADO |
```

- Cambiar `Status` del PRD a `REVISED` si hay criterios `[revised]` sin re-verificar.

### 3. Actualizar el plan asociado (si existe)

- Frontmatter: `prd_revision: CR-NN`
- Fases afectadas: marcar pasos como `OBSOLETO (CR-NN)` o reemplazarlos.
- Si el plan está en `APPROVED` y el cambio es `ALTO` riesgo → bajar a `DRAFT` y pedir re-aprobación.

### 4. Actualizar el estado de verificación

- Todo criterio afectado que estaba `PASS` → `NOT-VERIFIED` hasta nueva corrida.
- Dejar anotado: *"Tras CR-NN correr `/verify` de nuevo antes de cerrar."*

### 5. Confirmar en una línea

```
CR-NN aplicado · PRD: {path} (Status: REVISED) · Plan: {path} · {N} ACs afectados
Siguiente: /verify → /audit-report
```

---

## Reglas duras

- **Prohibido** editar el PRD "en paralelo" sin pasar por este flujo: sin el `Change Log` y la renumeración, `/verify` y `/audit-report` quedan apuntando a criterios viejos.
- **Prohibido** borrar criterios: se marcan `REMOVED`, no se eliminan.
- **Prohibido** aplicar el cambio antes del gate de PASO 4.
- Un CR = un cambio coherente. Si hay 3 cambios independientes → 3 CRs.

---

## State Persistence (REQUIRED)

```bash
# Al iniciar
node .opencode/bin/state.js init change-request "" [<prd-path>]

# Tras capturar impacto
node .opencode/bin/state.js update "" impact '{"agentsInvoked":["prd-agent"],"filesModified":[]}'

# Al aplicar
node .opencode/bin/state.js update "" applied '{"agentsInvoked":["prd-agent"],"filesModified":["<prd>","<plan>"]}'

# Fin
node .opencode/bin/state.js complete ""
# Error
node .opencode/bin/state.js fail "" "<mensaje>"
```
