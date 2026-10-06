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
| Context Engineering | 🟢 Fuerte | arranque 7601 B, 40 skills diferidos, 1 MCP activo |
| EvalOps | 🟡 Estructural sí, conductual no | 16 verificadores, 0 golden prompts, 0 ejecuciones |
| Aislamiento | 🟢 Fuerte | 85/85 con `permission`, 0 con los 9 tools en `allow`; scaffold corregido |
| Seguridad | 🟢 Fuerte | 0 secretos literales; **85/85** con Prompt Defense |

---

## P4 — Recortar `AGENTS.md` (única palanca de tokens)

**Dónde:** `.opencode/AGENTS.md` — hoy **7601 B**, frente a los **7192 B**
de la baseline.

**Problema:** `measure-tokens` sale con exit 1 y **19 %** de ahorro frente a una meta
de **≥40 %**. Con **0** MCPs el techo sería **32 %** — o sea, **solo recortar este
fichero llega al 40 %**.

**Acción:** mover lo que no hace falta en cada turno a un skill diferido (mismo
mecanismo usado en el plan `2026-07-27_1122`).

**Criterio de hecho:** `node .opencode/bin/measure-tokens.js` → exit 0.

- **Ficheros:** 1 + los skills de destino
- **Esperado:** 60–90 min
- **Orden:** después de P3 (que añade líneas) para no medir a medias.

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
node .opencode/bin/measure-tokens.js                 # rojo deliberado (19%)
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

**Conteos maestro:** 85 agents · 70 commands · 40 skills · 17 CLIs · 1 active MCP +
14 optional.
