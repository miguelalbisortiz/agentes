---
description: "5-minute orientation: 5 typical flows (build/fix/review/refactor/health) with one example each. Use when you're new to the pack, forgot what flows exist, or want to show someone the menu in 5 minutes."
agent: build
---

# Start Here Command

5-minute orientation: 5 typical flows with one example each. Pick the one matching your intent, run the example, you're rolling.

## 5 Flows

### Flow 1: Build a feature

When: "agregar X" / "implementar Y" / "build Z" (non-trivial, >3 archivos)

```bash
/prd "agregar busqueda con filtros a la tabla de usuarios"
# → generates docs/prds/{ts}-busqueda-filtros.prd.md
#   after you confirm the intention map

/plan docs/prds/{ts}-busqueda-filtros.prd.md
# → phased plan with risks

/tdd "implementar filtro por nombre y email"
# → RED → GREEN → REFACTOR, 80%+ coverage

/verify
# → typecheck + lint + tests + coverage + build
# → auto-genera report si PASS

/audit-report busqueda-filtros
# → verdict: PASS / PASS-WITH-NITS / FAIL
```

Shortcut: `/flow-feature "<idea>"` (encadena todo).

### Flow 2: Fix a bug

When: "rompio X" / "no funciona Y" / "bug en Z" (with repro)

```bash
/quick-prd "el login falla cuando email tiene +"
# → mini-PRD de 10 lineas, max 3 criterios

# implement the fix (TDD si es posible)

/verify
# → checks + auto-report

/audit-report quick-login-email
```

Shortcut: `/flow-bugfix "<repro>"` (encadena todo).

### Flow 3: Review code or PR

When: "review esto" / "PR #42 listo" / "como se ve mi cambio"

```bash
/code-review
# → quality + security + maintainability check
# → severity-grouped findings

# o si es un PR en GitHub:
/pr-review 42
# → parallel specialist reviewers (code, security, types, tests)
# → unified verdict: APPROVE / WARN / BLOCK
```

### Flow 4: Refactor / cleanup

When: "refactor X" / "cleanup" / "consolidar" / "saca codigo muerto" (sin cambio de comportamiento)

```bash
/refactor-clean
# → knip + depcheck + ts-prune
# → dead code, duplicates, unused exports

/verify
# → confirma que tests siguen verdes
```

Shortcut: `/flow-refactor "<X>"` (con plan explicito).

### Flow 5: Pack health / discovery

When: "como esta el pack" / "que tengo disponible" / "se comporta raro"

```bash
/pack-doctor
# → 10 health checks (frontmatter, orphans, size, junctions)

/list-agents
# → 72 agentes agrupados por categoria, con triggers

/list-skills
# → 17 skills con trigger map
```

## How to Pick

Si todavia no estas seguro, corre `/route "<lo que queres hacer>"` — matchea contra el catalogo y te da 1 opcion + 2 alternativas.

Si es tu primera vez con el pack, lee `.opencode/manual/START-HERE.md` (5-min deep dive) despues de este command.

## Behavior

- This command is read-only. No files modified.
- Pure orientation. Pick a flow, run its example, come back if you need to switch.
- If you don't see your use case here, run `/route "<intent>"`.
- After you pick a flow, the primary will auto-offer relevant sub-agents and skills.

## When to Use

- First time using the pack.
- Onboarding someone else.
- Forgot the menu after a break.
- Want a refresher on what flows exist.

## When NOT to Use

- You already know what to do. Just run the command.
- Deep dive needed. Read `.opencode/manual/START-HERE.md` instead.
- Specific question. Just ask.
