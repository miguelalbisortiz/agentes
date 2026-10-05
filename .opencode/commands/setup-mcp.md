---
description: "Activate or deactivate optional MCPs (GitHub, Postgres, etc). Opt-in only — these MCPs are NOT loaded by default. Walks through secret collection and patches opencode.json."
agent: build
---

# Setup MCP Command

Activate an optional MCP from `.opencode/mcp.optional.json` and add it to `opencode.json` so opencode loads it on the next boot. Reversible.

## Usage

- `/setup-mcp` — interactive wizard: lists available optionals, asks which to activate, collects secrets, patches `opencode.json`
- `/setup-mcp --list` — show all available optional MCPs (read-only)
- `/setup-mcp --status` — show which optionals are currently active
- `/setup-mcp activate <name>` — activate a specific one (prompts for secrets)
- `/setup-mcp disable <name>` — remove from `opencode.json`
- `/setup-mcp --help` — usage

## What this does

1. Reads `.opencode/mcp.optional.json` (template of available opt-in MCPs).
2. For each MCP, the template declares:
   - `package` — npm package to install via `npx -y`
   - `command` — argv to run (supports `${VAR}` interpolation from collected secrets)
   - `env` — required environment variables (marked as secrets when applicable)
3. Prompts for the secrets (hidden input for password-like values).
4. Backs up `opencode.json` to `opencode.json.bak.<timestamp>`.
5. Patches the `mcp` block of `opencode.json` to add the chosen MCP.
6. Tells the user to restart opencode (`opencode .`) to activate.

## Why opt-in (not loaded by default)

- **Cost** — each MCP costs ~10-30s on first boot (npx download) and burns context tokens on every turn.
- **Secrets** — GitHub PATs and DB connection strings should not be in a portable pack that gets copied to other projects.
- **Security** — active MCPs expand the agent's tool surface. Less is more by default.

The pack ships with 1 MCP always active (`context7`) because it has no secrets and is universally useful. The opt-ins require a user choice to enable.

## Default active MCPs (do not touch via this command)

| Name | Why default |
|------|-------------|
| `context7` | Library docs lookup, no secrets, useful for 90% of tasks |

## Available optional MCPs

The catalog lives in `.opencode/mcp.optional.json`, grouped in its `_meta.categories`.
The authoritative — and always current — list is:

```
node .opencode/bin/setup-mcp.js --list
```

Roughly: code-hosting (`github`, `gitlab`) · data (`postgres`, `filesystem`, `supabase`) · observability (`sentry`) · productivity (`linear`, `notion`, `slack`) · web (`brave-search`, `fetch`) · deploy (`vercel`) · payments (`stripe`) · testing (`playwright`).

All of them except `playwright` need a secret you provide at activation time.

> This table used to enumerate the catalog by hand and silently went stale.
> Do not re-expand it: `--list` reads the file, so it cannot rot.

## Reversal

To remove an opt-in MCP:

```
/setup-mcp disable <name>
```

or manually delete the entry from `opencode.json > mcp`. Backups of previous versions are kept as `opencode.json.bak.<timestamp>`.

## Examples

### Interactive activation

```
> /setup-mcp

  Optional MCPs available to activate:

  1) github  —  Read GitHub issues, PRs, code search...
  2) postgres  —  Read-only SQL queries against a PostgreSQL database...
  d) disable an active one
  q) quit

  Choice (number / d / q): 1

  Activating MCP: github
  Read GitHub issues, PRs, code search, repo metadata directly from the agent.

  GITHUB_PERSONAL_ACCESS_TOKEN (hidden): ********

  [ok] github added to opencode.json
  [ok] backup: opencode.json.bak.1700000000000
  Restart opencode to activate: `opencode .`
```

### Quick status

```
> /setup-mcp --status

  === MCP Status ===

  Active MCPs (1):
    • context7  (local)

  Optional MCPs (14):
    [ ]  github
    [x]  postgres
```

## Behavior Notes

- This command is read-write. It modifies `opencode.json` and may collect secrets.
- Secrets are NOT echoed to the terminal. Prompt uses muted stdin.
- `opencode.json` is backed up before any modification.
- The command does NOT auto-restart opencode. The user must do that to apply changes.
- Collected secrets are written to `opencode.json` in plain text. Add `opencode.json` to `.gitignore` or use a secret manager (Vault, AWS Secrets Manager) for production.
- Errors are explicit. The script does not silently retry.

## When to Use

- You need to query GitHub (issues, PRs, code search) from the agent.
- You're debugging a production data issue and need live SQL access.
- You want to audit which optional MCPs are active in a project.

## When NOT to Use

- You want to change the always-active MCP (`context7`). Edit `opencode.json` manually.
- You want to add a brand new MCP that isn't in the template. Edit `.opencode/mcp.optional.json` first, then run this command.
- You're unsure whether the MCP needs secrets. Read the template, then decide.

## Security Notes

- GitHub PATs should be fine-grained tokens with the minimum scope required.
- Postgres connection strings should use a **read-only** role. Never point this at a write-privileged database.
- The script does not validate that the secret is correct. It just stores it. Restart opencode and try invoking the MCP to verify.
- If a secret leaks (committed to git, pasted in chat), rotate it immediately. There is no secret-revocation mechanism here.
