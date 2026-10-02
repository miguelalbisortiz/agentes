---
name: stripe-integration
description: Stripe integration patterns for payments, subscriptions, billing portal, and webhooks. Use when working with Stripe API, checkout sessions, customer portal, or payment processing.
triggers: [stripe, payment, checkout, subscription, billing, invoice, webhook, payment_intent, customer, portal]
---

# Stripe Integration Patterns

Patrones de integración con Stripe para pagos, suscripciones, portal de cliente.

## Configuración

```typescript
// lib/stripe.ts
import Stripe from 'stripe'

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('STRIPE_SECRET_KEY no está configurada')
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2024-12-18.acacia',
  typescript: true,
})

// lib/stripe-client.ts
'use client'
import { loadStripe } from '@stripe/stripe-js'

export const getStripe = () => loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)
```

## Checkout Session

```typescript
// app/api/checkout/route.ts
import { stripe } from '@/lib/stripe'

export async function POST(req: Request) {
  const { priceId, userId } = await req.json()
  
  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    payment_method_types: ['card'],
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${process.env.NEXT_PUBLIC_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${process.env.NEXT_PUBLIC_URL}/pricing`,
    metadata: { userId },
    allow_promotion_codes: true,
  })
  
  return Response.json({ url: session.url })
}
```

## Webhook Handler

```typescript
// app/api/webhooks/stripe/route.ts
import { stripe } from '@/lib/stripe'
import { headers } from 'next/headers'

export async function POST(req: Request) {
  const body = await req.text()
  const signature = headers().get('stripe-signature')!
  
  let event: Stripe.Event
  
  try {
    event = stripe.webhooks.constructEvent(
      body, 
      signature, 
      process.env.STRIPE_WEBHOOK_SECRET!
    )
  } catch (err) {
    console.error('Webhook signature verification failed:', err)
    return Response.json({ error: 'Invalid signature' }, { status: 400 })
  }
  
  switch (event.type) {
    case 'checkout.session.completed':
      await handleCheckoutComplete(event.data.object)
      break
    case 'customer.subscription.updated':
      await handleSubscriptionUpdated(event.data.object)
      break
    case 'customer.subscription.deleted':
      await handleSubscriptionDeleted(event.data.object)
      break
    case 'invoice.payment_failed':
      await handlePaymentFailed(event.data.object)
      break
  }
  
  return Response.json({ received: true })
}
```

## Customer Portal

```typescript
// app/api/portal/route.ts
import { stripe } from '@/lib/stripe'

export async function POST(req: Request) {
  const { customerId } = await req.json()
  
  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${process.env.NEXT_PUBLIC_URL}/dashboard/billing`,
  })
  
  return Response.json({ url: session.url })
}
```

## Subscribe Button Component

```typescript
// components/subscribe-button.tsx
'use client'
import { useState } from 'react'

export function SubscribeButton({ priceId }: { priceId: string }) {
  const [loading, setLoading] = useState(false)
  
  const handleSubscribe = async () => {
    setLoading(true)
    const res = await fetch('/api/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ priceId })
    })
    const { url } = await res.json()
    window.location.href = url
  }
  
  return (
    <button onClick={handleSubscribe} disabled={loading}>
      {loading ? 'Procesando...' : 'Suscribirme'}
    </button>
  )
}
```

## Variables de entorno

```env
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
```

## Errores comunes

- ❌ No verificar firma del webhook (CRÍTICO)
- ❌ No manejar reintentos de webhooks
- ❌ Hardcodear precios (usar priceId)
- ❌ No configurar portal de cliente
- ❌ No validar estado antes de activar acceso
