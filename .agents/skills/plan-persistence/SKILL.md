---
name: plan-persistence
description: Use when user wants to save, resume, or continue project plans across sessions. Plans persist as files on disk in docs/plans/.
---

# Plan Persistence Skill

Save and resume project plans across sessions. Plans persist as files on disk.

## Triggers
- "plan", "planificar", "planes", "reanudar", "resume", "continuar", "continue"
- When starting a multi-step feature or project

## Workflow

### Save Plan
1. Create `docs/plans/{feature-name}.plan.md`
2. Include:
   - Feature name and description
   - Acceptance criteria
   - Task breakdown with checkboxes
   - Dependencies
   - Status (pending/in-progress/done)
   - Last updated timestamp
3. Reference in `docs/sessions/LATEST.md`

### Load Plan
1. On session start, check `docs/plans/` for active plans
2. If found, read the plan
3. Show status: "Plan '{name}' encontrado. ¿Continuar?"
4. Resume from last incomplete task

### Update Plan
1. Mark completed tasks with `[x]`
2. Add notes to completed tasks
3. Update status field
4. Save with new timestamp

## Plan Format
```markdown
# Plan: {Feature Name}
Status: in-progress
Created: {timestamp}
Last Updated: {timestamp}

## Objective
{What we're building and why}

## Acceptance Criteria
- [ ] Criterion 1
- [ ] Criterion 2

## Tasks
- [x] Task 1 (completed {date})
- [ ] Task 2 (in progress)
- [ ] Task 3

## Dependencies
- {external dependency}

## Notes
- {any important notes}
```

## Directory Structure
```
docs/plans/
  auth-module.plan.md
  payment-integration.plan.md
  api-v2.plan.md
```
