---
description: "Start a session by loading minimal context (PROJECT.md + last session snapshot). Use when resuming work, switching tasks, or starting the day on a project."
agent: build
---

# Session Start Command

Load the minimum context needed to resume work efficiently. Designed to keep new sessions small (~3-5K tokens) instead of inheriting the previous session's full chat history.

## Your Task

Run the following in order. Be silent for steps 1-3; only speak at step 4 with a 1-2 line summary.

### Step 1 — Load project context

```
test -f docs/PROJECT.md && cat docs/PROJECT.md || echo "NO_PROJECT"
```

If `NO_PROJECT`:
- Note: project context not yet created
- Suggest running `@prd-agent` first to generate `docs/PROJECT.md`, OR continue without it

### Step 2 — Find most recent session snapshot

```
ls -t docs/sessions/*.md 2>/dev/null | head -1
```

Or on Windows PowerShell:
```
Get-ChildItem .agents\sessions\*.md -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending | Select-Object -First 1 -ExpandProperty FullName
```

If a file is found, read it. If none: "No previous session recorded."

### Step 3 — Quick git context (last 5 commits)

```
git log --oneline -5 2>/dev/null
```

### Step 4 — Report and ask

Print a compact summary in this exact format:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SESSION START
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Project:   {name from PROJECT.md, or "unknown"}
Stack:     {one-line from PROJECT.md, or "?"}
Last session: {YYYY-MM-DD} — {title from snapshot}
   Status: {one line from snapshot's Status section}
   Next:   {first item from snapshot's Next steps, or "n/a"}

Recent commits:
  {commit 1}
  {commit 2}
  {commit 3}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

¿Continuamos donde quedamos, o hay algo nuevo?
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

If no previous session, replace the "Last session" block with "No previous session recorded. Starting fresh."

If no PROJECT.md, replace the "Project" line with "⚠️ No docs/PROJECT.md — run @prd-agent to generate it."

### Step 5 — Wait for user input

Do not start working. Wait for the user to confirm direction.

---

## Behavior Notes

- **Capa 1** (PROJECT.md) is the only file always read. Cheap (~2K tokens).
- **Capa 2** (last snapshot) is the only session-specific file loaded. ~1-3K tokens.
- **Capa 3+** stays on disk until the user (or sub-agent) requests it via tools.
- This command does NOT spawn sub-agents, run builds, or touch files. It only reads.
- If multiple terminals / sessions are open on the same project, the last-wins snapshot convention is best-effort, not transactional.

## Integration

- `/session-end` — write the snapshot this command reads next time
- `@prd-agent` — generate `docs/PROJECT.md` if missing
- `dynamic-context-pruning` plugin — auto-prunes chat history mid-session
- Sub-agents via `subagent` tool — keep heavy work out of the main context
