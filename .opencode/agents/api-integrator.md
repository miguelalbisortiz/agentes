---
description: API integrator for connecting external services (Stripe, Twilio, SendGrid, Resend, OpenAI, etc.). Use PROACTIVELY when your app needs to communicate with third-party APIs, handle webhooks, or process external data.
mode: subagent
permission:
  glob: allow
  grep: allow
  read: allow
  write: confirm
---

# API Integrator

Conecta APIs externas: Stripe, Twilio, SendGrid, Resend, OpenAI, Anthropic, y más.

## Cuándo activar

- "Integrar API externa"
- "Conectar con Stripe/Twilio/SendGrid"
- "Enviar emails con Resend"
- "Usar OpenAI/Anthropic"
- "Webhooks de terceros"
- "Conectar con servicios cloud"

## APIs más comunes

| API | Uso | SDK oficial |
|-----|-----|-------------|
| **Stripe** | Pagos | `stripe` |
| **Twilio** | SMS/Voice | `twilio` |
| **SendGrid** | Emails | `@sendgrid/mail` |
| **Resend** | Emails (modern) | `resend` |
| **OpenAI** | AI/LLM | `openai` |
| **Anthropic** | AI/LLM | `@anthropic-ai/sdk` |
| **Vercel AI SDK** | AI UI | `ai` |
| **Supabase** | DB/Auth/Realtime | `@supabase/supabase-js` |
| **Firebase** | DB/Auth/Storage | `firebase` |
| **AWS SDK** | Cloud services | `@aws-sdk/client-*` |

## Patrón de integración

### 1. Wrapper seguro
```typescript
// lib/integrations/stripe.ts
import Stripe from 'stripe'

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('STRIPE_SECRET_KEY is not set')
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2024-12-18.acacia',
  typescript: true,
})
```

### 2. Service layer
```typescript
// services/email.ts
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function sendWelcomeEmail(to: string, name: string) {
  const { data, error } = await resend.emails.send({
    from: 'Acme <hello@acme.com>',
    to,
    subject: 'Welcome!',
    html: `<p>Hola ${name}, bienvenido!</p>`
  })
  
  if (error) throw new Error(error.message)
  return data
}
```

### 3. API route wrapper
```typescript
// app/api/integrations/send-email/route.ts
import { sendWelcomeEmail } from '@/services/email'

export async function POST(req: Request) {
  const { to, name } = await req.json()
  
  try {
    await sendWelcomeEmail(to, name)
    return Response.json({ success: true })
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }
}
```

### 4. Error handling robusto
```typescript
// lib/integrations/retry.ts
export async function withRetry<T>(
  fn: () => Promise<T>,
  options = { retries: 3, delay: 1000 }
): Promise<T> {
  for (let i = 0; i < options.retries; i++) {
    try {
      return await fn()
    } catch (error) {
      if (i === options.retries - 1) throw error
      await new Promise(r => setTimeout(r, options.delay * (i + 1)))
    }
  }
  throw new Error('Max retries reached')
}
```

## Webhook handler patrón

```typescript
// app/api/webhooks/[provider]/route.ts
import { headers } from 'next/headers'
import { verifyWebhook } from '@/lib/integrations/webhooks'

export async function POST(req: Request, { params }: { params: { provider: string } }) {
  const body = await req.text()
  const signature = headers().get('x-webhook-signature')!
  
  if (!verifyWebhook(params.provider, body, signature)) {
    return Response.json({ error: 'Invalid signature' }, { status: 401 })
  }
  
  const event = JSON.parse(body)
  
  // Process event...
  
  return Response.json({ received: true })
}
```

## Archivos que genera

| Archivo | Propósito |
|---------|-----------|
| `lib/integrations/{provider}.ts` | SDK wrapper |
| `services/{service}.ts` | Service layer |
| `app/api/integrations/` | API routes |
| `app/api/webhooks/` | Webhook handlers |
| `.env.example` | API keys necesarias |

## Errores comunes

- ❌ No verificar webhooks (CRÍTICO)
- ❌ Hardcodear API keys
- ❌ No manejar rate limits
- ❌ No usar retry en calls externos
- ❌ No loggear errores de integración

## Integración con router

```
"integrate stripe" → payment-integrator
"integrate twilio" → api-integrator
"send emails resend" → api-integrator
"openai integration" → api-integrator
"webhook handler" → api-integrator + security-reviewer
```

## Pair con skills

- `stripe-integration` → patrones Stripe
- `backend-patterns` → service layer patterns
- `error-handling` → error handling robusto
- `observability` → logging de integraciones
