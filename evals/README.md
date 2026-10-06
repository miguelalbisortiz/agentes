# Eval-Driven Development

> Escribir las evaluaciones **antes** de cambiar el prompt, y que un gate en
> CI no deje pasar un cambio que baje la puntuación.

TDD aplicado a prompts: en vez de asertar una salida exacta, se aserta que una
puntuación sobre un dataset etiquetada no baja de un umbral.

## Por qué existe

El paquete ya tenía verificadores de **estructura**: `lint-docs`, `counts`,
`wiring-test`, `validate-frontmatter`, `smoke-test`, `installer-test`. Ninguno
lee prosa buscando **significado**.

El 2026-10-06 `AGENTS.md` se contradecía a sí mismo: `Auto-Checkpoint`
mandaba commitear cada 10 minutos, mientras que las conductas obligatorias 3 y
5 prohibían commitear sin verbo del usuario. Ningún verificador lo habría
detectado, porque las reglas son texto y ellos solo miran forma.

Este directorio cierra ese hueco.

## Estructura

| Ruta | Qué contiene |
|---|---|
| `evals/cases/static.json` | los casos: **datos**, no código |
| `.opencode/bin/eval-static.js` | el runner genérico |

Añadir una regresión = añadir un objeto al dataset. No hay que tocar el runner.

## Casos actuales

| Id | Qué protege |
|---|---|
| E1 | `AGENTS.md` no vuelve a autorizar commits automáticos |
| E2 | las 9 conductas obligatorias siguen numeradas y completas |
| E3 | la baseline de Prompt Defense sigue en `AGENTS.md` |
| E4 | todo agent referencia esa baseline |
| E5 | 0 huérfanos: agents y skills con dispatch real, commands conocidos |
| E6 | cada puntero `AGENTS.md § seccion` resuelve a un encabezado |
| E7 | `measure-tokens` no cae por debajo del suelo del 30 % |
| E8 | los 4 gates del ciclo SDD existen |
| E9 | la conducta 3 (git consent) sigue presente |

## Tipos de caso

| `kind` | Comprueba |
|---|---|
| `files` | todos los ficheros de `files` existen |
| `present` | `pattern` coincide al menos `min` veces |
| `absent` | `pattern` coincide **0** veces |
| `count` | coincidencias iguales a `equals`, o `gte` / `lte` |
| `every` | cada fichero de `dir` que cumple `glob` contiene `pattern` |
| `heading` | cada referencia capturada por `pattern` resuelve en `target` |
| `orphan` | 0 huérfanos estrictos en agents, skills y commands |
| `metric` | ejecuta un CLI hermano con `--json` y evalúa `field` |

## Uso

```powershell
Push-Location D:\open
node .opencode/bin/eval-static.js            # todos los casos
node .opencode/bin/eval-static.js --json     # salida legible por máquina
node .opencode/bin/eval-static.js --quiet    # solo el resumen
```

Códigos de salida: `0` todo pasa, `1` al menos un caso falla o el dataset es
ilegible.

## El gate en CI

`.github/workflows/ci.yml` ejecuta la batería completa y `eval-static` en cada
push y en cada pull request.

`measure-tokens` corre **solo informativo** (`continue-on-error`): está en rojo
deliberado al 35 % frente a una meta de 40 % que sigue abierta en
`PENDIENTES.md`. El suelo real lo fija el caso E7. Convertirlo en gate duro
solo tiene sentido cuando se cumpla el 40 %, y **nunca reescribiendo la
baseline** — eso haría la meta auto-cumplible.

## Cómo añadir un caso

1. Añade el objeto con `id`, `kind`, `title` y `why` a `evals/cases/static.json`.
2. Ejecuta `node .opencode/bin/eval-static.js` y comprueba que pasa.
3. Haz la **prueba negativa**: rompe a propósito la regla, confirma que el caso
   falla con exit 1, y restaura.
4. Solo entonces commitea, con el diff delante.

El paso 3 es el que convierte un caso en una red de seguridad real.
