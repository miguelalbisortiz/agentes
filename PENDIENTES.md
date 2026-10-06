# Pendientes

> **Última actualización:** 2026-10-06 · `D:\open` → `main` = `origin/main`
> **Estado del repo:** limpio, 0 sin commitear, 0 sin push, batería completa en verde.

Este fichero es la mano donde se dejó el trabajo después de la auditoría de los cinco
ejes (SDD · Context Engineering · EvalOps · Aislamiento · Seguridad). Borrar cada
apartado conforme se cierre.

---

## Estado de la auditoría

| Eje | Veredicto | Nota |
|---|---|---|
| SDD | 🟢 Fuerte | 9 puertas + 4 flujos; los 4 gates devuelven exit code |
| Context Engineering | 🟢 Fuerte | arranque 5682 B, 40 skills diferidos, 1 MCP activo |
| EvalOps | 🟡 Estructural sí, conductual no | 16 verificadores, 0 golden prompts, 0 ejecuciones |
| Aislamiento | 🟢 Fuerte | 85/85 con `permission`, 0 con los 9 tools en `allow`; scaffold corregido |
| Seguridad | 🟢 Fuerte | 0 secretos literales; **85/85** con Prompt Defense |

---

## P4 — Recortar `AGENTS.md` (única palanca de tokens)

**Estado: 🟡 35 % — lo seguro está hecho; falta la decisión (a)/(b).**

| | inicio | hoy |
|---|---:|---:|
| `AGENTS.md` | 7601 B | **5682 B** |
| boot | 2400 tok | **1921 tok** |
| `measure-tokens` | 19 % | **35 %** |
| meta | — | **≥40 %** |

Faltan **~220 B**. Hay dos caminos y **los decide el usuario**:

| Opción | Llega a | Coste |
|---|---:|---|
| **(a)** Cablear `diagram-generator` y `manual-writer` en `/orchestrate`, y borrar sus **407 B** de `AGENTS.md` | **41 %** | editar `/orchestrate` (no está en la lista de comandos prohibidos) |
| **(b)** Quitar `context7` del bloque MCP activo | **~41 %** sin tocar AGENTS | anula las decisiones **M1/M2** (context7 siempre activo) |

**Descartado:** sacar `Prompt Defense Baseline` (1160 B) → rompería los 85 punteros
creados en P2 y dejaría la seguridad *off*.

**Criterio de hecho:** `node .opencode/bin/measure-tokens.js` → exit 0 (≥40 %).

### Verificado — qué NO se puede mover (no volver a proponerlo)

| Sección | Por qué se queda |
|---|---|
| `Session End` (133 B) | `/session-end` **no escribe `docs/LEARNING.md`**; `project-learning` **solo lo invoca `AGENTS.md`** → se quedaría huérfano |
| `Session Start` (293 B) | `/session-start` cubre solo 2 de 6 pasos (faltan `LEARNING.md`, `state/*.json`, plan activo, *apply learnings*) |
| `Handoff Protocol` (313 B) | *«`audit-orchestrator` es el ÚNICO que puede marcar "entregable"*» → **único en todo el repo** |
| `Agent Availability` (764 B) | es la guarda contra agents inventados cuando hay filtro de stack |
| `Prompt Defense` (1160 B) | seguridad siempre activa + 85 punteros (P2) |
| `Diagram` + `Manual` (407 B) | **ningún comando los invoca** — solo `/list-agents`. Borrar sin cablearlos = capacidades muertas. Ver opción (a) |

### Hallazgos menores (no rompen nada, pero conviene saberlos)

- **Dos cadenas de agentes distintas.** `AGENTS.md` decía
  `prd-agent → planner → build → code-reviewer → audit-orchestrator → manual-writer`;
  `/orchestrate` L67 dice `prd-agent → planner → tdd-guide → code-reviewer → security-reviewer`.
  Con `Execution Order` borrada, **manda la de `/orchestrate`**. Su cola no incluye
  audit ni manual, pero `### Manual Generation` (que se queda) cubre el manual.
- **`/checkpoint` ≠ `checkpoint-mode`.** El comando guarda un registro de progreso
  (tests/build/coverage) y **no hace commit**; el commit `WIP:` vive en el skill.
  Mismo nombre, dos cosas distintas.

---

## Al retomar

```powershell
Push-Location D:\open
```

- El shell arranca en el worktree `...\quiet-tiger`, **no** en `D:\open`.
- **Solo ficheros editados** al commit — nunca `git add -A`.
- **Diff antes de cada commit**; subir solo con todo verde.
- PowerShell 5.1: `.ps1` en **ASCII puro** (si no, mojibake).
- Tras tocar `.opencode/bin` → `node .opencode/bin/counts.js --update` en los `.md`
  con bloque `## Counts`.
- La **baseline** de `measure-tokens` **no se reescribe** — actualizarla haría la meta
  auto-cumplible.

### Batería obligatoria antes de cada commit

```powershell
node .opencode/bin/lint-docs.js --dir D:\open        # R1-R7 = 0
node .opencode/bin/counts.js --check                 # exit 0
node .opencode/bin/wiring-test.js                    # 8/8
node .opencode/bin/validate-frontmatter.js           # 477/0/0
node .opencode/bin/smoke-test.js                     # 31/31
powershell -ExecutionPolicy Bypass -File .opencode/bin/installer-test.ps1   # 48/48
node .opencode/bin/measure-tokens.js                 # rojo deliberado (35%)
```

---

## Hecho y cerrado (no repetir)

| Commit | Qué |
|---|---|
| `b4ad7bb` | MCP activos 4 → 1 (`context7`); boot −1200 tokens |
| `61e4902` | puntero `Prompt Defense` ×76 + `.gitignore` protege `.env`, `*.pem`, `secrets.*` |
| `db21128` | `coding-standards` → `pack-reference`; ruta de `AGENTS.md` en `validate-frontmatter` |
| `0fe4c0c` | `playwright` pasa de `[other]` a categoría `testing` |
| `50d8198` | `wiring-test` (W1–W8) + puntero de `agents-backup` + etiquetas MCP obsoletas |
| `9b1c457` | este fichero |
| `065444e` | **P1** · el scaffold crea agents con least-privilege (`glob+grep+read`) |
| `fbc6678` | **P2** · Prompt Defense en los 11 builders → **85/85** |
| — | **P3** · `/spec-lint` y `/definition-of-done` entran en las 9 conductas obligatorias |
| `ee5897c` | **P4·1** · se quita el auto-checkpoint (contradecía las conductas 3 y 5) |
| `34d35b2` | **P4·2** · `Plan Persistence` + `Session Continuity` → skills/comandos |
| `158b7d7` | **P4·3** · `Execution Order` + `Checkpoint Mode` → `/orchestrate` y `checkpoint-mode` |

**Conteos maestro:** 85 agents · 70 commands · 40 skills · 17 CLIs · 1 active MCP +
14 optional.
