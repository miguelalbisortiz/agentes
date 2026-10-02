---
description: "Verification loop multi-stack (detecta Flutter/Node/Python/Go/Rust): analysis + tests + build + security, Y cruza cada Success Criteria del PRD origen (PASS/FAIL/NOT-VERIFIED). Auto-genera report si PASS. Use before committing, o como gate pre-PR."
agent: build
---

# Verify Command

Run verification loop to validate the implementation: $ARGUMENTS

---

## PASO 0 — Detectar stack (OBLIGATORIO, antes de cualquier check)

Detectar el stack en la raíz del workspace. En este orden de prioridad:

| Señal presente | Stack | Comandos |
|---|---|---|
| `pubspec.yaml` | **Flutter/Dart** | `flutter analyze` · `flutter test` · `dart format` |
| `package.json` | Node / TS / JS | `tsc --noEmit` · `npm run lint` · `npm test` · `npm run build` |
| `pyproject.toml` / `requirements.txt` / `setup.py` | Python | `ruff check` · `mypy` · `pytest` |
| `Cargo.toml` | Rust | `cargo check` · `cargo clippy -- -D warnings` · `cargo test` |
| `go.mod` | Go | `go vet ./...` · `golangci-lint run` · `go test ./...` |

- Si hay **varios** (`pubspec.yaml` + `package.json`) → verificar **todos**.
- Si **ninguno** → decir: "No detecté stack en la raíz. ¿Qué comandos corro?" y **NO inventar comandos**.
- **REGLA**: nunca correr comandos npm en un proyecto Flutter (ni al revés) — produce FALSO FAIL.

Reportar la detección en una línea: `Stack detectado: Flutter (pubspec.yaml)`.

---

## PASO 1 — Checks técnicos del stack

### 1a. Si Flutter/Dart

```
flutter pub get
flutter analyze
dart format --set-exit-if-changed .
flutter test
flutter build web --no-tree-shake-icons   # si el proyecto es web
flutter build apk --debug                 # si el proyecto es móvil
```

> Con cobertura: `flutter test --coverage` y revisar `coverage/lcov.info`.

### 1b. Si Node / TypeScript

```
npx tsc --noEmit
npm run lint
npm test
npm run test:integration   # si existe
npm run build
```

### 1c. Si Python

```
ruff check .
mypy .
pytest --cov=src
```

### 1d. Si Rust

```
cargo check
cargo clippy -- -D warnings
cargo test
cargo build --release
```

### 1e. Si Go

```
go vet ./...
golangci-lint run
go test ./... -cover
go build ./...
```

---

## PASO 2 — Seguridad (aplica a todos los stacks)

- [ ] Sin secrets hardcodeados (buscar `password=`, `api_key=`, `sk_`, `SECRET`)
- [ ] Input validado en endpoints
- [ ] Sin SQL injection (queries parametrizadas)
- [ ] Sin XSS (renderizado sanitizado)
- [ ] Sin credenciales en `.env` commiteado (revisar `.gitignore`)

---

## PASO 3 — CRUZAR LOS SUCCESS CRITERIA DEL PRD (OBLIGATORIO si hay PRD)

### 3.1 Localizar el PRD

1. Si `$ARGUMENTS` es path o nombre de PRD → usarlo.
2. Si no → buscar `docs/prds/*.prd.md` con `Status != COMPLETADO` (el más reciente).
3. Si **no hay PRD** → escribir `Sin PRD activo: no hay criterios que cruzar.` y saltar a PASO 4.

### 3.2 Extraer los criterios

Tomar **literalmente**:
- cada checkbox de `## Success Criteria`
- cada `AC-NNN` si existe un Acceptance Brief asociado

No resumir, no reescribir, no inventar criterios que no estén.

### 3.3 Asignar estado a CADA criterio

| Estado | Cuándo se asigna |
|---|---|
| `PASS` | Existe **evidencia observables** de esta corrida que lo demuestra |
| `FAIL` | La evidencia existe y **contradice** el criterio |
| `NOT-VERIFIED` | No hay evidencia automatizable en esta corrida |

### REGLA CRÍTICA

> **Que el build pase y los tests pasen NO hace `PASS` a un criterio de usuario.**
>
> - "Build succeeds" **no** prueba *"el usuario completa checkout en <3 clics"*.
> - "All tests passing" **no** prueba *"los usuarios free tier ven el límite de 100"*.
> - "No lint warnings" **no** prueba *"el error se muestra al usuario"*.
>
> Si no ejecutaste algo que **observe ese comportamiento** → es `NOT-VERIFIED`, nunca `PASS`.

### Qué cuenta como evidencia válida

- Un test que ejercita **exactamente** ese comportamiento → nombrar el test
- Un comando ejecutado cuyo output lo confirma → nombrar comando + output resumido
- Un artefacto generado y verificable (schema, ruta, archivo, endpoint)
- Verificación **manual del usuario** → queda `NOT-VERIFIED` hasta que el usuario confirme

### Salida

```markdown
### Success Criteria del PRD

| # | Criterio (texto literal del PRD) | Evidencia | Estado |
|---|---|---|---|
| SC-1 | {criterio} | {test / comando / "sin evidencia automatizable"} | PASS |
| SC-2 | {criterio} | — | NOT-VERIFIED |
| SC-3 | {criterio} | {qué contradice} | FAIL |

**Resumen criterios:** {N} PASS · {N} FAIL · {N} NOT-VERIFIED  (de {N} totales)
```

### Efecto en el veredicto

| Situación | Status final |
|---|---|
| 1+ criterio `FAIL` | **FAIL** |
| 0 FAIL, 1+ `NOT-VERIFIED` | **PASS-WITH-NITS** (los NITS son los criterios sin verificar — listarlos) |
| 0 FAIL, 0 `NOT-VERIFIED` | **PASS** |

> `NOT-VERIFIED` **no bloquea**, pero **nunca puede quedar silenciado**: se lista siempre y se ofrece confirmación manual.

---

## PASO 4 — Veredicto

### Resumen
- Status: **PASS** / **PASS-WITH-NITS** / **FAIL**
- Score técnico: {X}/{Y} checks
- Score criterios: {PASS}/{totales}

### Detalle técnico

| Check | Stack | Status | Notes |
|---|---|---|---|
| Analyze/Lint | {detectado} | PASS/FAIL | |
| Types | {detectado} | PASS/FAIL | |
| Tests | {detectado} | PASS/FAIL | |
| Coverage | {detectado} | PASS/FAIL | {N}% (target 80%) |
| Build | {detectado} | PASS/FAIL | |
| Security | all | PASS/FAIL | |

### Action items
[Si FAIL: qué arreglar, en orden]

---

## PASO 5 — Feedback loop: ¿es bug o es spec? (OBLIGATORIO si hay FAIL)

Cuando un criterio queda `FAIL` o `NOT-VERIFIED`, **no lo trates siempre como bug de código.**
Antes de mandar a arreglar, clasificar el origen:

```
¿El codigo viola lo que el PRD pide?
├── SI  → BUG DE IMPLEMENTACION   → arreglar codigo (accionables del PASO 4)
├── NO, el PRD pide algo imposible/contradictorio/ambiguo
│        → SPEC DEFECTUOSO        → proponer /change-request
└── NO SE, falta informacion      → marcar NOT-VERIFIED + preguntar
```

**Señales de que es SPEC DEFECTUOSO (no bug):**

| Señal | Ejemplo |
|---|---|
| El criterio contradice otro criterio | SC-1 pide offline, SC-5 pide sync inmediata |
| El criterio es inmedible | "debe sentirse rápido" → nadie puede pasarlo |
| El criterio pide algo que el stack no soporta | "exportar a .xlsx" sin librería de Office |
| El criterio ya no aplica (cambió el negocio) | pide features de un plan que ya no existe |
| Se cumplió la intención pero no la letra | usuario logra el objetivo por otro camino |

**Comportamiento:**

1. Clasificar **cada** FAIL/NOT-VERIFIED como `BUG` o `SPEC`.
2. Si hay 1+ `SPEC` → **no cerrar el verify en silencio**. Proponer una sola vez:

   > "Hay {N} criterios fallidos que parecen **defecto del spec**, no del código:
   > - SC-3: {razón}
   >
   > ¿Abro `/change-request` para corregir el PRD? (sí/no)"

3. Si el usuario dice **sí** → invocar `/change-request` con esos criterios listados.
4. Si dice **no** → respetar y dejarlos como `FAIL` en el report.
5. Si son `BUG` → seguir con los action items del PASO 4, sin tocar el spec.

> **Esto es lo que cierra el ciclo:** sin este paso, un spec mal escrito se paga como
> deuda de código infinita. Con él, el fallo retroalimenta al spec.

---

**NOTE**: Correr antes de cada commit y PR.

---

## Post-Verify: Auto-Snapshot Report

**MANDATORY** cuando el verify pasa Y hubo cambios reales desde el último verify.

### Cuándo aplica
- Status final: **PASS** o **PASS-WITH-NITS** (0 fail).
- `git diff --name-only HEAD~1` no vacío.
- Existe PRD activo: `docs/prds/*.prd.md` con status != COMPLETADO.

### Cuándo NO aplica
- Status final: **FAIL** (primero arreglar).
- No hubo cambios desde el último verify.
- No hay PRD activo.

### Comportamiento

Al pasar verify:

1. Generar `docs/reports/{YYYY-MM-DD_HHMM}-{kebab-name}.report.md` con:
   - Status: `COMPLETADO`
   - Stack detectado y comandos ejecutados
   - **Tabla completa de Success Criteria del PASO 3**
   - Checks técnicos
   - Agentes usados: `build` (verify)
   - Skills usadas: `verification-loop`
   - Archivos modificados: `git diff --name-only HEAD~1`
2. Preguntar UNA vez: "Report generado. ¿Audito contra el PRD origen con `/audit-report {name}`? (s/n)".
3. Si `s` → invocar `/audit-report`. Si `n` → respetar.

> Incluir la tabla de criterios en el report es lo que permite que `/audit-report` audite **contra los criterios reales**, no solo contra checks técnicos.
