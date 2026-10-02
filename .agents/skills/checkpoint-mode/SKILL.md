---
name: checkpoint-mode
description: Use when user wants to save work in progress, prevent data loss, or auto-commit changes. Provides auto-checkpoint every 10 minutes and manual checkpoint on demand.
---

# Checkpoint Mode Skill

Auto-commit work in progress to prevent data loss. Never lose work again.

## Triggers
- Automatic every 10 minutes of active coding
- Before risky operations (major refactors, migrations)
- When user says "checkpoint" or "guarda"

## Workflow

### Auto-Checkpoint
1. Track files modified in current session
2. Every 10 minutes of active changes:
   - Stage modified files
   - Commit with prefix "WIP: "
   - Include brief description of what changed
3. Continue working seamlessly

### Manual Checkpoint
1. User says "checkpoint" or "guarda"
2. Stage all modified files
3. Commit with user-provided message or "WIP: manual checkpoint"
4. Confirm: "Checkpoint guardado: {commit-hash}"

### Before Risky Operations
1. Before major refactor: auto-checkpoint
2. Before migration: auto-checkpoint
3. Before deleting files: auto-checkpoint
4. Commit message: "WIP: pre-{operation} checkpoint"

## Commit Message Format
```
WIP: {description}

- {file1}: {what changed}
- {file2}: {what changed}

Session: {session-id}
Timestamp: {iso-timestamp}
```

## Recovery
If session crashes:
1. Check `git log --oneline -10` for WIP commits
2. User can `git revert HEAD` to undo last WIP
3. Or `git reset HEAD~1` to uncommit but keep changes

## Configuration
- Default interval: 10 minutes
- Prefix: "WIP: "
- Auto-checkpoint: enabled by default
- Can be disabled with "/checkpoint off"
