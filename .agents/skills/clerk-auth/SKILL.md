---
name: clerk-auth
description: Clerk authentication patterns for Next.js, React, and backend apps. Use when implementing sign-up, sign-in, user management, organizations, or multi-factor authentication with Clerk.
triggers: [clerk, authentication, sign-up, sign-in, user-management, organizations, mfa, session, jwt]
---

# Clerk Authentication Patterns

Patrones de autenticación con Clerk para Next.js y React.

## Instalación

```bash
npm install @clerk/nextjs
```

## Configuración

```typescript
// middleware.ts
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'

const isPublicRoute = createRouteMatcher([
  '/',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/api/webhooks(.*)',
])

export default clerkMiddleware(async (auth, req) => {
  if (!isPublicRoute(req)) {
    await auth.protect()
  }
})

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
}
```

## Layout con Providers

```typescript
// app/layout.tsx
import { ClerkProvider, SignedIn, SignedOut, SignInButton, UserButton } from '@clerk/nextjs'

export default function RootLayout({ children }) {
  return (
    <ClerkProvider>
      <html lang="es">
        <body>
          <SignedOut>
            <SignInButton />
          </SignedOut>
          <SignedIn>
            <UserButton />
          </SignedIn>
          {children}
        </body>
      </html>
    </ClerkProvider>
  )
}
```

## Protecting Pages

```typescript
// app/dashboard/page.tsx
import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'

export default async function DashboardPage() {
  const { userId } = await auth()
  
  if (!userId) {
    redirect('/sign-in')
  }
  
  return <div>Dashboard de {userId}</div>
}
```

## User Data

```typescript
// app/api/user/route.ts
import { auth, currentUser } from '@clerk/nextjs/server'

export async function GET() {
  const { userId } = await auth()
  const user = await currentUser()
  
  return Response.json({
    id: userId,
    email: user?.emailAddresses[0]?.emailAddress,
    name: user?.firstName,
  })
}
```

## Organizations

```typescript
// app/organizations/page.tsx
import { OrganizationList, OrganizationSwitcher } from '@clerk/nextjs'

export default function OrganizationsPage() {
  return (
    <div>
      <OrganizationSwitcher />
      <OrganizationList
        afterCreateOrganizationUrl="/dashboard"
        afterSelectOrganizationUrl="/dashboard"
      />
    </div>
  )
}
```

## Variables de entorno

```env
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
```

## Errores comunes

- ❌ No configurar middleware correctamente
- ❌ No usar public/private keys correctamente
- ❌ No manejar errores de sesión
- ❌ No configurar webhooks de Clerk
