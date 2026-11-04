---
name: environment-config
description: Use when setting up, reviewing, or debugging environment configuration across any project. Covers .env management, config validation, secrets handling, environment-specific settings (dev/staging/prod), Docker env injection, CI/CD variables, and config-as-code patterns.
---

# Environment Config Skill

Proper environment configuration for any project.

## Core Principles

1. **Never commit secrets** — `.env` in `.gitignore`, always provide `.env.example`
2. **Validate at startup** — fail fast if required vars are missing
3. **Type-safe config** — parse and validate, don't trust raw strings
4. **Environment parity** — dev should mirror prod as closely as possible
5. **Secrets in vault** — production secrets in Vault/AWS Secrets Manager, not `.env`

## .env File Structure

### .env.example (committed to git)

```bash
# App
NODE_ENV=development
PORT=3000
LOG_LEVEL=debug

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/mydb
DATABASE_SSL=false

# External Services
REDIS_URL=redis://localhost:6379
API_KEY=your-api-key-here
```

### .env (gitignored, local only)

```bash
NODE_ENV=development
PORT=3000
DATABASE_URL=postgresql://postgres:secret@localhost:5432/mydb_dev
DATABASE_SSL=false
REDIS_URL=redis://localhost:6379
API_KEY=sk-test-abc123
```

## Config Validation Patterns

### Node.js (zod)

```typescript
import { z } from 'zod';

const configSchema = z.object({
  NODE_ENV: z.enum(['development', 'staging', 'production']),
  PORT: z.coerce.number().default(3000),
  DATABASE_URL: z.string().url(),
  API_KEY: z.string().min(1),
});

export const config = configSchema.parse(process.env);
```

### Python (pydantic)

```python
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    node_env: str = "development"
    port: int = 3000
    database_url: str
    api_key: str

    class Config:
        env_file = ".env"

settings = Settings()
```

### Go

```go
type Config struct {
    NodeEnv     string `env:"NODE_ENV" envDefault:"development"`
    Port        int    `env:"PORT" envDefault:"3000"`
    DatabaseURL string `env:"DATABASE_URL" required:"true"`
    APIKey      string `env:"API_KEY" required:"true"`
}
```

## Environment-Specific Settings

| Variable | Development | Staging | Production |
|----------|-------------|---------|------------|
| `NODE_ENV` | `development` | `staging` | `production` |
| `LOG_LEVEL` | `debug` | `info` | `warn` |
| `DATABASE_SSL` | `false` | `true` | `true` |
| `API_URL` | `http://localhost:3001` | `https://api-staging.example.com` | `https://api.example.com` |
| `CORS_ORIGIN` | `*` | `https://staging.example.com` | `https://example.com` |

## Docker Environment

### docker-compose.yml

```yaml
services:
  app:
    env_file:
      - .env
    environment:
      - NODE_ENV=production  # Override .env value
      - DATABASE_URL=postgresql://postgres:secret@db:5432/mydb
```

### Dockerfile

```dockerfile
# Never COPY .env into image
COPY .env.example .env
# Set runtime env vars via docker run or orchestration
```

## CI/CD Variables

### GitHub Actions

```yaml
env:
  DATABASE_URL: ${{ secrets.DATABASE_URL }}
  API_KEY: ${{ secrets.API_KEY }}
```

### GitLab CI

```yaml
variables:
  DATABASE_URL: $DATABASE_URL  # From CI/CD settings
```

## Config Anti-Patterns

| Anti-Pattern | Fix |
|-------------|-----|
| `process.env.FOO` everywhere | Centralize in config module, validate once |
| Fallback chain `process.env.FOO \|\| 'default'` | Validate at startup, fail if missing |
| Secrets in docker-compose.yml | Use env_file or secrets management |
| `.env` committed to git | Add to `.gitignore`, provide `.env.example` |
| No validation | Validate with zod/pydantic at startup |
| Hardcoded URLs | Environment-specific config |

## .gitignore Pattern

```gitignore
# Environment
.env
.env.local
.env.*.local
!.env.example
!.env.sample
```

## References

- See `skill: security-review` for secrets handling
- See `skill: docker-patterns` for Docker env injection
- See `skill: observability` for logging config
