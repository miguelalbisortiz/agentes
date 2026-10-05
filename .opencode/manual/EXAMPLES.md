# EXAMPLES

> 5 flujos completos de proyectos reales. Cada ejemplo muestra: intención inicial, comandos a invocar, agentes que disparan en paralelo, y skills que se cargan automáticamente.

---

## Ejemplo 1 — REST API en Node/TypeScript

**Pedido inicial**: *"agregar endpoint `GET /users/:id` que devuelve el perfil, con auth JWT y rate limiting"*

### Paso 1 — clarificar intención

```
/prd "endpoint GET /users/:id con perfil, auth JWT, rate limit"
```

Dispara: `@prd-agent` (Understanding Protocol). Genera `docs/prds/YYYY-MM-DD_HHMM-users-profile.prd.md`.

### Paso 2 — planear

```
/plan docs/prds/YYYY-MM-DD_HHMM-users-profile.prd.md
```

Dispara: `@planner` + `@code-architect` + `@architect` (en paralelo). Devuelve: archivos a crear, dependencias, orden, criterios de validación.

Skills auto-cargadas: `api-design`, `coding-standards`, `error-handling`.

### Paso 3 — implementar

```
dale, package name com.mi.api, sin ORM raro
```

Dispara: build (primary). Escribe `src/api/users/[id].ts`, agrega JWT middleware, configura rate limit. Mientras escribe:

- `@typescript-reviewer` (paralelo, revisa tipos y async correctness)
- `@tdd-guide` (paralelo, escribe tests ANTES de impl)
- `@security-reviewer` (paralelo, audita auth y secrets)

Skills auto: `api-design`, `error-handling`, `verification-loop`.

### Paso 4 — validar

```
/verify
```

Dispara 3 sub-agentes en paralelo + comandos:
- `@code-reviewer` (calidad)
- `@security-reviewer` (OWASP, secrets, SSRF)
- `@typescript-reviewer` (tipos, async)
- `tsc --noEmit` + `vitest run` + `coverage report`

### Paso 5 — commit

```
/code-review src/api/users/
```

Revisión focalizada del archivo nuevo.

```
"commitea"
```

Dispara build con skill `git-workflow` auto. Conventional commit. **No push** (vos no lo pediste).

---

## Ejemplo 2 — Mobile app en Flutter

**Pedido inicial**: *"app de Flutter con 10 preguntas multiple choice, scoring, animaciones, dark mode"*

### Paso 1 — clarificar

```
/prd "app Flutter quiz: 10 preguntas, scoring, animaciones, dark mode"
```

### Paso 2 — planear con flujo completo

```
/orchestrate "app Flutter quiz: 10 preguntas, scoring, animaciones, dark mode"
```

Dispara el flujo completo: `@prd-agent` (Phase 0) → `@planner` (síntesis) → dispatch paralelo a `@architect`, `@flutter-reviewer`, `@tdd-guide`. La skill `intent-driven-development` se auto-carga para producir criterios de aceptación.

Cada sub-agente devuelve su parte en caveman mode:
```
@flutter-reviewer: checklist → const widgets, mounted checks, semantic labels, theme no hardcoded
@tdd-guide: 3 archivos test (models, providers, widget), 80%+ coverage
skill `intent-driven-development`: 5 acceptance criteria verificables
```

Skills auto: `coding-standards`, `tdd-workflow`, `verification-loop`.

### Paso 3 — implementar

```
dale, package name com.mi.qa.quiz, sin librerias raras
```

Dispara build. Crea `flutter create`, agrega deps (`flutter_riverpod`, `go_router`), escribe models/providers/screens/theme. Paralelo:

- `@flutter-reviewer` (cada widget nuevo)
- `@tdd-guide` (valida tests antes de marcar impl done)

### Paso 4 — validar

```
/verify
```

- `@code-reviewer`
- `@security-reviewer` (storage local, secrets)
- `@flutter-reviewer` (perf, a11y, const, build context)
- `flutter analyze` + `flutter test` + `coverage`

```
/e2e
```

Genera 2-3 integration tests con `integration_test` (flujo start → responder → result → retry).

### Paso 5 — commit

```
"commitea"
```

---

## Ejemplo 3 — Web frontend en React/TypeScript

**Pedido inicial**: *"agregar feature de búsqueda con filtros (categoría, precio, rating) en una tienda React/TS existente"*

### Paso 1 — clarificar

```
/prd "búsqueda con filtros: categoría, precio, rating en la tienda React"
```

### Paso 2 — entender el codebase primero

```
@code-explorer revisa src/features/search y la estructura general de features
```

Sub-agente read-only que mapea: convenciones de state management (Redux? Zustand?), patrones de fetch, estructura de componentes.

### Paso 3 — planear

```
/plan
```

Dispara `@planner` + `@code-architect` que ahora conoce el codebase. Devuelve: componentes nuevos, hooks, tipos, integración con router y store.

Skills auto: `coding-standards`, `error-handling`, `api-design`.

### Paso 4 — implementar TDD

```
dale
```

- `@tdd-guide` escribe tests primero (filter logic, debounce, URL sync)
- build implementa hasta que pasen
- Paralelo: `@react-reviewer` (hooks, memo, server components si Next.js), `@typescript-reviewer` (tipos)

### Paso 5 — validar

```
/verify
```

- `@code-reviewer`
- `@security-reviewer` (XSS en query params, sanitization)
- `@react-reviewer` (hook deps, render perf, a11y)
- `@typescript-reviewer` (tipos, `any` ocultos)

```
/e2e
```

E2E con Playwright: filtro categoría cambia lista, filtro precio acotado, rating mínimo aplica, combinación funciona, URL refleja estado.

### Paso 6 — commit

```
"commitea, mensaje conventional"
```

---

## Ejemplo 4 — Data pipeline en Python

**Pedido inicial**: *"pipeline de ETL que lee CSVs de S3, valida schema con Pydantic, escribe a Postgres, con retries y logs estructurados"*

### Paso 1 — clarificar

```
/prd "ETL Python: S3 → validación Pydantic → Postgres, retries, logs"
```

### Paso 2 — planear

```
/plan
```

Dispara `@planner` + `@code-architect` + `@database-reviewer` (revisión de schema/indexes/migrations).

Skills auto: `error-handling` (crucial para ETL).

### Paso 3 — implementar

```
dale, python 3.12, pydantic v2, sin pandas (solo stdlib + sqlalchemy)
```

Dispara build:
- `src/pipeline/{reader,validator,writer,runner}.py`
- `tests/` con casos válidos/inválidos
- Paralelo: `@python-reviewer` (PEP 8, type hints, async correctness), `@database-reviewer` (SQL, índices, transacciones), `@tdd-guide`

### Paso 4 — validar

```
/verify
```

- `@code-reviewer`
- `@security-reviewer` (S3 creds via env, no hardcoded, IAM scopes)
- `@python-reviewer` (type hints completos, `except` específicos)
- `@database-reviewer` (migrations, índices, query plans)
- `pytest --cov` + `ruff check` + `mypy src/`

### Paso 5 — commit

```
"commitea"
```

---

## Ejemplo 5 — Refactor de módulo legacy

**Pedido inicial**: *"refactorizar `src/legacy/reports.py` (4500 líneas) en módulos pequeños con tests, sin cambiar comportamiento"*

### Paso 1 — clarificar alcance

```
/prd "refactor reports.py en módulos, 100% tests, comportamiento preservado"
```

`@prd-agent` se enfoca aquí en definir qué cuenta como "comportamiento preservado" (golden tests? snapshot tests? comparación byte a byte?).

### Paso 2 — mapear el código antes de tocarlo

```
@code-explorer analiza src/legacy/reports.py y devuelve mapa de funciones, dependencias, side effects
```

Sub-agente read-only. Devuelve: árbol de funciones, qué funciones llaman a cuáles, qué funciones tienen side effects (I/O, DB, network), puntos de entrada públicos vs internos.

### Paso 3 — planear el refactor

```
/plan
```

Estrategia: strangler fig pattern. Capa por capa, mantener el módulo viejo como facade, ir extrayendo a `reports/{parser,aggregator,exporter}.py`. Cada extracción con su suite de tests.

Dispara: `@planner` + `@code-architect` + `@code-explorer` (re-uso del mapa).

Skills auto: `coding-standards`, `verification-loop`, `tdd-workflow`.

### Paso 4 — extraer módulo por módulo

```
dale, empezar por parser
```

- build extrae `parser.py` con su test suite
- `@python-reviewer` valida el nuevo módulo
- `@tdd-guide` verifica que los tests cubren el comportamiento del viejo
- Golden tests: capturar output del viejo, comparar contra nuevo

Repetir para `aggregator.py`, `exporter.py`.

### Paso 5 — limpieza final

```
/refactor-clean
```

Dispara `@refactor-cleaner` que corre `knip`, `depcheck`, `vulture`. Detecta imports muertos, código duplicado entre los nuevos módulos.

### Paso 6 — validar

```
/verify
```

- `@code-reviewer` (comparación antes/después)
- `@python-reviewer`
- Tests viejos + tests nuevos deben pasar idéntico
- Coverage no debe bajar

### Paso 7 — commit por módulo

```
"commitea parser"
"commitea aggregator"
"commitea exporter"
"commitea cleanup"
```

4 commits chicos > 1 commit gigante. Facil de revertir si algo rompe.

---

## Ejemplo 6 — Bug fix con /quick-prd + /flow-bugfix

**Pedido inicial**: *"el botón de logout no anda en mobile"*

### Paso 1 — mini-PRD

```
/quick-prd "logout button no funciona en mobile"
```

`@prd-agent` genera un mini-PRD de ~10 lineas: scope exacto, criterios de aceptación, archivos sospechosos. Si el scope crece, auto-regenera a PRD completo.

### Paso 2 — fix directo

```
dale, el fix es agregar e.preventDefault() en el onClick
```

build aplica el cambio. `@code-reviewer` (paralelo) valida el diff.

### Paso 3 — validar + auditar

```
/verify
```

Corre lint + typecheck + tests + dispatch paralelo a reviewers. Auto-genera report.

```
/audit-report bug-logout-mobile
```

Cruza el report contra el mini-PRD. Emite PASS / PASS-WITH-NITS / FAIL.

### Paso 4 — atajo: /flow-bugfix

Todo lo anterior en un solo comando:

```
/flow-bugfix "logout button no funciona en mobile"
```

Encadena: `/quick-prd` → fix → `/verify` → report → audit. Útil cuando sabés que el scope es chico.

### Paso 5 — commit

```
"commitea"
```

---

## Patrones comunes a través de los 6 ejemplos

| Patrón | Cuándo |
|--------|--------|
| `/prd` SIEMPRE primero | cualquier tarea no trivial |
| `/orchestrate` > `/plan` | cuando querés que prd-agent corra automático |
| `/quick-prd` en vez de `/prd` | cuando el scope es chico (1-2 archivos, bug conocido) |
| `/flow-*` (feature/bugfix/refactor/security) | shortcut al patron completo, encadena los pasos del ejemplo |
| `/audit-report` después de `/verify` | cruzar report contra PRD origen, agrega veredicto |
| `/pack-doctor` antes de release | detecta frontmatter invalido, duplicados, permalinks rotos |
| `@code-explorer` antes de `/plan` | en codebases desconocidos o refactors |
| Sub-agentes en paralelo | el primary los dispara via `subagent` tool, no espera uno a otro |
| TDD con `@tdd-guide` | features nuevas, refactors, bug fixes |
| `/verify` antes de commit | obligatorio |
| 1 commit por unidad lógica | no commit gigante con 50 archivos |
| "commitea" nunca "dale" | consentimiento explícito por turno |
