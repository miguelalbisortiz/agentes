---
description: "Genera tests DESDE los Success Criteria del PRD: para cada AC produce el test que lo demuestra (o marca por que no es automatizable). Multi-stack. Rellena el hueco entre '/verify exige evidencia' y '/eval evalua'. Use post-/tasks, pre-/verify, o cuando falten tests para criterios."
agent: testing-auto
---

# Spec-to-Tests Command

Generar tests desde los criterios: $ARGUMENTS

> **Por qué existe:** `/eval` **evalúa** criterios y `/verify` **exige** evidencia, pero
> **nadie genera los tests** que producen esa evidencia. Este comando cierra ese hueco:
> va del *spec* al *test*, no del código al test.

---

## PASO 0 — Cargar el spec (OBLIGATORIO)

1. Si `$ARGUMENTS` es path/nombre de PRD → usarlo.
2. Si no → `docs/prds/*.prd.md` con `Status != COMPLETADO` (el más reciente).
3. Leer el PRD entero → `## Success Criteria` (los `SC-*`/`AC-*`).
4. Si hay plan/tasks (`docs/plans/`, `docs/tasks/`) → leer la columna `→ verifica:` de cada tarea: ahí ya se prometió cómo se prueba cada AC. **Usar esa promesa.**
5. Si **no hay PRD** → *"No hay criterios. Corre `/prd` primero."* y parar.

---

## PASO 1 — Detectar stack y test runner

| Señal | Stack | Dónde van los tests | Runner |
|---|---|---|---|
| `pubspec.yaml` | **Flutter/Dart** | `test/**/*_test.dart` | `flutter test` |
| `package.json` + TS/React | Node | `src/**/*.test.ts` / `__tests__/` | `npm test` (vitest/jest) |
| `pyproject.toml`/`requirements.txt` | Python | `tests/test_*.py` | `pytest` |
| `Cargo.toml` | Rust | `#[test]` en `src/` o `tests/` | `cargo test` |
| `go.mod` | Go | `*_test.go` | `go test ./...` |

Si hay **varios** → generar para todos. Si **ninguno** → pedir el stack, **no inventar**.

Leer los tests existentes **antes** de generar: si ya hay uno para un AC, no duplicarlo.

---

## PASO 2 — Clasificar cada criterio

No todos los criterios son automatizables. Ser honesto aquí es el valor del comando:

| Clase | Qué hacer | Ejemplo |
|---|---|---|
| **UNIT** | test de lógica pura | "cálculo de total con IVA" |
| **INTEGRATION** | test con DB/API/mock | "guardar cultivo en Supabase" |
| **E2E** | flujo completo de usuario | "login → crear cultivo → ver lista" |
| **UI/A11Y** | test de componente + accesibilidad | "el error se muestra junto al campo" |
| **MANUAL** | **no automatizable** → marcar y no inventar test | "el usuario entiende el mensaje de error" |

> **Regla:** si un criterio es de percepción humana ("se ve claro", "es cómodo"), la clase es `MANUAL`.
> **Prohibido** generar un test vacío o trivial solo para que el criterio aparezca "cubierto".
> Un test que siempre pasa **no** prueba nada.

---

## PASO 3 — Generar

Para cada criterio automatizable, emitir el test **con nombre alineado al AC** para que
`/verify` y `/trace` puedan vincularlo.

### Naming (obligatorio — es la clave de la trazabilidad)

| Stack | Nombre del test |
|---|---|
| Dart | `test('AC-004 exporta CSV con headers correctos', ...)` |
| TS | `it('AC-004 exports CSV with correct headers', ...)` |
| Python | `def test_ac_004_export_csv_headers()` |
| Rust | `#[test] fn ac_004_export_csv_headers()` |
| Go | `func TestAC004ExportCSVHeaders(t *testing.T)` |

> El id del AC **debe** aparecer en el nombre. Así `/trace` y `/verify` lo encuentran solos.

### Salida

```markdown
## Tests generados desde el PRD — {nombre}

| AC | Criterio | Clase | Test generado | Estado |
|----|----------|-------|---------------|--------|
| SC-1 | exporta CSV con headers | UNIT | `test/export_test.dart` → `SC-1 exporta CSV...` | nuevo |
| SC-2 | carga en <2s en 4G | E2E | `test/perf_test.dart` → `SC-2 carga <2s` | nuevo |
| SC-3 | el mensaje se entiende | MANUAL | — | ⚠ requiere revisión humana |

**Resumen:** {N} generados · {M} ya existían · {K} MANUAL (sin test posible)
```

Luego mostrar el código de cada test nuevo y **esperar aprobación** antes de escribir.

---

## PASO 4 — Gate y ejecución

```
Tests a crear: {N} en {M} archivos · {K} criterios MANUALES pendientes
¿Escribo los tests y corro el runner? (sí/no/ajustar)
```

Tras escribir:

1. Correr el runner del stack (`flutter test`, `npm test`, `pytest`, `cargo test`, `go test`).
2. Reportar: `Tests: {P} pasan / {F} fallan`.
3. **Si un test nuevo falla** → no lo arregles a escondidas: o el código está mal, o el
   criterio del PRD está mal. **Preguntar** cuál de los dos es.
   - Si el spec estaba mal → sugerir `/change-request`.
   - Si el código está mal → reportar como hallazgo para `/verify`.
4. Actualizar `docs/tasks/`: marcar la verificación de cada AC servido.

---

## Reglas duras

- **Nunca** generar un test que no ejercite el comportamiento del criterio.
- **Nunca** marcar `MANUAL` como cubierto — queda visible hasta que el usuario confirme.
- **Nunca** cambiar el criterio para que el test pase. El criterio manda.
- Si un AC ya tiene test que lo cubre → no duplicar, solo reportarlo.

---

## State Persistence (REQUIRED)

```bash
node .opencode/bin/state.js init spec-to-tests "" [<prd-path>]
node .opencode/bin/state.js update "" generated '{"agentsInvoked":["testing-auto"],"filesModified":[]}'
node .opencode/bin/state.js update "" executed '{"agentsInvoked":["testing-auto"],"filesModified":["<tests>"]}'
node .opencode/bin/state.js complete ""
node .opencode/bin/state.js fail "" "<mensaje>"
```
