# Guía de opencode

> Punto de entrada al pack portable de opencode. Cópialo a cualquier proyecto, reinicia opencode y empieza a trabajar.

## ¿Qué incluye?

<!-- COUNTS-START -->
## Counts

> Auto-managed by `.opencode/bin/counts.js`. Do not edit by hand.
> Regenerate: `node .opencode/bin/counts.js --update <files...>`

- **72** agents (.opencode/agents)
- **64** commands (.opencode/commands)
- **20** skills (.agents/skills)
- **13** native CLIs (.opencode/bin)
- **3** npm plugins + **1** local plugin(s)
- **2** active MCPs + **10** optional MCP(s)
<!-- COUNTS-END -->

Detalles:

- Sub-agentes: revisores, planners, resolvers, especialistas por stack
- Skills portables: patrones de API, TDD, seguridad, error handling, testing, refactoring, debugging, `router`, etc.
- Slash commands: atajos recurrentes
- MCPs activos: `context7` (docs) + `playwright` (browser)
- Plugins npm: `opencode-vibeguard`, `opencode-pty`, `@tarquinen/opencode-dcp` (+ `@opencode-ai/plugin` peer)
- Plugin local: `.opencode/plugins/hookify.js` con 2 hooks (SecretBlocker + DestructiveWarner). Auto-cargado, zero install
- **3 ejemplos downstream** en `.opencode/examples/` (node-api, python-data, react-app) — borrar tras grokking el pack
- CLIs nativos: cero dependencias, solo Node stdlib (ver `node .opencode/bin/counts.js --json`)

## Instalación

```bash
# copia las partes portables a tu proyecto
cp -r .opencode opencode.json .agents /ruta/a/tu/proyecto/

# crea el directorio de project docs
mkdir -p /ruta/a/tu/proyecto/docs

# abre opencode en ese proyecto
cd /ruta/a/tu/proyecto && opencode .
```

> Windows PowerShell: `Copy-Item -Path ".opencode","opencode.json",".agents" -Destination "C:\ruta\a\tu\proyecto" -Recurse -Force`

> Si tu proyecto ya tiene un `README.md`, no se toca. El primer `/refresh-project` auto-genera `docs/PROJECT.md` desde tu stack.

## 9 comportamientos obligatorios (siempre activos)

1. **Caveman mode** — respuestas tersas, ~75% menos tokens. Solo se sale en advertencias de seguridad, acciones irreversibles, secuencias multi-paso o cuando dices "habla normal".
2. **PRD-first** — "construir X" / "crear Y" / "agregar Z" → `@prd-agent` o `/prd` PRIMERO. Nunca se propone una solución sin antes clarificar la intención y escribir el PRD. Solo se omite en preguntas y respuestas, arreglos de una línea, reportes de bug con reproducción o cuando dices "skip PRD" de forma explícita.
3. **Git: nunca commit/push sin permiso explícito** — el agent espera tu "commitea" / "push" en el turno actual. "dale" del turno anterior NO cuenta.
4. **Session memory (auto-snapshot)** — "listo" / "bye" / "hasta mañana" → snapshot automático en `docs/sessions/`. No hace falta `/session-end` manual.
5. **Acciones destructivas requieren consentimiento explícito** — `git commit` / `push` / `rm -rf` / `DROP TABLE` necesitan verbo explícito en ESE turno.
6. **Report + Audit (trazabilidad)** — flujos con agentes dejan artefactos en `docs/reports/` + `docs/audits/`. No se ejecutan agentes en el vacío.
7. **Flow suggestions (primary proactivo)** — si tu request matchea `/flow-feature` / `/flow-bugfix` / `/flow-refactor` / `/flow-security`, el primary lo ofrece antes de implementar.
8. **Mandatory Routing Protocol** — el primary auto-clasifica el request, carga el `router` skill (merged agent + skill), y dispatcha 1-3 sub-agentes + 1-2 skills antes de responder, salvo pure Q&A.
9. **Always-On Project Context** — el primary garantiza que `docs/PROJECT.md` esté vigente antes de cualquier task no-trivial. Auto-busca si falta, auto-refresca si stale (>7d).

## 9 comandos principales

| Comando | Función |
|---------|---------|
| `/prd` | Clarifica intención y escribe el PRD |
| `/plan` | Plan de implementación a partir de un PRD |
| `/orchestrate` | Flujo multi-agente (Phase 0 = prd-agent automático) |
| `/verify` | Valida cambios (revisión de código + seguridad + revisor del lenguaje) |
| `/code-review` | Revisión de código puntual |
| `/security` | Auditoría de seguridad puntual |
| `/project-status` | Check freshness de `docs/PROJECT.md` sin escribir |
| `/session-start` / `/session-end` | Memoria entre sessions (automática al cerrar) |
| `/context-budget` | Audita el presupuesto de contexto (skills, agentes, sessions) |

Lista completa: `node .opencode/bin/context.js` o explora `.opencode/commands/`.

## 13 CLIs nativos (cero dependencias, solo Node stdlib)

```bash
node .opencode/bin/smoke-test.js              # 20 comprobaciones estructurales
node .opencode/bin/validate-frontmatter.js    # valida frontmatter de agentes/skills/comandos (incluye body-refs check)
node .opencode/bin/context.js                 # informe de presupuesto de contexto
node .opencode/bin/counts.js                  # --json / --update <files> / --check  (single source of truth)
node .opencode/bin/instinct.js                # add/status/projects/promote/evolve/export/import
node .opencode/bin/refresh-project.js         # regenera docs/PROJECT.md (--status, --auto, --dry-run, --check)
node .opencode/bin/build-agents-index.js      # regenera .opencode/AGENTS_INDEX.md
node .opencode/bin/build-skills-index.js      # regenera .agents/skills/INDEX.md
node .opencode/bin/state.js                   # recovery state por command
node .opencode/bin/setup-mcp.js               # wizard interactivo para activar MCPs opcionales
node .opencode/bin/scaffold-new-project.js    # scaffold <name>  (crea docs/{prds,plans,...} + PROJECT.md)
node .opencode/bin/scaffold-new-skill.js      # scaffold <name>  (crea .agents/skills/<name>/SKILL.md)
node .opencode/bin/scaffold-new-agent.js      # scaffold <name>  (crea .opencode/agents/<name>.md)
node .opencode/bin/install-plugins.js         # postinstall npm (idempotente)
```

## 4 capas de memoria

| Capa | Qué contiene | Cuándo se carga | Tamaño |
|------|--------------|-----------------|--------|
| 1 | `AGENTS.md` + `docs/PROJECT.md` | siempre | ~2K tokens |
| 2 | `docs/sessions/LATEST.md` | al iniciar sesión | ~1-3K tokens |
| 3 | Skills bajo demanda, archivos, sub-agentes | cuando se piden | variable |
| 4 | Historial git, PRDs, planes, instintos | nunca | disco |

## Primeros 5 minutos (post-instalación)

```bash
# 1. Verifica que todo funciona
node .opencode/bin/smoke-test.js              # esperado: PASSED 20+, FAILED 0
node .opencode/bin/validate-frontmatter.js    # 0 FAILED esperado

# 2. Genera el contexto del proyecto (si el proyecto es nuevo)
#    Auto-detecta stack, frameworks, tooling, CI, container, env vars.
#    Secciones Non-Negotiables / Architecture Notes / Open Questions son tuyas para editar a mano.
node .opencode/bin/refresh-project.js
# o check freshness sin escribir:
node .opencode/bin/refresh-project.js --status

# 3. Arranca una tarea real
/prd "descripción de tu primera feature"
```

## Documentación adicional

- **[ROUTE.md](./ROUTE.md)** — elige el sub-agente correcto según la intención (legacy; el `router` skill es la nueva forma automática)
- **[COMMANDS.md](./COMMANDS.md)** — los 64 slash commands agrupados por intención
- **[EXAMPLES.md](./EXAMPLES.md)** — 6 flujos completos de proyectos reales
- **[ARCH.md](./ARCH.md)** — 4 capas, flujo PRD, ciclo de instintos, estructura de archivos
- **[SURFACES.md](./SURFACES.md)** — cuándo usar regla vs skill vs MCP vs agente vs CLI

## Reinicio tras cambios

opencode lee la configuración una sola vez al arrancar. Tras cualquier cambio:

```
Ctrl+C          # salir
opencode .      # volver a entrar
```

## Referencia

- Esquema del config: <https://opencode.ai/config.json>
- Agentes: <https://opencode.ai/docs/agents/>
- Skills: <https://opencode.ai/docs/skills/>
- Comandos: <https://opencode.ai/docs/commands/>
- Plugins: <https://opencode.ai/docs/plugins/>
