---
description: "List all available agents with their description and triggers, optionally filtered by category or keyword"
agent: build
---

# List Agents Command

Show the catalog of available agents. `$ARGUMENTS` may be a keyword, category, or empty (list all).

## Usage

- `/list-agents` — full catalog grouped by category
- `/list-agents <keyword>` — filter by keyword (matches description and filename)
- `/list-agents <category>` — filter by category (see table below)
- `/list-agents --triggers` — show only agents with explicit trigger words in description
- `/list-agents --json` — machine-readable output

## Categories

| Category | Agents |
|----------|--------|
| **Build / Plan** | architect, code-architect, code-explorer, diagram-generator, migration-planner, planner, prd-agent |
| **Domain Builders** | api-integrator, auth-builder, devops-deploy, fullstack-builder, graphql-builder, legacy-modernizer, mobile-builder, payment-integrator, realtime-builder, supabase-builder, testing-auto |
| **Review (General)** | code-reviewer (6 modes), refactor-cleaner, security-reviewer |
| **Language Reviewers** | angular-reviewer, cpp-reviewer, csharp-reviewer, flutter-reviewer, fsharp-reviewer, go-reviewer, java-reviewer, kotlin-reviewer, php-reviewer, python-reviewer, react-reviewer, rust-reviewer, swift-reviewer, typescript-reviewer |
| **Build Resolvers** | angular-build-resolver, build-error-resolver (fallback), cpp-build-resolver, dart-build-resolver, django-build-resolver, go-build-resolver, java-build-resolver, kotlin-build-resolver, pytorch-build-resolver, react-build-resolver, rust-build-resolver, swift-build-resolver |
| **Specialized** | a11y-architect, database-reviewer, docs-lookup, fastapi-reviewer, harmonyos-app-resolver, healthcare-reviewer, homelab-architect, incident-responder, marketing-agent, mle-reviewer, network-architect, network-config-reviewer, network-troubleshooter, performance-optimizer, seo-specialist |
| **Quality / Process** | audit-orchestrator, chief-of-staff, conversation-analyzer, doc-updater, e2e-runner, harness-optimizer, loop-operator, manual-writer, opensource-forker, opensource-packager, opensource-sanitizer, report-auditor, tdd-guide |
| **Meta / Harness** | gan-evaluator, gan-generator, gan-planner |

## Your Task

### Step 1 — Read the Catalog

The full catalog lives in `.opencode/AGENTS_INDEX.md` (auto-generated). Read it.

If the file is missing or stale, regenerate it by running:

```bash
node .opencode/bin/build-agents-index.js
```

### Step 2 — Filter

If `$ARGUMENTS` is a keyword, filter to agents whose filename OR description contains it (case-insensitive).

If `$ARGUMENTS` is a category from the table above, show only that category.

If `--triggers` is set, show only agents whose description contains explicit trigger words ("Use when", "auto-triggers on", "MANDATORY", "PROACTIVELY", or "MUST BE USED").

If `--json`, output the INDEX in JSON shape (one object per agent with `name`, `description`, `category`, `size_bytes`, `triggers`).

### Step 3 — Display

For each matching agent, show a 1-line summary:

```
<agent-name>              [<size>KB]  <first 80 chars of description>
```

Then a count and a hint:

```
Total: <N> agents. Use `/list-agents <keyword>` to filter. See `.opencode/AGENTS_INDEX.md` for the full catalog.
```

If filtered to a specific category, group the output by sub-category (Reviewers by language, etc.) and show the category header.

## Behavior Notes

- This command is read-only. No side effects except invoking `build-agents-index.js` when INDEX is stale.
- The catalog is regenerated only when missing or older than 1 hour. Cached otherwise.
- If `$ARGUMENTS` is empty and `--triggers` is set, default to showing all triggered agents.
- Truncate descriptions to 100 chars max in the listing. Full description is in the agent file.

## When to Use

- You forgot which agent handles a specific task.
- You're routing a request and want to see the options.
- You're onboarding someone to the pack and want to show the menu.
- You're auditing the pack for coverage gaps.

## When NOT to Use

- For a single specific question (just call the agent by name with `@<agent-name>`).
- For full agent contents (use the Read tool on `.opencode/agents/<name>.md`).
