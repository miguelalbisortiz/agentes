---
name: docker-patterns
description: Docker patterns for multi-stage builds, docker-compose, optimization, and production-ready containers. Use when containerizing apps, optimizing images, or setting up development environments.
triggers: [docker, dockerfile, docker-compose, container, image, multi-stage, optimization]
---

# Docker Patterns

Patrones de Docker para builds multi-stage, optimización, producción.

## Multi-stage Build (Next.js)

```dockerfile
# Dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
ENV PORT=3000

CMD ["node", "server.js"]
```

## .dockerignore

```
node_modules
.next
.git
.env*.local
coverage
```

## docker-compose.yml

```yaml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=postgresql://postgres:password@db:5432/myapp
      - NEXTAUTH_SECRET=your-secret
    depends_on:
      db:
        condition: service_healthy
    restart: unless-stopped

  db:
    image: postgres:16-alpine
    volumes:
      - pgdata:/var/lib/postgresql/data
    environment:
      - POSTGRES_DB=myapp
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=password
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      timeout: 5s
      retries: 5

volumes:
  pgdata:
```

## Optimization Tips

```dockerfile
# Cache dependencies
COPY package*.json ./
RUN npm ci --only=production

# Only copy what's needed
COPY src/ ./src/
COPY public/ ./public/
COPY next.config.js ./

# Use specific tags, not :latest
FROM node:20.11-alpine
```

## Development with Hot Reload

```yaml
# docker-compose.dev.yml
services:
  app:
    build:
      context: .
      dockerfile: Dockerfile.dev
    volumes:
      - .:/app
      - /app/node_modules
    ports:
      - "3000:3000"
```

```dockerfile
# Dockerfile.dev
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
CMD ["npm", "run", "dev"]
```

## Errores comunes

- ❌ No usar multi-stage builds
- ❌ Copiar node_modules al image
- ❌ No usar .dockerignore
- ❌ No configurar healthchecks
- ❌ Usar :latest tag
