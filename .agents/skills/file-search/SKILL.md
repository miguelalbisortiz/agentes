---
name: file-search
description: Use when searching a codebase for symbols, patterns, or text and the results risk flooding context. Covers ripgrep (rg) discipline — file-type and glob filters, max-count limits, list-first-then-read strategy — ast-grep structural (syntax-aware) pattern matching, globbing for unknown layouts, and alignment with the pack's tool-truncation rule (>200 lines). Complements `code-explorer`, the `explore` subagent, and the coding-standards search floor.
triggers: [search, find, grep, ripgrep, rg, ast-grep, structural search, pattern matching, locate usages, find references, codebase search, file search, glob, where is, who calls, find all, symbol lookup]
origin: starter-pack
---

# File Search

Search is where context budgets die. One `grep -r` without filters returns 4,000 lines, gets truncated to a file, and you re-read the whole thing. This skill makes every search **targeted before it is broad**.

Core rule: **estimate the shape of the result before running the command.** If you can't, your pattern is too loose.

## When to Activate

- Looking for usages of a function, class, or string anywhere in the repo
- Hunting a bug by error message, constant, or TODO marker
- Mapping who calls a module before refactoring it
- Any search where a naive pattern could match 100+ lines
- Delegating to `explore`/`code-explorer` and you want to give them sharp seeds, not vague questions

## Do Not Activate For

- You already know the exact file path — just read it
- Single known file — use the Read tool with offset/limit
- Pure semantic/architecture questions with no text anchor — that's `code-explorer` or `codebase-graph`

## Strategy Ladder (climb in this order)

1. **`glob`** — when you know the naming convention, not the location (`**/*.controller.ts`, `**/routes/**`). Cheapest, zero content.
2. **`rg -l <pattern>`** — list files only. Counts matches before pulling content.
3. **`rg -m 20 -C 2 <pattern>`** — capped, with just enough context.
4. **`rg --type <t> -g '!dir' <pattern>`** — narrowed to the 2–3 file types where the anchor must live.
5. Only then: `rg <pattern>` unconstrained — and only if steps 2–4 suggest < ~50 results.

Never skip straight to step 5 in an unfamiliar repo.

## Ripgrep — Flags That Matter

```bash
# file-type filters: never guess extensions
rg "fetchUser" -t ts -t tsx

# glob filters + excludes (kill generated/vendored noise immediately)
rg "TODO" -g 'src/**' -g '!**/*.generated.*' -g '!dist/**'

# hard caps — the truncation insurance
rg "class AuthService" -m 10 --max-columns 200

# context, minimal and precise
rg -n "handler" -C 1 src/routes/      # 1 line context, not 10

# list-first discipline
rg -l "stripe" | head -15              # which files, THEN search inside them
rg -c "useState" src/ | sort -t: -k2 -rn | head   # count ranking before any reading

# multiline (callbacks, decorated defs) — use sparingly, always with -U and a cap
rg -U "async function \w+\([\s\S]{0,80}?catch" -t ts -m 15

# fixed string (no regex surprises with user-facing text/symbols with dots)
rg -F "app.fetch(" -l
```

Rules of thumb:

- `-n` always (line numbers feed directly into Read offset).
- One search = one question. "Find X and how it's used" is two searches.
- If a search returns the truncation file (>200 lines), **do not Read the full output**. Grep the saved output for the 3 patterns you actually care about.

## ast-grep — Structural (Syntax-Aware) Search

Text regex can't tell a comment, a string, and a real call apart. For code patterns, use `ast-grep` (`sg`) when available:

```bash
# find every useCallback with an empty deps array (real nodes, not strings)
sg -p 'useCallback($CB, [])' -l ts,tsx

# any function calling .query( on something named pool/client/db
sg -p '$DB.query($$$)' -l ts --json=compact | head -20

# refactor preview: structural replace without touching logic
sg -p 'console.log($$$)' -U 'logRemoved($$$)' src/ --dry-run

# detect missing await
sg -p '$PROMISE.then($$$)' -l ts
```

When to prefer ast-grep over rg:

- Matching **code shape** (calls, decorators, patterns inside arguments), not identifiers
- Filtering out false hits from comments/strings
- Repo-wide mechanical codemod reconnaissance before writing a codemod

Fallback if `ast-grep` isn't installed: rg with tighter anchors + `-l` triage, or delegate the structural pass to `code-explorer` and hand it the file list.

## Search-Then-Read Handoff

1. `rg -n` gives `file:line` pairs.
2. Open with the Read tool at `offset = line - 10`, `limit = 40`. Never read from line 1 because line 150 matched.
3. Need the callers? New search for the symbol from step 1 — don't free-read the whole directory.

## Rules

- Cap every content search (`-m`, `| head`) unless you've proven the result set is small.
- Type or glob filter on the **first** attempt in an unfamiliar repo.
- `-l` or `-c` before `-n` when the pattern is broad (error strings, "config", "test").
- Search results are inputs to Read, not substitutes for it — pass `file:line`, not vibes.
- Delegation to sub-agents: give the seed patterns and exclusions you already validated; don't re-delegate a search you could have run.
- Respect the pack truncation rule: any tool output >200 lines lives in a saved file — grep that file, never Read it whole.

## Anti-Patterns

- `grep -r` / unanchored regex on the repo root (matches node_modules, dist, .git objects… forever).
- Reading an entire file to answer "does it contain X?" — `rg -l` says yes/no in one line.
- Using `Select-String` with `| Select-Object -First N` to fake truncation when `rg -m N` exists.
- Case-insensitive shotgun (`rg -i`) as the first move — it triples the noise before you've scoped.
- Re-searching with looser patterns after a miss, without narrowing type/directory first. Loosen *filters* last; tighten *pattern* first.
- Searching on synonyms in parallel with regex alternation `(X|Y|Z)` — run them as separate capped searches so counts stay interpretable.

## Integration

- Related skills: `pack-reference` (truncation + output-file mechanics), `codebase-graph` (once search found the files, map the relationships), `debugging-patterns` (bisect/grep triage during incidents).
- Related agents: `code-explorer` (deep path tracing — feed it validated seeds), `explore` (fast fan-out — give it type/glob filters), `code-architect`.
- Related commands: `/session-start` (search budget awareness), `/context --recommend`.

## Quick Example

Task: "find everywhere the app talks to Stripe and what it does after success."

```bash
rg -l "stripe" -t ts -t py -g '!src/legacy/**'        # 3 files, not 40
rg -n "checkoutSession|payment_intent" src/ -m 15 -C 1
sg -p 'stripe.checkout.sessions.create($$$)' -l ts    # real call sites only
```

Then Read at the returned `file:line` ±10. Two searches, ~25 lines of total context, zero truncation.
