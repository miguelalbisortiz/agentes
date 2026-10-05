# Arquitectura

> Cómo encajan las 4 capas de memoria, el flujo PRD-first, el ciclo de instintos y las superficies de capacidad.

## 4 capas de memoria

El pack minimiza el uso de tokens dividiendo el contexto en 4 capas. Solo las capas "vivas" se cargan; el resto permanece en disco.

| Capa | Qué contiene | Cuándo se carga | Tamaño |
|------|--------------|-----------------|--------|
| 1 | `AGENTS.md` + `docs/PROJECT.md` | siempre | ~2K tokens |
| 2 | `docs/sessions/LATEST.md` (copia del último snapshot) | `/session-start` o auto al cerrar | ~1-3K tokens |
| 3 | Skills bajo demanda, archivos, sub-agentes | cuando se necesitan (skill tool, subagent tool) | variable |
| 4 | historial git, PRDs, planes, instintos | nunca al contexto | solo disco |

**Regla**: si algo puede vivir en disco, vive en disco. Solo la capa "viva" va al contexto.

## Flujo PRD-first (obligatorio en tareas no triviales)

```
El usuario dice: "construir X" / "crear Y" / "agregar Z" / "implementar W"
       ↓
build (primary) detecta el verbo de intención
       ↓
subagent { agent: "prd-agent" }
       ↓
prd-agent ejecuta el Protocolo de Entendimiento:
  Fase 0: verifica/crea docs/PROJECT.md
  Fase 1: escucha activa (lee contexto, no pregunta si puede inferir)
  Fase 2: construye el Mapa de Intención
  Fase 3: máximo 3 preguntas de ambigüedad a la vez
  Fase 4: confirmación explícita del usuario sobre el Mapa de Intención
       ↓
PRD escrito en docs/prds/YYYY-MM-DD_HHMM-{nombre}.prd.md
       ↓
Solo ENTONCES: /plan → /orchestrate → implementación → /verify
```

**Disparadores** (cualquiera activa el flujo):
- "construir X", "crear Y", "agregar Z", "implementar W"
- "necesito una funcionalidad que..."
- "quiero un sistema de..."
- "mejorar X" / "optimizar Y" (cambios de comportamiento, no solo limpieza)
- `/plan X` sin PRD previo
- Cualquier pedido no trivial que no sea pregunta y respuesta o un one-liner

**Exentos** (no requieren PRD): preguntas y respuestas, arreglos de una línea, reportes de bug con reproducción, code review de cambios existentes, "skip PRD" o "implementa directo" explícito.

## Ciclo de instintos (aprendizaje continuo)

```
Ocurre trabajo de sesión (build, plan, review, etc.)
       ↓
/session-end o auto al detectar señal de cierre
       ↓
Pasos 1-5: revisión, escribir snapshot, actualizar LATEST.md, refrescar PROJECT.md
Paso 6: extraer 1-3 instintos de alta calidad (máx 3, confianza ≥ 0.5)
Paso 7: persistir en docs/instincts/instincts.json (proyecto) o
        ~/.config/opencode/instincts/instincts.json (global)
       ↓
Próxima sesión:
  - El agente primary lee LATEST.md en /session-start
  - Los instintos aparecen contextualmente cuando los patrones coinciden
  - /instinct-status muestra los acumulados, /instinct-export los comparte entre proyectos
```

**Promoción de instintos**: los instintos de proyecto con alta confianza pueden promoverse al ámbito global (`/promote`) y compartirse entre todos tus proyectos.

## Superficies de capacidad (dónde vive cada prompt)

Consulta [`SURFACES.md`](./SURFACES.md) para el árbol de decisión completo. Versión corta:

- **Regla** = capa 1, siempre cargada, restricción dura
- **Skill** = capa 3, bajo demanda, conocimiento condicional
- **Servidor MCP** = capa 3, superficie de herramientas, acción externa
- **Sub-agente** = capa 3, contexto aislado, especialista
- **CLI / slash command** = invocado por el usuario, determinista o prearmado

## Modelo de permisos

Cada sub-agente puede declarar su propio bloque `permission` en el frontmatter:

```yaml
---
description: Revisor de código read-only
mode: subagent
permission:
  edit: deny          # no puede modificar archivos
  bash:               # acceso a shell restringido
    "git log": allow
    "git diff": allow
    "*": deny
  task:               # restringe qué sub-agentes puede invocar
    "*": deny
    "code-reviewer": allow
---
```

El `permission.skill: "allow"` global en `opencode.json` permite a cada agente cargar cualquier skill bajo demanda.

## Eficiencia de tokens (acumulada)

| Mecanismo | Ahorro |
|-----------|--------|
| caveman mode (AGENTS.md) | ~75% en outputs |
| plugin `dynamic-context-pruning` | 30-50% en sessions largas |
| memoria de sesión de 4 capas | ~80% al reanudar |
| sub-agentes vía `subagent` tool | 70-90% en paralelismo |
| skills bajo demanda (no en `instructions`) | ~95% en skills no usadas |
| truncado de resultados de tools (`grep -m 50`, `head -n 100`) | 20-40% en sessions con muchos greps |
| **Total vs starter sin optimizar** | **~85%** |

## Estructura de archivos

```
.
├── opencode.json                    config principal (comandos, instrucciones, mcp, plugin, permisos)
├── README.md                        landing de GitHub (proyecto)
├── CHANGELOG.md                     historial de versiones
├── .gitignore                       ignora node_modules, .opencode/state, .opencode/node_modules, OS junk
├── .agents/                         skills del proyecto (pack + user-installed)
│   └── skills/                      skills portables (<nombre>/SKILL.md)
│       ├── router/                  matriz intent → agent + skill (merged, auto-loaded por primary)
│       ├── api-design/
│       ├── backend-patterns/
│       ├── caveman/
│       ├── coding-standards/
│       ├── documentation-lookup/
│       ├── error-handling/
│       ├── frontend-patterns/
│       ├── git-workflow/
│       ├── intent-driven-development/
│       ├── mcp-server-patterns/
│       ├── security-review/
│       ├── task-decomposition/
│       ├── tdd-workflow/
│       └── verification-loop/
├── docs/                            project docs (UN solo lugar, fácil de llevar con rsync/tar)
│   ├── README.md                    index de docs/ (qué vive dónde)
│   ├── PROJECT.md                   capa 1: stack/conventions del proyecto (auto-gen)
│   ├── prds/                        artefactos PRD (YYYY-MM-DD_HHMM-{slug}.prd.md)
│   ├── plans/                       planes de implementación (YYYY-MM-DD_HHMM-{slug}.plan.md)
│   ├── reports/                     reportes de ejecución (YYYY-MM-DD_HHMM-{slug}.report.md)
│   ├── audits/                      veredictos PASS/FAIL (YYYY-MM-DD_HHMM-{slug}.audit.md)
│   ├── sessions/                    snapshots de fin de sesión (auto al "listo")
│   ├── state/                       recovery state para flows resumibles (machine-local, gitignored)
│   └── instincts/                   patrones aprendidos del proyecto (machine-local, gitignored)
└── .opencode/                       pack template portable (cp -r a otros proyectos)
    ├── AGENTS.md                    capa 1: 9 comportamientos obligatorios + reglas globales
    ├── AGENTS_INDEX.md              índice de los agents (auto-gen, movido aquí en 1.2.1)
    ├── CONVENTIONS.md               naming + path conventions
    ├── package.json                 plugin deps (npm install una vez)
    ├── package-lock.json
    ├── .gitignore                   ignora node_modules y bun.lock
    ├── agents/                      sub-agentes (.md)
    ├── commands/                    slash commands (.md)
    ├── bin/                         CLIs cero-deps (solo Node stdlib)
    │   ├── instinct.js
    │   ├── context.js
    │   ├── refresh-project.js       --status, --auto, --dry-run, --check
    │   ├── smoke-test.js
    │   ├── validate-frontmatter.js
    │   ├── build-agents-index.js
    │   ├── build-skills-index.js
    │   ├── state.js
    │   └── install-plugins.js
    ├── manual/                      documentación del pack (lo que estás leyendo)
    │   ├── README.md                punto de entrada (español)
    │   ├── START-HERE.md            5-minute orientation (inglés)
    │   ├── ROUTE.md                 sub-agentes por intención (legacy; superseded por `router` skill)
    │   ├── COMMANDS.md              slash commands por intención
    │   ├── EXAMPLES.md              6 flujos completos
    │   ├── ARCH.md                  este archivo
    │   └── SURFACES.md              regla vs skill vs MCP vs agente vs CLI
    ├── agent → agents               junction (backwards compat opencode 1.17.x)
    ├── skill → ../.agents/skills    junction (skills viven en .agents/, junction preserva 1.17.x compat)
    └── node_modules/                3 plugins npm (vibeguard, pty, dcp) + peer; 136MB, gitignored
# CI recomendado: smoke-test + validate-frontmatter (workflow no incluido en el pack)
# package.json (root) intencionalmente ausente (regla cero-deps)
```

## Protocolo de reinicio

opencode lee la configuración una sola vez al arrancar. Tras cualquier cambio:

```bash
Ctrl+C          # salir de la TUI
opencode .      # volver a entrar
```

Verifica con `node .opencode/bin/smoke-test.js` — ejecuta 20 comprobaciones estructurales.
