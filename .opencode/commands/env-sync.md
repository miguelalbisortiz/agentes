---
description: "Sincroniza .env.example con las variables reales del proyecto. Detecta variables usadas en código y las agrega al .env.example si faltan. Use cuando se agregan nuevas env vars o antes de un deploy."
agent: build
---

# Env Sync Command

Synchronize `.env.example` with actual environment variables used in code.

## Your Task

1. **Scan code** — find all `process.env.X`, `os.environ["X"]`, `env("X")` references
2. **Read current .env.example** — see what's already documented
3. **Compare** — find variables in code but missing from .env.example
4. **Update** — add missing variables to .env.example with placeholder values
5. **Report** — summary of changes

## Detection Patterns

### Node.js/TypeScript

```bash
# Find process.env references
rg "process\.env\.([A-Z_]+)" --no-filename -o | sort -u
rg "process\.env\[(['\"])([A-Z_]+)\1\]" --no-filename -o | sort -u

# Find dotenv config
rg "require\(['\"]dotenv['\"]|from ['\"]dotenv['\"]" --files
```

### Python

```bash
# Find os.environ references
rg "os\.environ\[(['\"])([A-Z_]+)\1\]" --no-filename -o | sort -u
rg "os\.getenv\(['\"]([A-Z_]+)" --no-filename -o | sort -u

# Find pydantic Settings
rg "class Settings.*BaseSettings" --files
```

### Go

```bash
# Find os.Getenv references
rg "os\.Getenv\(['\"]([A-Z_]+)" --no-filename -o | sort -u
rg "os\.LookupEnv\(['\"]([A-Z_]+)" --no-filename -o | sort -u
```

## Output Format

```
Env Sync Report
===============

Variables found in code: 15
Variables in .env.example: 12
Missing from .env.example: 3

Added to .env.example:
  REDIS_URL=redis://localhost:6379
  LOG_LEVEL=debug
  API_VERSION=v1

Already documented: 12
```

## Placeholder Values

| Variable Pattern | Placeholder |
|-----------------|-------------|
| `*_URL` | `http://localhost:PORT` or `postgresql://...` |
| `*_KEY` | `your-...-here` |
| `*_SECRET` | `your-...-here` |
| `*_TOKEN` | `your-...-here` |
| `*_DSN` | `https://...@sentry.io/...` |
| `PORT` | `3000` |
| `NODE_ENV` | `development` |
| `LOG_LEVEL` | `debug` |
| `DEBUG` | `true` |

## Safety

- **Never overwrite existing values** — only add missing variables
- **Preserve comments** — don't remove existing documentation
- **Mark sensitive vars** — add `# SENSITIVE` comment for secrets
- **Respect existing format** — match the style of the current .env.example

## When to Use

- After adding new environment variables to code
- Before committing new features that use env vars
- When onboarding new developers (ensure .env.example is complete)
- Before deployments (verify all required vars are documented)
- When CI/CD fails with "missing env var"

## See Also

- `skill: environment-config` — env management patterns
- `skill: security-review` — secrets handling
- `command: /deps-audit` — dependency security
