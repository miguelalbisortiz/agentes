---
name: vercel-deploy
description: Use when deploying to Vercel, configuring domains, setting environment variables, or shipping Next.js, static sites, and serverless functions.
triggers: [vercel, deployment, serverless, edge, domain, preview, production]
---

# Vercel Deploy Patterns

Patrones de deploy en Vercel para Next.js y serverless.

## Configuration

```json
// vercel.json
{
  "buildCommand": "npm run build",
  "outputDirectory": ".next",
  "framework": "nextjs",
  "regions": ["iad1"],
  "crons": [
    {
      "path": "/api/cron",
      "schedule": "0 0 * * *"
    }
  ]
}
```

## Environment Variables

```bash
# CLI
vercel env add DATABASE_URL production
vercel env add STRIPE_SECRET_KEY preview

# .env.local (local development)
DATABASE_URL=postgresql://...
```

## Deploy Commands

```bash
# Deploy to preview
vercel

# Deploy to production
vercel --prod

# Pull env vars
vercel env pull .env.local
```

## Custom Domain

```bash
# Add domain
vercel domains add example.com

# Verify DNS
vercel domains verify example.com
```

## Serverless Functions

```typescript
// api/hello.ts (Pages Router)
import type { VercelRequest, VercelResponse } from '@vercel/node'

export default function handler(req: VercelRequest, res: VercelResponse) {
  res.status(200).json({ message: 'Hello!' })
}
```

```typescript
// app/api/hello/route.ts (App Router)
export async function GET() {
  return Response.json({ message: 'Hello!' })
}
```

## Edge Functions

```typescript
// app/api/edge/route.ts
export const runtime = 'edge'

export async function GET(request: Request) {
  return new Response('Edge function!', {
    headers: { 'content-type': 'text/plain' },
  })
}
```

## ISR (Incremental Static Regeneration)

```typescript
// app/posts/[id]/page.tsx
export const revalidate = 60 // seconds

export default async function Post({ params }) {
  const post = await fetch(`https://api.example.com/posts/${params.id}`, {
    next: { revalidate: 60 }
  })
  // ...
}
```

## Preview Deployments

- Every push to non-main branch creates a preview URL
- Comment on PR: "Preview: https://xxx.vercel.app"
- Auto-cleanup when branch is deleted

## Errores comunes

- ❌ No configurar env vars en Vercel
- ❌ No usar output: 'standalone' para Docker
- ❌ No manejar冷 starts
- ❌ No configurar dominios correctamente
