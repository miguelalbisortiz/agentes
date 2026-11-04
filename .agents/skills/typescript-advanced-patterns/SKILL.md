---
name: typescript-advanced-patterns
description: Use this skill when working with advanced TypeScript patterns. Covers Zod schemas, tRPC, type-safe APIs, branded types, discriminated unions, template literals, error handling, and runtime validation.
triggers: [typescript, typescript patterns, zod, trpc, type safe, branded types, discriminated unions, runtime validation]
origin: starter-pack
---

# TypeScript Advanced Patterns

Advanced TypeScript patterns for type-safe, maintainable code.

## When to Activate

- Designing type-safe APIs with Zod or tRPC
- Implementing discriminated unions and branded types
- Setting up runtime validation
- Creating type-safe error handling
- Building type-safe database queries
- Implementing complex generic types

## Zod Schemas

### Basic Schemas

```typescript
import { z } from 'zod';

const UserSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(100),
  email: z.string().email(),
  age: z.number().int().positive().optional(),
  role: z.enum(['admin', 'user', 'guest']),
  createdAt: z.date(),
  metadata: z.record(z.string(), z.unknown()).optional()
});

type User = z.infer<typeof UserSchema>;
```

### Nested Schemas

```typescript
const AddressSchema = z.object({
  street: z.string(),
  city: z.string(),
  country: z.string(),
  zip: z.string().regex(/^\d{5}(-\d{4})?$/)
});

const CompanySchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  address: AddressSchema,
  employees: z.array(UserSchema).optional()
});
```

### Discriminated Unions

```typescript
const ApiResponseSchema = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('success'),
    data: z.any()
  }),
  z.object({
    status: z.literal('error'),
    error: z.object({
      code: z.string(),
      message: z.string()
    })
  })
]);

type ApiResponse = z.infer<typeof ApiResponseSchema>;
```

### Branded Types

```typescript
type UserId = string & { readonly __brand: 'UserId' };
type OrderId = string & { readonly __brand: 'OrderId' };

function createUserId(id: string): UserId {
  return id as UserId;
}

function createOrderId(id: string): OrderId {
  return id as OrderId;
}

// Type-safe function signatures
function getUser(id: UserId): Promise<User> {
  return db.users.findById(id);
}

// Usage
const userId = createUserId('123');
const orderId = createOrderId('456');

getUser(userId);  // ✅ Works
getUser(orderId); // ❌ Type error
```

### Template Literal Types

```typescript
type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';
type ApiPath = `/${string}`;
type Endpoint = `${HttpMethod} ${ApiPath}`;

function registerEndpoint(endpoint: Endpoint, handler: () => void) {
  // ...
}

registerEndpoint('GET /users', () => {});  // ✅ Works
registerEndpoint('PATCH /users', () => {}); // ❌ Type error
```

## tRPC Patterns

### Router Definition

```typescript
import { initTRPC } from '@trpc/server';
import { z } from 'zod';

const t = initTRPC.context<Context>().create();

const appRouter = t.router({
  getUser: t.procedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ input }) => {
      return await db.users.findById(input.id);
    }),

  createUser: t.procedure
    .input(z.object({
      name: z.string().min(1),
      email: z.string().email()
    }))
    .mutation(async ({ input }) => {
      return await db.users.create(input);
    }),

  onUserCreated: t.procedure
    .subscription(async function* ({}) {
      for await (const event of userCreatedEvents) {
        yield event;
      }
    })
});

export type AppRouter = typeof appRouter;
```

### Middleware

```typescript
const isAuthed = t.middleware(({ ctx, next }) => {
  if (!ctx.session?.user) {
    throw new TRPCError({ code: 'UNAUTHORIZED' });
  }
  return next({
    ctx: { user: ctx.session.user }
  });
});

const protectedProcedure = t.procedure.use(isAuthed);
```

### Error Handling

```typescript
import { TRPCError } from '@trpc/server';

const appRouter = t.router({
  getUser: t.procedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      const user = await db.users.findById(input.id);
      if (!user) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'User not found'
        });
      }
      return user;
    })
});
```

## Discriminated Unions

### State Machines

```typescript
type RequestState<T> =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; data: T }
  | { status: 'error'; error: Error };

function handleState<T>(state: RequestState<T>): string {
  switch (state.status) {
    case 'idle':
      return 'Ready';
    case 'loading':
      return 'Loading...';
    case 'success':
      return `Data: ${state.data}`;
    case 'error':
      return `Error: ${state.error.message}`;
  }
}
```

### Result Pattern

```typescript
type Result<T, E = Error> =
  | { ok: true; value: T }
  | { ok: false; error: E };

function divide(a: number, b: number): Result<number, string> {
  if (b === 0) {
    return { ok: false, error: 'Division by zero' };
  }
  return { ok: true, value: a / b };
}

const result = divide(10, 2);
if (result.ok) {
  console.log(result.value);  // TypeScript knows this is number
} else {
  console.error(result.error);  // TypeScript knows this is string
}
```

## Error Handling

### Typed Errors

```typescript
class AppError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode: number = 500
  ) {
    super(message);
    this.name = 'AppError';
  }
}

class NotFoundError extends AppError {
  constructor(resource: string, id: string) {
    super('NOT_FOUND', `${resource} with id ${id} not found`, 404);
  }
}

class ValidationError extends AppError {
  constructor(errors: Record<string, string>) {
    super('VALIDATION_ERROR', JSON.stringify(errors), 400);
  }
}
```

### Error Handling with Try-Catch

```typescript
async function safeOperation(): Promise<Result<Data, AppError>> {
  try {
    const data = await riskyOperation();
    return { ok: true, value: data };
  } catch (error) {
    if (error instanceof AppError) {
      return { ok: false, error };
    }
    return { ok: false, error: new AppError('UNKNOWN', String(error)) };
  }
}
```

## Runtime Validation

### Zod in Express

```typescript
import { z } from 'zod';
import { Request, Response, NextFunction } from 'express';

function validate(schema: z.ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: result.error.flatten()
      });
    }
    req.body = result.data;
    next();
  };
}

// Usage
app.post('/users', validate(UserSchema), createUser);
```

### Zod in Fastify

```typescript
import { z } from 'zod';

const UserSchema = z.object({
  name: z.string().min(1),
  email: z.string().email()
});

fastify.post('/users', {
  schema: {
    body: UserSchema
  }
}, async (request, reply) => {
  // request.body is typed as User
  return await createUser(request.body);
});
```

## Type-Safe Database Queries

### Prisma

```typescript
import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

// Type-safe query
const users = await prisma.user.findMany({
  where: {
    age: { gte: 18 }
  },
  include: {
    posts: true
  }
});

// Type-safe create
const newUser = await prisma.user.create({
  data: {
    name: 'John',
    email: 'john@example.com'
  }
});
```

### Drizzle

```typescript
import { drizzle } from 'drizzle-orm/node-postgres';
import { users } from './schema';

const db = drizzle(pool);

// Type-safe query
const result = await db.select().from(users).where(
  eq(users.age, 18)
);
```

## Anti-Patterns

1. **`any` type** → Los type safety
2. **Non-null assertion** → Runtime errors
3. **Missing error handling** → Unhandled promises
4. **Over-nesting** → Complex types hard to maintain
5. **Missing validation** → Runtime errors in production

## Related Skills

- `coding-standards` — for general TypeScript conventions
- `api-design` — for API type safety
- `testing-patterns` — for type-safe testing

## Related Agents

- `typescript-reviewer` — for TypeScript code review
