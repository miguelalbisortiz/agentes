# Pack examples — 3 downstream demos

Three minimal apps that exercise the opencode starter pack end-to-end. **Delete this whole `examples/` directory after grokking it** — the pack itself doesn't need it.

## Why this exists

When you install the pack in a real project, the question is: "what does the pack actually do for me?" These 3 demos answer that with working code you can poke at:

- Each demo is small enough to read in 10 minutes
- Each is paired with a `README.md` that lists specific pack workflows to try
- Each has passing tests out of the box, so you can verify the pack works on it

## The 3 demos

| # | Stack | What it covers | Try first |
|---|-------|----------------|-----------|
| 01 | **Node + TypeScript + Fastify** | `tdd-guide`, `typescript-reviewer`, `code-quality-analyzer`, `/quick-prd`, `/verify` | `/quick-prd "add POST /users with email validation"` |
| 02 | **Python + FastAPI + SQLite** | `tdd-guide`, `python-reviewer`, `database-reviewer`, `security-reviewer`, `/flow-bugfix` | `/flow-bugfix "GET /users/{id} returns wrong user"` |
| 03 | **React + Vite + TypeScript** | `tdd-guide`, `react-reviewer`, `a11y-architect`, `performance-optimizer`, `/flow-bugfix` | `/quick-prd "add a search input that filters users by name"` |

## How to use

1. **Pick a demo** that matches the stack you work with (or the one closest to it).
2. **Open it in opencode** (the pack from the parent directory is auto-detected).
3. **Run the suggested exercise** from the demo's `README.md` ("Suggested exercises" section).
4. **Watch the pack orchestrate** — PRD/plan/TDD/review/verify/audit all happen via slash commands.
5. **Delete the demo** when you understand the workflow. The pack stays; the example doesn't.

## Verifying the pack works

Each demo is runnable and tested out of the box:

```bash
cd .opencode/examples/01-node-api
npm install
npm test          # 4 tests, all green
```

```bash
cd .opencode/examples/02-python-data
uv sync --extra dev
uv run pytest     # 4 tests, all green
```

```bash
cd .opencode/examples/03-react-app
npm install
npm test          # 3 tests, all green
```

If a test fails after install, the pack's own validators (`bin/validate-frontmatter.js`, `bin/smoke-test.js`) will tell you if it's a pack issue or a demo issue.

## What the pack exercises per demo

| Pack surface | 01-node-api | 02-python-data | 03-react-app |
|---|---|---|---|
| `tdd-guide` (agent) | yes | yes | yes |
| `tdd-workflow` (skill) | yes | yes | yes |
| `{stack}-reviewer` | `typescript-reviewer` | `python-reviewer` | `react-reviewer` |
| `code-quality-analyzer` | yes (simplify) | yes (simplify) | yes (simplify) |
| `database-reviewer` | — | yes | — |
| `security-reviewer` | yes (optional) | yes (recommended) | — |
| `a11y-architect` | — | — | yes |
| `performance-optimizer` | — | — | yes (optional) |
| `/quick-prd` | yes | yes | yes |
| `/verify` | yes | yes | yes |
| `/flow-bugfix` | yes | yes | yes |
| `/code-review` | yes | yes | yes |
| `/simplify` | yes | yes | yes |

That's ~12 pack agents + 6 slash commands exercised across the 3 demos.

## When NOT to use

These demos are intentionally small and contrived. They are NOT:

- Production-grade code (no auth, no real DB, no observability)
- A starter template for your app (they exist to demo the pack, not to fork)
- A comprehensive reference of every pack feature (each covers ~5 pack agents)

For real projects, install the pack directly and use the `router` skill to pick the right agent + skill for your stack.

## Related

- `manual/START-HERE.md` — 5-minute onboarding to the pack
- `manual/ROUTE.md` — full agent/skill/command catalog
- `.opencode/AGENTS.md` — pack rules + 9 mandatory behaviors
