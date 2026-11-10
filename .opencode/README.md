# open

Pack portable de opencode. Cópialo a cualquier proyecto, reinicia opencode y empieza a trabajar.

<!-- COUNTS-START -->
## Counts

> Auto-managed by `.opencode/bin/counts.js`. Do not edit by hand.
> Regenerate: `node .opencode/bin/counts.js --update <files...>`

- **90** agents (.opencode/agents)
- **74** commands (.opencode/commands)
- **59** skills (.agents/skills)
- **21** native CLIs (.opencode/bin)
- **0** npm plugins + **1** local plugin(s)
- **2** active MCPs + **14** optional MCP(s)
<!-- COUNTS-END -->

> Las cifras exactas (agentes, commands, skills, plugins, MCPs, CLIs) están en el bloque `## Counts` de abajo. Se regenera con `node .opencode/bin/counts.js --update .opencode/README.md .opencode/manual/README.md .agents/skills/INDEX.md`.

## Quick start

```bash
# copia las partes portables a tu proyecto
cp -r .opencode opencode.json /ruta/a/tu/proyecto/

# abre opencode en ese proyecto
cd /ruta/a/tu/proyecto && opencode .
```

> Windows PowerShell: `Copy-Item -Path ".opencode","opencode.json" -Destination "C:\ruta\a\tu\proyecto" -Recurse -Force`

> Si tu proyecto ya tiene un `README.md`, no se toca. Fusiona `.opencode/AGENTS.md` con tus reglas propias si quieres mantener ambos.

## Copiar a otro proyecto

Después de copiar el pack **no hay nada que instalar**: los plugins del pack son locales y de la API V2 (`hookify.ts` se auto-carga desde `.opencode/plugins/`) y la config la genera el instalador según el perfil del proyecto. Sin dependencias npm ni `node_modules/`.

### Si opencode se cuelga al boot

1. `opencode --version` — necesitas la 2.x; en 1.x los plugins locales V2 no se ejecutan.
2. `opencode debug config` — verifica config mergeada (plugins, MCPs, instructions)
3. `opencode debug skill` — verifica skill discovery
4. Node 20+ recomendado (Node 18 funciona con warnings `EBADENGINE`)
5. MCPs context7 / playwright = 10-30s en el primer boot del proyecto (npx descarga). Después es instant (versiones pineadas).
6. Si el proyecto destino tiene su propio `node_modules/` con +10K archivos, el file watcher se satura. Mover a `.gitignore` + `npm prune` ayuda.

## Documentación

Toda la documentación del pack vive dentro de `.opencode/manual/`, así se copia junto con el resto al instalar:

- **[.opencode/manual/README.md](./manual/README.md)** — punto de entrada, instalación, comandos principales
- **[.opencode/manual/ROUTE.md](./manual/ROUTE.md)** — qué sub-agente usar según la intención
- **[.opencode/manual/COMMANDS.md](./manual/COMMANDS.md)** — los slash commands por intención
- **[.opencode/manual/EXAMPLES.md](./manual/EXAMPLES.md)** — 5 flujos completos de proyectos reales
- **[.opencode/manual/ARCH.md](./manual/ARCH.md)** — 4 capas de memoria, flujo PRD, ciclo de instintos
- **[.opencode/manual/SURFACES.md](./manual/SURFACES.md)** — cuándo usar regla vs skill vs MCP vs agente vs CLI
