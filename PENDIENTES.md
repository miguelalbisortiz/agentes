# Pendientes

> **Última actualización:** 2026-10-05 · `D:\open` → `main` = `origin/main` = `50d8198`
> **Estado del repo:** limpio, 0 sin commitear, 0 sin push, batería completa en verde.

Este fichero es la mano donde se dejó el trabajo después de la auditoría de los cinco
ejes (SDD · Context Engineering · EvalOps · Aislamiento · Seguridad). Borrar cada
apartado conforme se cierre.

---

## Estado de la auditoría

| Eje | Veredicto | Nota |
|---|---|---|
| SDD | 🟢 Fuerte | 9 puertas + 4 flujos; los 4 gates devuelven exit code |
| Context Engineering | 🟢 Fuerte | arranque 7570 B, 40 skills diferidos, 1 MCP activo |
| EvalOps | 🟡 Estructural sí, conductual no | 16 verificadores, 0 golden prompts, 0 ejecuciones |
| Aislamiento | 🟢 Fuerte | 85/85 con `permission`, 0 con los 9 tools en `allow` |
| Seguridad | 🟢 Bueno | 0 secretos literales; 11 agents sin Prompt Defense |

---

## P1 — El scaffold crea agents permisivos

**Dónde:** `.opencode/bin/scaffold-new-agent.js:39`

```js
const PERMISSION = arg('--permission', 'bash: allow, read: allow, write: allow, edit: allow,
  glob: allow, grep: allow, webfetch: allow, task: allow, skill: allow');
```

**Problema:** los 85 agents actuales son de menos privilegio (nadie tiene los 9 tools
en `allow`), pero **cualquier agent nuevo nace con todo abierto**. El pack enseña una
cosa y su propia herramienta hace la contraria.

**Acción:** cambiar el valor por defecto por uno mínimo coherente con el resto del
pack. Mantener la flag `--permission` para quien quiera abrirlo a mano.

**Criterio de hecho:** crear un agent con el scaffold y comprobar que no nace con los
9 tools.

- **Ficheros:** 1 (más la ayuda que imprime el propio script)
- **Esperado:** ~10 min

---

## P2 — Prompt Defense ausente en 11 agents

**Dónde:** 11 ficheros, todos de la familia *builder/integrator*:

```
api-integrator      auth-builder        devops-deploy
fullstack-builder   graphql-builder     legacy-modernizer
mobile-builder      payment-integrator  realtime-builder
supabase-builder    testing-auto
```

**Problema:** 74/85 llevan la marca; **estos 11 no**. Y son justo los que tocan
**pagos, auth y despliegues**.

**Acción:** añadir en cada uno la línea ya estandarizada en el resto:

```html
<!-- Prompt Defense Baseline: see AGENTS.md § Prompt Defense Baseline (GLOBAL) -->
```

**Criterio de hecho:** el recuento pasa de 74/85 a **85/85**.

- **Ficheros:** 11 (mecánico, mismo patrón que el commit `61e4902`)
- **Esperado:** ~15 min

---

## P3 — Dos puertas del SDD no están en `AGENTS.md`

**Dónde:** `.opencode/AGENTS.md`

**Problema:** el arranque sí nombra `/prd`, `/verify` y `/orchestrate`, pero
**no `/spec-lint` ni `/definition-of-done`** — que son precisamente las dos puertas
que *pueden fallar*. Si nadie las escribe, no se ejecutan.

**Acción:** incluirlas en la lista obligatoria.

**Criterio de hecho:** ambas aparecen en `AGENTS.md`.

- **Ficheros:** 1
- **Esperado:** ~10 min
- ⚠️ **Advertencia:** `AGENTS.md` es el fichero de arranque. Añadir texto **sube** el
  consumo de tokens y empeora `measure-tokens`. Hacerlo **antes** de P4.

---

## P4 — Recortar `AGENTS.md` (única palanca de tokens)

**Dónde:** `.opencode/AGENTS.md` — hoy **7570 B / 136 líneas**, frente a los **7192 B**
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

**Conteos maestro:** 85 agents · 70 commands · 40 skills · 17 CLIs · 1 active MCP +
14 optional.
