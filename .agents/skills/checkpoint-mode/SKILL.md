---
name: checkpoint-mode
description: Use when user wants to save work in progress or prevent data loss. Manual checkpoint on demand ("checkpoint" / "guarda") plus crash recovery. Does NOT auto-commit.
---

# Checkpoint Mode Skill

Manual checkpoint of work in progress to prevent data loss.

> **No auto-checkpoint.** The "auto-commit every 10 minutes" and "auto-commit
> before risky operations" rules were removed: both contradicted the mandatory
> behaviors 3 (Git consent) and 5 (Destructivas con consentimiento) in
> `AGENTS.md`, which require an explicit commit verb in the same turn. A local
> `WIP:` commit still needs the user's word. Do not reintroduce without
> changing those behaviors first.

## Triggers
- When user says "checkpoint" or "guarda"

## Workflow

### Manual Checkpoint
1. User says "checkpoint" or "guarda"
2. Stage all modified files
3. Commit with user-provided message or "WIP: manual checkpoint"
4. Confirm: "Checkpoint guardado: {commit-hash}"

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
- Prefix: "WIP: "
- Auto-checkpoint: **disabled** (see the note at the top of this file)
- Manual checkpoint: always available on "checkpoint" / "guarda"
