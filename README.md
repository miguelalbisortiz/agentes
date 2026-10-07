# Agentes

**Pack portátil de opencode** — un equipo completo de agents, commands y skills que convierte a opencode en un flujo de desarrollo guiado por especificación y verificado en cada paso.

No es una aplicación: es configuración + prompts + herramientas que se copian a cualquier proyecto. Los CLIs usan solo el stdlib de Node (cero dependencias).

Sobre el ecosistema de desarrollo de software con IA, este pack no aplica una práctica sino **cuatro**:

| Práctica | Cómo está cubierta |
|---|---|
| **Spec-driven** | especificar antes de construir y demostrar al cerrar — el ciclo entero en orden de gates: `/prd` → `/spec-lint` → `/plan` → `/tasks` → `/verify` → `/audit-report` → `/trace` → `/definition-of-done` |
| **Context engineering** | los skills se cargan solo cuando hacen falta; `AGENTS.md` no se llena de todo |
| **Verification gate** | `/verify` ejecuta tests y builds reales; `/definition-of-done` solo cierra con evidencia |
| **Eval-driven** | un dataset de invariantes y un gate en CI que no deja pasar un cambio que las rompa |

<!-- COUNTS-START -->
## Counts

> Auto-managed by `.opencode/bin/counts.js`. Do not edit by hand.
> Regenerate: `node .opencode/bin/counts.js --update <files...>`

- **85** agents (.opencode/agents)
- **70** commands (.opencode/commands)
- **45** skills (.agents/skills)
- **19** native CLIs (.opencode/bin)
- **3** npm plugins + **1** local plugin(s)
- **1** active MCP + **14** optional MCP(s)
<!-- COUNTS-END -->

## Qué hace

Especificar antes de construir, y demostrar con evidencia que lo construido cumple.

| Componente | Función |
|---|---|
| **Agents** | *Quién* hace el trabajo: roles especializados (`code-reviewer`, `security-reviewer`, `build-error-resolver`, `tdd-guide`, revisores por lenguaje...). Cada uno con descripción, modo y permisos propios. |
| **Commands** | *Qué escribes tú*: `/prd`, `/spec-lint`, `/plan`, `/tasks`, `/verify`... El `AGENTS.md` global obliga a pasos verificables. |
| **Skills** | *Conocimiento que se carga solo cuando hace falta* — patrones, checklists, marcos. No ocupan contexto permanente. |
| **CLIs** | *La máquina que valida*: frontmatter, prosa, cableado, smoke-test, conteos, instalador, presupuesto de tokens y las invariantes de comportamiento. |
| **MCPs / plugins** | Conexiones externas: `context7` activo por defecto, 14 más en opt-in (`supabase`, `vercel`, `stripe`, `playwright`...) — cada uno se enciende con `/mcp-on`. |

La lista completa de los **70 comandos**, agrupados por intención, está en [`.opencode/manual/COMMANDS.md`](.opencode/manual/COMMANDS.md); el mapa de los **85 agents** por intención, en [`.opencode/manual/ROUTE.md`](.opencode/manual/ROUTE.md).

## Cómo empezar

Todo empieza por una de estas dos preguntas.

### No sé qué hacer

| Qué escribes | Qué pasa |
|---|---|
| `/route "lo que quiero, en lenguaje normal"` | te da 1 recomendación + 2 alternativas + el comando exacto para copiar |
| `/start-here` | 5 flujos típicos (construir, arreglar, revisar, refactorizar, salud) con un ejemplo cada uno |
| `/list-agents` o `/list-skills` | inventario completo para hojear |

> **`/route` es read-only**: recomienda, no conduce. **No ejecuta nada** — te dice qué escribir y lo lanzas tú.

```text
/route "añadir módulo de pagos con Stripe"

→ Recommended: /flow-feature
  Why: feature nueva
  Run: /flow-feature "añadir módulo de pagos con Stripe"

(y tú copias y ejecutas ese Run)
```

### Sí sé qué hacer

| La tarea es | Escribe |
|---|---|
| una feature nueva | `/flow-feature "…"` — encadena todo |
| un bug con reproducción | `/flow-bugfix "pasos para reproducir"` |
| un refactor | `/flow-refactor "…"` |
| seguridad | `/flow-security` |
| una revisión de código | `/code-review` |
| algo pequeño | `/quick-prd "…"` |
| el ciclo entero, con varios agents | `/orchestrate "…"` |
| una pregunta normal | **no escribas nada** — se responde directo |

Los cuatro `/flow-*` y `/orchestrate` **sí encadenan**. La conducta 8 del paquete lo dice claro: **cero sub-agentes por defecto**, solo se encadena cuando la tarea lo merece.

### Proyecto nuevo

```powershell
# 1. instala el pack en la carpeta del proyecto
node init-opencode.js --project-path "C:\mi-proyecto"

# 2. arranca
cd C:\mi-proyecto
opencode .

# 3. crea el contexto del proyecto (conducta 9)
/project-init

# 4. empieza
/flow-feature "…"
```

### Proyecto existente

```powershell
# 1. instala o actualiza (idempotente: no pisa nada)
node init-opencode.js --project-path "C:\mi-proyecto"

# 2. arranca
cd C:\mi-proyecto
opencode .

# 3. recupera el hilo de la sesión anterior
/session-start

# 4. continúa
/route "…"
```

## El flujo SDD

```text
/prd ──▶ /spec-lint ──▶ /plan ──▶ /tasks ──▶ implementar
                                                │
   /definition-of-done ◀── /trace ◀── /audit-report ◀── /verify
                                                ▲
                                  /change-request  (cambio de alcance)
```

1. **`/prd`** — requerimiento con criterios de aceptación.
2. **`/spec-lint`** — puntúa la especificación de 0 a 100. Si es débil, no pasa.
3. **`/plan`** — diseño técnico, fases y reversibilidad.
4. **`/tasks`** — desglose atado uno a uno a los criterios de aceptación.
5. **Implementar** — con `tdd-guide`, `code-reviewer` y `security-reviewer`.
6. **`/verify`** — ejecuta pruebas, linters y builds reales.
7. **`/audit-report` → `/trace`** — evidencia: qué criterio cubre qué tarea y qué test.
8. **`/definition-of-done`** — cierre formal.
9. **`/change-request`** — cualquier cambio de alcance vuelve a pasar por la especificación.

**Todo el ciclo de una vez**: `/orchestrate` encadena el flujo multi-agente completo y arranca en la Fase 0 invocando solo al `prd-agent`, para que la especificación no se pueda saltar ni a mano.

**Flujos pre-armados**: `/flow-feature`, `/flow-bugfix`, `/flow-refactor` y `/flow-security` montan los recorridos habituales. Si el final es publicar, `/opensource-pipeline` hace lo suyo.

Complementos: `/spec-to-tests` (tests desde la especificación), `/quick-prd` (cambios pequeños), `pack-reference` (skill con el manual completo).

### Quién manda

Hay tres capas, y manda una distinta de lo que suena:

| Capa | Papel |
|---|---|
| **`AGENTS.md`** | la ley: se carga **siempre** y tiene las 9 conductas obligatorias (no opt-in) |
| **`router` skill** | decide qué agent o skill encaja — se carga **bajo demanda** |
| **`/orchestrate`** | el conductor del ciclo multi-agente, **no** el jefe. Para tareas simples manda la conducta 8 y respondes directo |

## El equipo se adapta a tu proyecto

SDD es un **estándar**, no una plantilla con el mismo equipo para todos: el proceso es idéntico en cualquier proyecto, y **quién trabaja en él se decide según el stack**. Eso es exactamente lo que hace el filtro al instalar.

**Siempre entra** — el núcleo spec-driven, que no depende de ningún lenguaje:

`/prd` · `/spec-lint` · `/plan` · `/tasks` · `/orchestrate` · `/verify` · `/audit-report` · `/trace` · `/definition-of-done` · `/change-request`

y con ellos los agents de proceso: `prd-agent`, `planner`, `tdd-guide`, `code-reviewer`, `security-reviewer`, `doc-updater`... **Estos nunca se podan**: son los que sostienen las 9 fases de arriba.

**Se adapta** — los reviewers y resolvers atados a un lenguaje:

| Tu proyecto | Entran | Se descartan |
|---|---|---|
| Flutter | `flutter-reviewer`, `dart-build-resolver` | los de Rust, Go, Java, JS/TS... |
| Node / React / Vue | `react-reviewer`, `vue-reviewer`, `typescript-reviewer`... | los de Python, PHP, Swift... |
| Python | `python-reviewer`, `django-build-resolver`, `fastapi-reviewer`... | los de JS/TS, Go, Rust... |
| Go, Rust, Java, Kotlin, C#, C++, PHP, Swift | los de su lenguaje | el resto |

Los skills también se ajustan, pero con criterio conservador: solo los estrictamente JS/TS (`drizzle-patterns`, `turso-libsql`, `clerk-auth`) se descartan fuera de Node. El resto son multi-stack o los usan agents de otros procesos.

### Nada queda suelto

Descartar un agente puede dejar referencias colgando. El instalador las limpia **en el mismo paso**, no después:

| Riesgo | Qué ocurre |
|---|---|
| Un comando apunta con `agent:` a un agente descartado | Se descarta también el comando |
| El router despacha a un skill que ya no está | Se borra su fila en `router/SKILL.md` |
| Un punto de despacho no sabe qué hacer si falta el agente | Cada punto documenta el fallback |

Y no se deja a la buena fe. El `smoke-test` lo comprueba en **cada** instalación con la batería `[Stack filter integrity]`:

- **`no orphan commands`** — el `agent:` de cada comando apunta a un agente instalado.
- **`dispatch points document the stack fallback`** — todos los puntos de despacho explican qué hacer cuando un agente no existe.

`installer-test` lo repite además en los escenarios reales de instalación. **Si algo quedara suelto, el test falla** en lugar de dejarlo pasar.

## Instalación

### Requisitos

- **Git** para clonar el repositorio
- **Node.js 18 o superior** en el `PATH` — es el **único** requisito

**No hace falta Windows ni PowerShell.** El instalador corre en Windows, Linux y macOS. El `.ps1` clásico se conserva como alternativa para quien prefiera esa vía en Windows.

### Paso 1 — Clona

```bash
git clone https://github.com/miguelalbisortiz/agentes.git
cd agentes
```

### Paso 2 — Instala en tu proyecto

Linux y macOS:

```bash
node init-opencode.js --project-path /ruta/a/mi-proyecto
```

Windows:

```powershell
node init-opencode.js --project-path "C:\mi-proyecto"
```

O en el directorio actual, sin indicar ruta:

```bash
node init-opencode.js
```

**Alternativa en Windows** — el instalador original de PowerShell:

```powershell
.\init-opencode.ps1 -ProjectPath "C:\mi-proyecto"
```

Si Windows bloquea el script por política de ejecución:

```powershell
powershell -ExecutionPolicy Bypass -File init-opencode.ps1 -ProjectPath "C:\mi-proyecto"
```

> **Los dos producen exactamente el mismo árbol.** La CI lo comprueba fichero a fichero: 249 archivos, 0 diferencias de contenido.

El instalador **no pregunta nada**: se lanza y corre solo hasta el final.

### Qué hace

Antes de copiar nada **detecta el stack** del proyecto mirando sus ficheros de configuración (`pubspec.yaml` → flutter, `package.json` → node, `pyproject.toml` → python, `Cargo.toml` → rust, `go.mod` → go...) y descarta los agents de lenguajes que no aplican. Si no reconoce el stack, instala la biblioteca completa.

Luego ejecuta 7 fases en orden:

| # | Fase | Qué ocurre |
|---|---|---|
| 1 | Archivos raíz | Fusiona `opencode.json`, `skills-lock.json` y `.gitignore` |
| 2 | `.opencode/` | Agents, commands, plugins, CLIs, manual, `AGENTS.md` y templates |
| 3 | `.agents/` | Skills y el router que decide cuál se carga |
| 4 | `docs/` | Crea la estructura de documentación — lo omite con `--skip-docs` |
| 5 | Documentación | README y `docs/PROJECT.md` del pack |
| 6 | Plugins npm | Instala los plugins del pack — lo omite con `-SkipInstall` |
| 7 | Verificación | Recuenta agents, commands y skills, y comprueba los MCPs |

Termina con un resumen que imprime el **recuento real instalado**.

### Qué aparece en tu proyecto

| Ruta | Contenido |
|---|---|
| `.opencode/agents/` | Agents filtrados por tu stack (o la biblioteca completa con `--all-agents`) |
| `.opencode/commands/` | Slash commands |
| `.opencode/bin/` | CLIs de validación |
| `.opencode/AGENTS.md` | Reglas globales de comportamiento |
| `.agents/skills/` | Skills + router |
| `docs/` | Estructura de documentación |
| `opencode.json` | **Fusionado**: conserva lo tuyo y añade los MCPs del pack |
| `.gitignore` | **Fusionado**: conserva tus reglas y añade las del pack |
| `skills-lock.json` | **Fusionado**: estado de las skills |

**No se pisa nada**: si ya tienes `opencode.json` o `.gitignore`, el pack solo añade las entradas que faltan. Repetir la instalación es seguro (**idempotente**): no duplica carpetas ni crea anidados.

### Parámetros

Cada flag de `init-opencode.js` con su equivalente en el `.ps1`:

| Node | PowerShell | Efecto |
|---|---|---|
| `--project-path <ruta>` | `-ProjectPath <ruta>` | Proyecto destino (por defecto, el directorio actual) |
| `--pack-path <ruta>` | `-PackPath <ruta>` | Origen del pack (por defecto, la carpeta del propio script) |
| `--stack <nombre>` | `-Stack <nombre>` | Fuerza el stack; si se omite, se detecta automáticamente |
| `--all-agents` | `-AllAgents` | Instala la biblioteca completa sin filtrar por stack |
| `--skip-install` | `-SkipInstall` | Omite la instalación de plugins npm |
| `--skip-docs` | `-SkipDocs` | Omite la estructura de `docs/` |

`--force` / `-Force` se aceptan por compatibilidad, pero no cambian nada: el instalador nunca pregunta y siempre sobreescribe.

### Actualizar

Vuelve a ejecutar el mismo comando con la misma ruta. Como la instalación es idempotente, actualiza lo que haya cambiado sin duplicar nada ni pisar tus archivos.

## Verificación, CI y EDD

### Batería local

Se corre desde la raíz del pack:

| Chequeo | Comando | Estado |
|---|---|---|
| Prosa: enlaces rotos y mojibake (R1–R7) | `node .opencode/bin/lint-docs.js` | **224 .md · 0 hallazgos** |
| Los bloques `## Counts` reflejan lo real | `node .opencode/bin/counts.js --check` | **exit 0** |
| Cableado: command → agent → skill (W1–W8) | `node .opencode/bin/wiring-test.js` | **8/8** |
| Frontmatter de agents, skills y commands | `node .opencode/bin/validate-frontmatter.js` | **477 / 0 / 0** |
| Salud general del pack | `node .opencode/bin/smoke-test.js` | **31/31** |
| El instalador no rompe nada | `powershell -File .opencode/bin/installer-test.ps1` | **48/48** |
| Invariantes de comportamiento | `node .opencode/bin/eval-static.js` | **9/9** |
| Presupuesto de tokens | `node .opencode/bin/measure-tokens.js` | **35 %** · suelo 30 % PASS |

### Gate en CI

[`.github/workflows/ci.yml`](.github/workflows/ci.yml) corre **en cada push y en cada pull request** en **dos jobs**: `verify` (Windows, con **ambos** instaladores) y `linux` (Ubuntu, con el instalador Node). Un cambio que rompa cualquier chequeo **no llega**.

`measure-tokens` corre ahí **solo informativo** (`continue-on-error`). Sale en **verde** cuando se cumple el suelo del 30 % — que hoy se cumple (35 %) — y solo se pone en rojo si cae por debajo. **La meta del 40 % se reporta como `OPEN`, no como fallo**: un objetivo aspiracional que hace enrojar un comando que todo el mundo ejecuta en local, mientras la CI lo deja pasar, es una métrica sobre la que nadie actúa. El suelo real lo fija el caso `E7`.

### Las 9 invariantes

Los casos viven en [`evals/cases/static.json`](evals/cases/static.json) — son **datos**, no código: añadir una regresión no exige tocar el runner. El diseño completo está en [`evals/README.md`](evals/README.md).

| Id | Qué protege |
|---|---|
| E1 | `AGENTS.md` no vuelve a autorizar commits automáticos |
| E2 | las 9 conductas obligatorias siguen completas |
| E3 | la baseline de Prompt Defense sigue presente |
| E4 | todo agent referencia esa baseline |
| E5 | 0 huérfanos en agents, skills y commands |
| E6 | cada puntero de sección resuelve a un encabezado |
| E7 | `measure-tokens` no cae por debajo del 30 % |
| E8 | los 4 gates del ciclo SDD existen |
| E9 | la conducta de consentimiento git sigue intacta |

### Presupuesto de tokens

`measure-tokens` compara contra la baseline histórica del PRD `2026-08-12-optimize-pack-token-consumption`. **La baseline no se reescribe** — actualizarla haría que la meta fuera auto-cumplible.

```text
AGENTS.md   5682 bytes (~1421 tokens)
boot        ~1921 tokens   vs baseline ~2948
SAVINGS     35%            suelo 30% PASS · meta 40% OPEN (faltan ~152 tokens)
```

**Lo que ese número no cubre.** OpenCode anuncia en cada paso del modelo la descripción de cada skill —`id + name + description`, nunca el cuerpo—, y esa lista **no está en `bootTokens`**:

| Concepto | Coste | ¿Siempre? |
|---|---:|---|
| `AGENTS.md` + MCP + plugins | ~1 921 tok | ✅ sí (lo que mide el número de arriba) |
| 45 descripciones de skills | ~2 870 tok | ✅ sí — se listan en cada paso |
| 85 descripciones de agents | ~5 118 tok | ✅ sí |
| **boot real** | **~9 909 tok** | |
| Cuerpos `SKILL.md` | — | ❌ bajo demanda |
| Router (`router` + `route`) | ~7 497 tok | ❌ solo al dispatchar |

No se pliega a `savingsPct` porque **la baseline no tiene su propio catálogo**: meterlo ahí falsearía el porcentaje que exige `E7`. Para ocultar un skill de la lista sin eliminarlo existe `opencode/autoinvoke: false` — se sigue pudiendo cargar por id.

## Estructura

```text
.
├── README.md                  Este documento
├── init-opencode.js           Instalador (Windows / Linux / macOS)
├── init-opencode.ps1          Instalador alternativo para Windows
├── opencode.json              Configuración (plugins, MCPs)
├── skills-lock.json           Estado de las skills
├── .gitignore                 Reglas de exclusión
├── .github/workflows/ci.yml   Gate de CI
├── docs/                      Plantillas y documentación
├── evals/                     Casos de regresión (EDD)
├── .agents/skills/            Skills + el router (dispatcher)
└── .opencode/
    ├── AGENTS.md              Reglas globales de comportamiento
    ├── AGENTS_INDEX.md        Índice de agents (autogenerado)
    ├── agents/                Agents
    ├── commands/              Slash commands
    ├── bin/                   CLIs de validación y utilidades
    ├── manual/                Documentación de referencia
    ├── plugins/               Hooks de comportamiento
    └── templates/             Plantillas (PROJECT.md, etc.)
```

Los ficheros `AGENTS_INDEX.md`, `skills/INDEX.md` y los bloques `## Counts` son **autogenerados**: se regeneran en cada instalación, así que nunca llevan cifras falsas.

## Créditos

Derivado de [marchelero/open](https://github.com/marchelero/open).
