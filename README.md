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

En la raíz del proyecto destino:

```powershell
powershell -ExecutionPolicy Bypass -File init-opencode.ps1
```

| Parámetro | Efecto |
|---|---|
| `-ProjectPath <ruta>` | Proyecto destino (por defecto, el directorio actual) |
| `-Stack <nombre>` | Fuerza el stack; si se omite, se detecta automáticamente |
| `-AllAgents` | Instala la biblioteca completa sin filtrar por stack |
| `-PackPath <ruta>` | Origen del pack (por defecto, la carpeta del script) |
| `-SkipInstall` / `-SkipDocs` | Omite dependencias o la documentación del proyecto |
| `-Force` | Sobrescribe sin confirmar |

**El filtrado por stack** poda los agents, comandos y skills que no aplican al proyecto y ajusta el router en consecuencia (por ejemplo, en un proyecto Flutter: 59 agents · 66 commands · 37 skills). La instalación **no pisa** el `.gitignore` ni el `opencode.json` existentes: los fusiona conservando lo propio. Es **idempotente**: repetirla no duplica nada.

## Verificación

| Chequeo | Comando |
|---|---|
| Frontmatter de agents, skills y commands | `node .opencode/bin/validate-frontmatter.js` |
| Salud general del pack | `node .opencode/bin/smoke-test.js` |
| Los bloques `## Counts` reflejan lo real en disco | `node .opencode/bin/counts.js --check` |
| El instalador no rompe nada (T1–T7) | `powershell -File .opencode/bin/installer-test.ps1` |
| Presupuesto de tokens vs baseline | `node .opencode/bin/measure-tokens.js` |

Estado actual: `validate` **479 / 0 warnings / 0 fallos** · `smoke-test` **24/24** · `installer-test` **48/48**.

## Estructura

```text
.
├── AGENTS.md                 Reglas globales de comportamiento
├── init-opencode.ps1         Instalador (única vía de instalación/actualización)
├── opencode.json             Configuración (plugins, MCPs)
├── .agents/skills/           40 skills + el router (dispatcher)
└── .opencode/
    ├── agents/               85 agents
    ├── commands/             71 slash commands
    ├── bin/                  15 CLIs de validación y utilidades
    ├── manual/               Documentación de referencia
    └── examples/             3 proyectos de ejemplo
```

Los ficheros `AGENTS_INDEX.md`, `skills/INDEX.md` y los bloques `## Counts` son **autogenerados**: se regeneran solos en cada instalación, así que nunca llevan cifras falsas.

## Créditos

Derivado de [marchelero/open](https://github.com/marchelero/open).
