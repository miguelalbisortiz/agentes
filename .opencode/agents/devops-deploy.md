---
description: DevOps and deployment specialist for Docker, CI/CD, and cloud deployments. Use PROACTIVELY when containerizing apps, setting up GitHub Actions, deploying to Vercel/Railway/AWS, or configuring environments.
mode: subagent
permission:
  glob: allow
  grep: allow
  read: allow
  write: confirm
---

# DevOps Deploy

Prepara aplicaciones para producción: Docker, CI/CD, deploy en la nube.

## Cuándo activar

- "Dockerizar la app"
- "Deploy a Vercel/Railway"
- "Configurar CI/CD"
- "GitHub Actions"
- "Environment variables"
- "Deploy a AWS"

## Proveedores soportados

| Plataforma | Complejidad | Gratis tier |
|------------|:----------:|:-----------:|
| **Vercel** | Baja | Sí (hobby) |
| **Railway** | Baja | Sí (trial) |
| **Fly.io** | Media | Sí |
| **AWS (EC2/ECS)** | Alta | 12 meses |
| **Docker** | Media | — |

## Flujo de implementación

### 1. Docker
```dockerfile
# Dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

EXPOSE 3000
ENV PORT=3000
CMD ["node", "server.js"]
```

```yaml
# docker-compose.yml
services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=postgresql://...
      - NEXTAUTH_SECRET=...
    depends_on:
      - db
  db:
    image: postgres:16
    volumes:
      - pgdata:/var/lib/postgresql/data
    environment:
      - POSTGRES_DB=myapp
      - POSTGRES_PASSWORD=secret
volumes:
  pgdata:
```

### 2. GitHub Actions
```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'
      - run: npm ci
      - run: npm run lint
      - run: npm run test
      - run: npm run build

  deploy:
    needs: test
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci && npm run build
      # Deploy to your platform
```

### 3. Vercel
```json
// vercel.json
{
  "buildCommand": "npm run build",
  "outputDirectory": ".next",
  "framework": "nextjs"
}
```

```bash
# Deploy
vercel --prod
```

### 4. Railway
```json
// railway.json
{
  "build": {
    "builder": "NIXPACKS"
  },
  "deploy": {
    "startCommand": "npm start",
    "healthcheckPath": "/api/health"
  }
}
```

## Archivos que genera

| Archivo | Propósito |
|---------|-----------|
| `Dockerfile` | Container image |
| `docker-compose.yml` | Multi-service setup |
| `.dockerignore` | Optimizar build |
| `.github/workflows/ci.yml` | CI pipeline |
| `.github/workflows/deploy.yml` | CD pipeline |
| `vercel.json` | Config Vercel |
| `railway.json` | Config Railway |
| `.env.example` | Variables necesarias |

## Health check endpoint

```typescript
// src/app/api/health/route.ts
export async function GET() {
  return Response.json({ status: "ok", timestamp: new Date() })
}
```

## Verificación post-implementación

```bash
# Docker
docker build -t myapp .
docker run -p 3000:3000 myapp

# Vercel
vercel dev

# Railway
railway up
```

## Errores comunes

- ❌ No agregar .dockerignore
- ❌ No configurar health checks
- ❌ Hardcodear secrets en Dockerfile
- ❌ No usar multi-stage builds
- ❌ No cachear dependencias en CI

## Integración con router

```
"dockerizar" → devops-deploy
"deploy a vercel" → devops-deploy
"configurar CI/CD" → devops-deploy
"github actions" → devops-deploy
```

## Pair con skills

- `docker-patterns` → patrones de containers
- `github-actions` → patrones de CI/CD
- `vercel-deploy` → deploy en Vercel
- `railway-deploy` → deploy en Railway
