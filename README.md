# Agentes

**Pack portátil de opencode** — un equipo completo de agents, commands y skills que convierte a opencode en un flujo de trabajo guiado por especificación (**SDD**: Spec-Driven Development).

No es una aplicación: es configuración + prompts + herramientas que se copian a cualquier proyecto. Los CLIs usan solo el stdlib de Node (cero dependencias).

<!-- COUNTS-START -->
## Counts

> Auto-managed by `.opencode/bin/counts.js`. Do not edit by hand.
> Regenerate: `node .opencode/bin/counts.js --update <files...>`

- **85** agents (.opencode/agents)
- **71** commands (.opencode/commands)
- **40** skills (.agents/skills)
- **15** native CLIs (.opencode/bin)
- **3** npm plugins + **1** local plugin(s)
- **4** active MCPs + **12** optional MCP(s)
<!-- COUNTS-END -->

## Qué hace

Especificar antes de construir, y demostrar con evidencia que lo construido cumple.

| Componente | Función |
|---|---|
| **Agents** | *Quién* hace el trabajo: roles especializados (`code-reviewer`, `security-reviewer`, `build-error-resolver`, `tdd-guide`, revisores por lenguaje...). Cada uno con descripción, modo y permisos propios. |
| **Commands** | *Qué escribes tú*: `/prd`, `/spec-lint`, `/plan`, `/tasks`, `/verify`... El `AGENTS.md` global obliga a pasos verificables: no se puede saltar la escritura de la especificación. |
| **Skills** | *Conocimiento que se carga solo cuando hace falta* (patrones, checklists, marcos). No ocupan contexto permanente. |
| **CLIs** | *La máquina que valida*: frontmatter, smoke-test, conteos, test del instalador, presupuesto de tokens. |
| **MCPs / plugins** | Conexiones externas (context7, supabase, vercel, stripe) y hooks de comportamiento. |

## El flujo SDD

```text
/prd ──▶ /spec-lint ──▶ /plan ──▶ /tasks ──▶ implementar
                                                │
   /definition-of-done ◀── /trace ◀── /audit-report ◀── /eval ◀── /verify
                                                ▲
                                  /change-request  (cambio de alcance)
```

1. **`/prd`** — requerimiento con criterios de aceptación.
2. **`/spec-lint`** — puntúa la especificación de 0 a 100. Si es débil, no pasa.
3. **`/plan`** — diseño técnico, fases y reversibilidad.
4. **`/tasks`** — desglose atado uno a uno a los criterios de aceptación.
5. **Implementar** — con `tdd-guide`, `code-reviewer` y `security-reviewer`.
6. **`/verify`** — ejecuta pruebas, linters y builds reales.
7. **`/eval` → `/audit-report` → `/trace`** — evidencia: qué criterio cubre qué tarea y qué test.
8. **`/definition-of-done`** — cierre formal.
9. **`/change-request`** — cualquier cambio de alcance vuelve a pasar por la especificación.

Complementos: `/spec-to-tests` (tests desde la especificación), `/quick-prd` (cambios pequeños), `/pack-reference` (manual completo).

## Instalación

### Requisitos

- **Windows** con PowerShell 5.1 o superior (incluido en Windows 10 y 11)
- **Git** para clonar el repositorio
- **Node.js** en el `PATH` — opcional: sin él el instalador funciona igual, pero omite la regeneración de índices y de los bloques `## Counts`

### Paso 1 — Clona el pack

```powershell
git clone https://github.com/miguelalbisortiz/agentes.git
cd agentes
```

### Paso 2 — Instálalo en tu proyecto

**Si el proyecto ya existe**, indica su ruta:

```powershell
.\init-opencode.ps1 -ProjectPath "C:\mi-proyecto"
```

**O en el directorio actual:**

```powershell
.\init-opencode.ps1
```

Si Windows bloquea el script por política de ejecución, lánzalo así:

```powershell
powershell -ExecutionPolicy Bypass -File init-opencode.ps1 -ProjectPath "C:\mi-proyecto"
```

El instalador **no pregunta nada**: se lanza y corre solo hasta el final.

### Qué hace el instalador

Antes de copiar nada **detecta el stack** del proyecto mirando sus ficheros de configuración (`pubspec.yaml` → flutter, `package.json` → node, `pyproject.toml` → python, `Cargo.toml` → rust, `go.mod` → go, `pom.xml` → java...) y descarta los agents de lenguajes que no aplican. Si no reconoce el stack, instala la biblioteca completa.

Luego ejecuta 7 fases en orden:

| # | Fase | Qué ocurre |
|---|---|---|
| 1 | Archivos raíz | Fusiona `opencode.json`, `skills-lock.json` y `.gitignore` |
| 2 | `.opencode/` | Agents, commands, plugins, CLIs, manual, `AGENTS.md` y templates |
| 3 | `.agents/` | Skills y el router que decide cuál se carga |
| 4 | `docs/` | Crea la estructura de documentación — lo omite con `-SkipDocs` |
| 5 | Documentación | README y `docs/PROJECT.md` del pack |
| 6 | Plugins npm | Instala los plugins del pack — lo omite con `-SkipInstall` |
| 7 | Verificación | Recuenta agents, commands y skills, y comprueba los MCPs |

Termina con un resumen que imprime el **recuento real instalado** y el comando para arrancar:

```text
cd C:\mi-proyecto
opencode .
```

### Qué aparece en tu proyecto

| Ruta | Contenido |
|---|---|
| `.opencode/agents/` | Agents filtrados por tu stack (o la biblioteca completa con `-AllAgents`) |
| `.opencode/commands/` | Slash commands |
| `.opencode/bin/` | CLIs de validación |
| `.opencode/AGENTS.md` | Reglas globales de comportamiento |
| `.agents/skills/` | Skills + router |
| `docs/` | Estructura de documentación |
| `opencode.json` | **Fusionado**: conserva lo tuyo y añade los MCPs del pack |
| `.gitignore` | **Fusionado**: conserva tus reglas y añade las del pack |
| `skills-lock.json` | Estado de las skills |

**No se pisa nada**: si ya tienes `opencode.json` o `.gitignore`, el pack solo añade las entradas que faltan. Repetir la instalación es seguro (**idempotente**): no duplica carpetas ni crea anidados.

### Paso 3 — Verifica

Desde la raíz del proyecto instalado:

| Chequeo | Comando |
|---|---|
| Frontmatter de agents, skills y commands | `node .opencode/bin/validate-frontmatter.js` |
| Salud general del pack | `node .opencode/bin/smoke-test.js` |
| Los bloques `## Counts` reflejan lo real en disco | `node .opencode/bin/counts.js --check` |
| El instalador no rompe nada (T1–T7) | `powershell -File .opencode/bin/installer-test.ps1` |
| Presupuesto de tokens vs baseline | `node .opencode/bin/measure-tokens.js` |

Estado actual del pack maestro: `validate` **479 / 0 warnings / 0 fallos** · `smoke-test` **24/24** · `installer-test` **48/48**.

### Paso 4 — Arranca opencode

```powershell
cd C:\mi-proyecto
opencode .
```

Escribe algo como *«Crea una app SaaS con login y pagos»* y el router ya sabe a qué agents y skills llamar.

### Actualizar o reinstalar

Vuelve a ejecutar el mismo comando con la misma ruta. Como la instalación es idempotente, actualiza lo que haya cambiado en el pack sin duplicar nada ni pisar tus archivos.

### Parámetros

| Parámetro | Efecto |
|---|---|
| `-ProjectPath <ruta>` | Proyecto destino (por defecto, el directorio actual) |
| `-PackPath <ruta>` | Origen del pack (por defecto, la carpeta del propio script) |
| `-Stack <nombre>` | Fuerza el stack; si se omite, se detecta automáticamente |
| `-AllAgents` | Instala la biblioteca completa sin filtrar por stack |
| `-SkipInstall` | Omite la instalación de plugins npm |
| `-SkipDocs` | Omite la estructura de `docs/` |

`-Force` sigue aceptándose por compatibilidad, pero no hace falta: el instalador nunca pregunta y siempre sobreescribe.

## Estructura

```text
.
├── README.md                 Este documento
├── init-opencode.ps1         Instalador (única vía de instalación/actualización)
├── opencode.json             Configuración (plugins, MCPs)
├── skills-lock.json          Estado de las skills
├── .gitignore                Reglas de exclusión
├── docs/                     Plantillas y documentación
├── .agents/skills/           Skills + el router (dispatcher)
└── .opencode/
    ├── AGENTS.md             Reglas globales de comportamiento
    ├── agents/               Agents
    ├── commands/             Slash commands
    ├── bin/                  CLIs de validación y utilidades
    ├── manual/               Documentación de referencia
    └── examples/             Proyectos de ejemplo
```

Los ficheros `AGENTS_INDEX.md`, `skills/INDEX.md` y los bloques `## Counts` son **autogenerados**: se regeneran solos en cada instalación, así que nunca llevan cifras falsas.

## Créditos

Derivado de [marchelero/open](https://github.com/marchelero/open).
