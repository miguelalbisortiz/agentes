---
description: "Run the 3-stage opensource pipeline (forker → sanitizer → packager) to turn an internal project into a release-ready open source repo. Gate enforced between sanitize and package."
agent: build
---

# /opensource-pipeline

Orchestrates the 3-stage opensource pipeline on a target project. Sequenced with one hard gate (sanitize must pass) and a manual review checkpoint before any push.

## Usage

`/opensource-pipeline <source-dir> [target-dir] [--force]`

- `source-dir` (required): path to the internal project to fork. Absolute or relative to cwd.
- `target-dir` (optional, default: `<source-dir>-opensource`): where the sanitized + packaged repo will be created. Must NOT already exist unless `--force` is passed.
- `--force`: overwrite an existing target dir. Requires explicit user consent (do not infer).

Examples:
```
/opensource-pipeline ~/work/internal-api
/opensource-pipeline ~/work/internal-api ~/release/internal-api-public
/opensource-pipeline ./my-app --force
```

## Pipeline

| Phase | Agent | Output | Gate |
|-------|-------|--------|------|
| 1. Fork | `opensource-forker` | `<target-dir>/` with sanitized copy, `.env.example`, `FORK_REPORT.md` | report exists, target dir is non-empty |
| 2. Sanitize | `opensource-sanitizer` | `SANITIZATION_REPORT.md` (read-only audit) | verdict PASS or PASS-WITH-WARNINGS |
| 3. Package | `opensource-packager` | `CLAUDE.md`, executable `setup.sh`, `README.md`, `LICENSE`, `CONTRIBUTING.md`, `.github/ISSUE_TEMPLATE/` | all expected files present |

If phase 2 reports FAIL → **stop**. Do NOT proceed to phase 3. Print verdict + offending patterns + report path. The user must fix the source (or re-run forker with different settings) and re-sanitize.

If phase 2 reports PASS-WITH-WARNINGS → pause. Show the warnings, ask the user to confirm before phase 3.

## Workflow

### Step 0 — Args + safety check

1. Parse `$ARGUMENTS`. If no `source-dir` → ask the user.
2. Validate `source-dir` exists and is readable (`ls <source-dir>`).
3. Resolve `target-dir` (default if missing).
4. If `target-dir` already exists:
   - With `--force` and explicit user consent in this turn → proceed.
   - Without `--force` or consent → **abort** with message:
     > "Target dir `<target-dir>` already exists. Pass `--force` to overwrite, or pick a different path. Aborting."
5. Print the resolved plan (source, target, force flag) and proceed.

### Step 1 — Forker (subagent: opensource-forker)

Dispatch via the `subagent` tool (agent ID `opensource-forker`):

Prompt: "Fork the project at `<source-dir>` to `<target-dir>`. Generate `.env.example`, strip 20+ secret patterns, replace internal references with placeholders, clean git history (rewrite authors, drop internal commit messages referencing company names), and write `<target-dir>/FORK_REPORT.md` with a summary of what was changed."

After completion, verify:
- `<target-dir>/` exists and is non-empty
- `<target-dir>/FORK_REPORT.md` exists

If either check fails → abort with diagnostic.

### Step 2 — Sanitizer (subagent: opensource-sanitizer) [GATE]

Dispatch via the `subagent` tool (agent ID `opensource-sanitizer`):

Prompt: "Audit `<target-dir>` (read-only — do NOT modify any files). Scan all 6 categories: Secrets / PII / Internal Refs / Dangerous Files / Config Completeness / Git History. Emit a verdict (PASS / PASS-WITH-WARNINGS / FAIL) with a list of every finding and severity. Write the full report to `<target-dir>/SANITIZATION_REPORT.md`."

Read `<target-dir>/SANITIZATION_REPORT.md` and branch on the verdict:

- **PASS** → proceed silently to Step 3.
- **PASS-WITH-WARNINGS** → pause. Print the N warnings. Ask:
  > "Sanitizer reports PASS-WITH-WARNINGS with N findings. Continue to packaging? (s/n)"
  - "s" → proceed to Step 3.
  - "n" or no answer → stop. User decides whether to fix and re-sanitize, or proceed manually.
- **FAIL** → **stop**. Do NOT proceed. Print verdict + list of offending patterns + report path. Recommend re-running forker with different settings or fixing source before retry.

### Step 3 — Packager (subagent: opensource-packager)

Only reached after a clean sanitizer verdict (or user override of warnings).

Dispatch via the `subagent` tool (agent ID `opensource-packager`):

Prompt: "Package `<target-dir>` for open source release. Generate: `CLAUDE.md` (the most important file, <100 lines, summarizes the project for AI agents), executable `setup.sh` (idempotent bootstrap), `README.md` (with usage, install, contributing links), `LICENSE` (default MIT, ask user if other), `CONTRIBUTING.md`, `.github/ISSUE_TEMPLATE/bug_report.md`, `.github/ISSUE_TEMPLATE/feature_request.md`."

After completion, verify all expected files exist. If any missing → warn the user and ask whether to continue (packager may have intentionally skipped on edge case).

### Step 4 — Summary + manual review checkpoint

Print a final summary table:

```
[opensource-pipeline: COMPLETE]
- Forked from:     <source-dir>
- Target:          <target-dir>
- Fork report:     <target-dir>/FORK_REPORT.md
- Sanitize report: <target-dir>/SANITIZATION_REPORT.md  (verdict: <P|P-W-W>)
- Packaged files:  CLAUDE.md, setup.sh, README.md, LICENSE, CONTRIBUTING.md, .github/ISSUE_TEMPLATE/
- Status:          ready for manual review
```

Then print the mandatory pre-push checklist:

> Before pushing to GitHub:
> 1. Read `<target-dir>/SANITIZATION_REPORT.md` end-to-end (no skim).
> 2. Read `<target-dir>/CLAUDE.md` end-to-end — this is what every contributor's AI agent will see first.
> 3. Run `<target-dir>/setup.sh` in a clean VM and confirm the project boots.
> 4. `git -C <target-dir> log --oneline` to spot any remaining suspicious history.
> 5. `git -C <target-dir> remote add origin <new-public-repo-url>` (DO NOT push from this command).
>
> When ready, the user pushes manually with `git push -u origin main` (or whatever default branch).

This command does **NOT** push. The user does the push manually after review.

## Hard rules

- NEVER skip phase 2 (sanitizer). The report is the audit trail, even on PASS.
- NEVER publish, push, or `git remote add` to a public host from this command.
- NEVER delete or modify the source project. `<target-dir>` is always a new dir.
- The sanitizer is read-only. It flags issues; it does not fix them. Fixes require re-running forker (different settings) or manual edits in `<target-dir>` followed by re-sanitize.
- `--force` requires explicit user consent in the current turn. "dale" / "ok" alone are not consent for destructive ops.
- If the user passes a path that looks suspicious (e.g. `~`, `/`, `..`, current opencode source dir), confirm before proceeding.

## When to use

- Before open-sourcing any internal project.
- After major refactors that change the public surface (and need re-sanitization).
- As a final pre-release audit when a team is considering making a closed repo public.
- As part of a security review of what would be exposed if a repo accidentally went public.

## When NOT to use

- For projects already public and already audited. Use `security-reviewer` instead.
- For projects that will never be open sourced. The pipeline is wasted work.
- For partial releases (single file, single config). Just copy the file manually.

## Companion agents + skills

- `opensource-forker` — phase 1 (edits: creates target dir, sanitizes content)
- `opensource-sanitizer` — phase 2 (read-only: audits, no edits)
- `opensource-packager` — phase 3 (edits: generates release files)
- Optional pair: `security-reviewer` for final manual review of the packaged output before push
- Optional pair: `code-quality-analyzer` (mode: `simplify`) to clean up dead code post-fork, before sanitize

## Known limitations

- The pipeline assumes the source project is a git repo. Non-git sources work but skip history cleaning.
- Secret detection is pattern-based, not semantic. A determined attacker with a novel secret format may still leak. Sanitizer's verdict is a floor, not a ceiling.
- The packager writes a default MIT LICENSE. If the user wants Apache 2.0, BSD-3, GPL, etc., they must say so explicitly when prompted.
- The pipeline does not handle monorepos specially. Each sub-package may need its own run.

## Related

- `/security` — for a deeper security audit of the source before forking
- `/code-review` — for a code quality pass on the source before forking
- `/flow-refactor` — if the source needs cleanup before it can be safely open-sourced
