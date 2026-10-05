---
description: "Generate a PRD via prd-agent. Use for any non-trivial task before planning or implementation. Same as @prd-agent but as a slash command."
agent: prd-agent
---

# Prd Command

Same as `@prd-agent` but as a slash command. Triggers the prd-agent to:
1. Verify/create `docs/PROJECT.md` (project context)
2. Run the Understanding Protocol (active listening, intention map, ambiguity resolution, explicit confirmation)
3. Produce `docs/prds/{YYYY-MM-DD_HHMM}-{name}.prd.md` (date+time stamp for chronological sorting)

## Your Task

> Este comando ya corre como `prd-agent` (frontmatter `agent:`): ejecuta el flujo directamente, sin invocar un subagente.

Ejecuta los pasos 1-3 de arriba. **NO** empezar planificación ni implementación hasta que el usuario confirme el Intention Map y exista un fichero PRD.

## When to use

- Any non-trivial task: build, create, add, implement, improve, optimize
- Before `/plan`
- Before `/orchestrate` (it does this automatically as Phase 0)
- Direct invocation when you want only the PRD, not the full plan/implementation
- When the request contains "build X" / "create Y" / "agregar Z" / "implementar W"

## Skippable only for

- Pure Q&A ("what does X do?", "how does Y work?")
- One-liner fixes (typo, comma, single-line change)
- Bug reports with repro steps (criteria are obvious)
- `/code-review` of existing changes
- User explicitly says "skip PRD" / "implementa directo"

## Behavior notes

- prd-agent may ask up to 3 ambiguity questions at a time
- prd-agent writes the PRD to `docs/prds/{YYYY-MM-DD_HHMM}-{name}.prd.md` (date+time stamp)
- After PRD confirmed, next step is `/plan docs/prds/{YYYY-MM-DD_HHMM}-{name}.prd.md`
- If `docs/PROJECT.md` is missing, prd-agent auto-generates it from existing project files (README, package.json, etc.)

## Anti-pattern

Never propose a solution (file paths, libraries, patterns) before passing through prd-agent. If the user asks for feature X, the first response is to invoke prd-agent, not "I recommend Y with Z."

## Integration

- `/orchestrate` — invokes prd-agent automatically as Phase 0
- `/plan` — consumes the PRD produced by this command
- `intent-driven-development` skill — loaded by prd-agent during clarification
- `@prd-agent` — direct invocation alternative to this slash command
