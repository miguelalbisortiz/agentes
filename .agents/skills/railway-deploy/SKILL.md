---
name: railway-deploy
description: Use when deploying to Railway, provisioning databases, configuring services, or shipping full-stack apps and microservices on Railway.
triggers: [railway, deployment, paas, database, service, microservice]
---

# Railway Deploy Patterns

Patrones de deploy en Railway para apps full-stack.

## Configuration

```json
// railway.json
{
  "build": {
    "builder": "NIXPACKS"
  },
  "deploy": {
    "startCommand": "npm start",
    "healthcheckPath": "/api/health",
    "healthcheckTimeout": 100,
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 3
  }
}
```

## Deploy Commands

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Link project
railway link

# Deploy
railway up

# Add database
railway add postgresql
railway add redis

# View logs
railway logs
```

## Environment Variables

```bash
# Set variable
railway variables set DATABASE_URL="postgresql://..."

# Set multiple
railway variables set DATABASE_URL="..." STRIPE_KEY="..."
```

## Database Setup

```bash
# Add PostgreSQL
railway add postgresql

# The URL is auto-set as DATABASE_URL
echo $DATABASE_URL
```

## Monorepo Support

```yaml
# railway.json (root)
{
  "services": {
    "web": {
      "build": { "builder": "NIXPACKS" },
      "deploy": { "startCommand": "npm start" }
    },
    "worker": {
      "build": { "builder": "NIXPACKS" },
      "deploy": { "startCommand": "node worker.js" }
    }
  }
}
```

## Health Check

```typescript
// app/api/health/route.ts
export async function GET() {
  return Response.json({ status: 'ok', timestamp: Date.now() })
}
```

## Custom Buildpack

```dockerfile
# Dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
```

## Errores comunes

- ❌ No configurar healthcheck
- ❌ No usar variables de entorno
- ❌ No manejar cold starts
- ❌ No configurar restart policy
