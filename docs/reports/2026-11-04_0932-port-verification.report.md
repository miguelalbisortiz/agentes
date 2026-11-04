# Verificación del port marcelo → open

**Fecha:** 2026-11-04 09:32
**Rama:** `port/marcelo-content`
**Alcance:** comprobar que todo lo portado funciona, que no hay referencias colgadas y que no quedan huérfanos sin ruta de dispatch.

## Resultado

**PASS** — 0 referencias colgadas, 0 agentes huérfanos, 0 skills huérfanas, batería completa en verde.

## Método

Los verificadores del pack (`eval-static`, `wiring-test`, `counts`, `lint-docs`, `validate-frontmatter`, `smoke-test`) no bastan para esta pregunta: `eval-static` E5 considera "cableado" cualquier artefacto cuyo nombre aparezca en cualquier `.md` del pack, y **el propio frontmatter del artefacto cuenta**. Un skill que solo se menciona a sí mismo pasa E5. Por eso se escribieron tres auditorías ad-hoc, más pruebas funcionales en vivo.

| Auditoría | Qué comprueba | Resultado |
|-----------|---------------|-----------|
| `audit-pack` | frontmatter por tipo, filas del router contra el filesystem, cobertura de dispatch real, referencias internas de las skills portadas, duplicados de triggers | 0 huérfanos, 0 filas colgadas |
| `audit-refs` | sintaxis explícita `skill: X` / `agent: X` / `command: /X` en los 280 `.md` | 0 colgadas |
| `audit-ported` | rutas, agentes, comandos y binarios citados por los 21 artefactos portados | solo falsos positivos (rutas de ejemplo en prosa) |
| Prueba funcional | ejecución real de los artefactos con runtime | ver abajo |

## Pruebas funcionales

| Artefacto | Prueba | Resultado |
|-----------|--------|-----------|
| `hookify` SecretBlocker | `write` a `hookify-probe.key` | bloqueado con `[hookify:SecretBlocker]` |
| `hookify` DestructiveWarner | comando inerte que matchea `git reset --hard` | entrada en `.opencode/logs/destructive.log` |
| `hookify` scrub de secretos | probe con `--token=FAKE1234abcd` | logueado como `--token=***` |
| `hookify` allowlist | `write` a `.env.example` | permitido (sin falso positivo) |
| `archify` | `node bin/archify.mjs doctor` | 16/16 checks ok |
| `archify` | `render workflow` de un ejemplo → `check` | HTML 832 KB, `ok: true`, exit 0 |
| `kubernetes-specialist` | 11 referencias `references/*.md` | 11/11 existen |
| Plugin/MCP V2 | boot | 0 plugins fallando, `anydoc tools=3`, `context7 tools=2` |

## Hallazgos corregidos en esta pasada

| # | Hallazgo | Tipo | Fix |
|---|----------|------|-----|
| 1 | `env-sync.md` citaba `command: /deps-audit`, comando inexistente | referencia colgada | → `/deps-health` |
| 2 | `archify/package.json` conservaba `test` y `test:webm` apuntando a `test/`, que se excluyó del port | script roto | scripts eliminados |
| 3 | `checkpoint-mode` y `plan-persistence` sin ninguna ruta de dispatch (huérfanas reales, preexistentes) | huérfano | 2 filas en `## Meta & Workflow` |
| 4 | `testing-patterns` sin fila en el catálogo de skills (solo alcanzable vía AGENTS.md) | huérfano parcial | 1 fila en el catálogo |
| 5 | La fila `env-sync` quedó fuera de la tabla de `## Meta & Workflow` (separada por una línea en blanco) | tabla rota | fila movida dentro |
| 6 | Fila de pairing `` `debugging` / incident `` apuntaba a un artefacto inexistente | referencia colgada | → `debugging-patterns` |
| 7 | `learn` etiquetado `(skill)` cuando es un comando | etiqueta errónea | → `(command)` |
| 8 | `manual/COMMANDS.md` documentaba 70 de 73 comandos | documentación incompleta | +3 filas (`api-docs`, `env-sync`, `deps-health`) |

## Verificación de cobertura

| Superficie | En disco | Documentado / indexado | Bidireccional |
|-----------|---------:|------------------------|---------------|
| Agentes | 90 | `AGENTS_INDEX.md` 90 | sí |
| Comandos | 73 | `manual/COMMANDS.md` 73 | sí (0 faltantes, 0 fantasmas) |
| Skills | 59 | `skills/INDEX.md` 59 | sí |

Agentes fuera del router: 13, todos variantes `{lang}-build-resolver`, cubiertas por la fila placeholder `{lang}-build-resolver`. No son huérfanos.

Comandos sin fila en el router: 54. No es un defecto: son slash commands que el usuario teclea y que están documentados en `manual/COMMANDS.md`, el mismo criterio que aplica E5.

## Hallazgo abierto — corregido en la misma pasada

**E5 tenía un punto ciego.** `kOrphan` en `.opencode/bin/eval-static.js` concatenaba el texto de todos los `SKILL.md` en `tierA`, así que cada skill se encontraba a sí misma por el campo `name` del frontmatter. En la práctica E5 solo fallaba si un skill no tenía `name`, no si estaba desconectado.

Corregido: la alcanzabilidad se evalúa ahora por artefacto, excluyendo su propio archivo, y con límites de palabra para que `caching` no cuente como mención de `caching-patterns`.

Efecto inmediato: la versión estricta destapó un huérfano más que el check viejo tapaba — `angular-reviewer`, que solo se mencionaba a sí mismo. Se cableó en `## Stack-specific Reviewers`, y `angular` se agregó a la lista de lenguajes de la fila `{lang}-build-resolver`.

Prueba de que el check no es un no-op: se creó un skill `zz-orphan-probe` que solo se auto-referencia → E5 falló señalándolo; al borrarlo, 9/9 otra vez.

## Estado de los verificadores

```
lint-docs           277 .md  R1..R7 = 0
counts --check      sin STALE
wiring-test         8/8 PASSED
validate-frontmatter 490 PASSED, 0 FAILED
smoke-test          31 PASSED, 0 FAILED
eval-static         9/9
```

## Caveat operativo

`archify doctor` re-renderiza los 5 HTML de `examples/` como parte de su autochequeo. El contenido queda idéntico pero cambia el fin de línea (LF), así que el árbol aparece sucio hasta hacer `git checkout -- .agents/skills/archify/examples/`. Ocurrió en esta pasada y se revirtió.

## Archivos tocados en esta pasada

- `.agents/skills/router/SKILL.md` (4 filas + 2 correcciones de tabla/etiqueta)
- `.agents/skills/archify/package.json` (2 scripts eliminados)
- `.opencode/commands/env-sync.md` (1 referencia)
- `.opencode/manual/COMMANDS.md` (3 comandos documentados)
- índices y bloques `## Counts` regenerados
