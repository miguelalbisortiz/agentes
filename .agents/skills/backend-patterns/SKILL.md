---
name: backend-patterns
description: Use this skill when designing, reviewing, or implementing server-side code: REST/GraphQL APIs, repository/service layers, database access, caching, authentication, validation, error handling, and background jobs. Covers layered architecture, dependency injection, middleware, transactions, and request lifecycle. Use api-design for the URL/status-code contract and security-review for auth/authorization.
triggers: [Express, FastAPI, NestJS, repository, service layer, DI, transaction, controller, middleware, cache, redis, queue]
origin: starter-pack
---

# Backend Patterns

Server-side conventions for API services, business logic, and data access. Layered on top of `coding-standards` (shared floor) and `api-design` (URL/status-code contract). Not language-specific — applies to Node, Python, Go, Java, etc.

## When to Activate

- Designing new API endpoints or service layers
- Reviewing repository, service, or controller code
- Implementing authentication, authorization, or session handling
- Setting up database access, transactions, or migrations
- Adding input validation, error responses, or logging
- Refactoring monolithic handlers into layered architecture
- Adding caching, invalidation, or cache performance tuning
- Implementing background jobs, queues, or scheduled tasks

## Layered Architecture

The default shape. Adapt to your framework's idioms.

```
HTTP request
  ↓
Middleware (auth, logging, rate limit, CORS)
  ↓
Controller / Handler (parse, validate, dispatch)
  ↓
Service (business logic, orchestration)
  ↓
Repository (data access, queries)
  ↓
Database / External API
```

### Layer Responsibilities

**Controller / Handler**
- Parse request (params, query, body, headers).
- Validate input against a schema (zod, joi, pydantic, bean validation).
- Call exactly one service method.
- Translate service result/error to HTTP response.
- Never contains business logic.

**Service**
- One method per use case.
- Orchestrates repositories, external APIs, side effects.
- Contains business rules: who can do what, when, and in what order.
- Throws typed errors that the controller maps to status codes.

**Repository**
- One repository per aggregate / table.
- Exposes data access in domain terms: `findById`, `save`, `findActive`, NOT `query("SELECT * FROM ...")`.
- Returns domain objects, NOT raw rows.
- Never calls other repositories or services.

### Anti-Pattern: Fat Controller

```typescript
// FAIL: business logic in controller
app.post('/orders', async (req, res) => {
  const user = await db.user.findUnique({ where: { id: req.user.id }})
  if (user.balance < req.body.total) return res.status(402).json({ error: 'insufficient' })
  const order = await db.order.create({ data: { ...req.body, userId: user.id }})
  await db.user.update({ where: { id: user.id }, data: { balance: user.balance - req.body.total }})
  await emailService.send(user.email, 'order-confirmed', { orderId: order.id })
  res.json(order)
})

// PASS: controller delegates
app.post('/orders', validateBody(createOrderSchema), async (req, res) => {
  const order = await orderService.create(req.user.id, req.body)
  res.status(201).json(order)
})
```

## Dependency Injection

Prefer constructor injection (or framework-native: NestJS, Spring, FastAPI Depends). Service depends on interfaces, not implementations — makes testing trivial.

```typescript
class OrderService {
  constructor(
    private readonly orderRepo: OrderRepository,
    private readonly paymentGateway: PaymentGateway,
    private readonly eventBus: EventBus,
  ) {}
}
```

In tests, pass fakes. In production, pass real implementations wired by a composition root.

## Validation

### Schema at the Boundary

Validate all external input at the controller boundary. Trust nothing from the request. Use a schema validator (zod, joi, pydantic, class-validator).

```typescript
const createUserSchema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(8).max(128),
  name: z.string().min(1).max(100),
  role: z.enum(['user', 'admin']).default('user'),
})
```

Never reuse raw types from the database as the request body type. They diverge.

### Defense in Depth

Even if the controller validates, the service can have its own invariants. The service should fail fast if called with invalid data — assert in dev, log in prod.

## Error Handling

### Typed Errors

```typescript
class DomainError extends Error {
  constructor(message: string, public readonly code: string) { super(message) }
}

class NotFoundError extends DomainError {
  constructor(resource: string, id: string) {
    super(`${resource} not found: ${id}`, 'NOT_FOUND')
  }
}

class ValidationError extends DomainError {
  constructor(public readonly issues: Array<{ path: string; message: string }>) {
    super('Validation failed', 'VALIDATION_FAILED')
  }
}
```

### Controller Maps Errors to HTTP

```typescript
function errorHandler(err: unknown, req: Request, res: Response, next: NextFunction) {
  if (err instanceof ValidationError) return res.status(400).json({ error: err.code, issues: err.issues })
  if (err instanceof NotFoundError) return res.status(404).json({ error: err.code })
  if (err instanceof UnauthorizedError) return res.status(401).json({ error: err.code })
  logger.error({ err, path: req.path }, 'unhandled error')
  return res.status(500).json({ error: 'INTERNAL' })
}
```

Never let raw stack traces leak. Never swallow errors silently.

### Never Catch and Ignore

```typescript
// FAIL
try { await riskyOp() } catch (e) {}

// PASS: explicit handling
try { await riskyOp() } catch (e) {
  logger.warn({ err: e }, 'risky op failed, retrying')
  throw new RetryableError('risky-op', { cause: e })
}
```

If you do not know what to do with the error, rethrow it. The framework's error handler will deal with it.

## Transactions

A unit of work must be atomic. Use a transaction whenever multiple writes need to succeed or fail together.

```typescript
await db.transaction(async (tx) => {
  const order = await tx.order.create({ data: orderData })
  await tx.inventory.update({ where: { sku }, data: { decrement: order.quantity }})
  await tx.payment.create({ data: { orderId: order.id, amount: order.total }})
})
```

### Transaction Boundaries

- Transaction belongs in the SERVICE, not the repository. Repositories accept an optional `tx` parameter; the service decides when to start a transaction.
- Never make external API calls inside a DB transaction (locks held during network I/O). Use the outbox pattern or final commit step outside the transaction.
- Keep transactions short. Long transactions hold locks and block other writers.

## Database Access

### Query Patterns

- Always select only the columns you need. `SELECT *` is a footgun.
- Use indexes for WHERE, JOIN, and ORDER BY columns on hot paths.
- Pagination via keyset (cursor) for > 10K rows; OFFSET is fine for < 10K.
- Avoid N+1: use JOIN or `IN (...)` queries.
- Connection pooling: one pool per process, sized to the database's max connections / number of app instances.

### Migrations

- Forward-only by default. Down migrations are a luxury and often lie.
- One migration per change. No bundling unrelated schema changes.
- Never edit a deployed migration. Create a new one.
- Test migrations on a copy of production data before deploying.

## Caching Strategies

### Redis Caching Layer

```typescript
class CachedMarketRepository implements MarketRepository {
  constructor(
    private baseRepo: MarketRepository,
    private redis: RedisClient
  ) {}

  async findById(id: string): Promise<Market | null> {
    // Check cache first
    const cached = await this.redis.get(`market:${id}`)

    if (cached) {
      return JSON.parse(cached)
    }

    // Cache miss - fetch from database
    const market = await this.baseRepo.findById(id)

    if (market) {
      // Cache for 5 minutes
      await this.redis.setex(`market:${id}`, 300, JSON.stringify(market))
    }

    return market
  }

  async invalidateCache(id: string): Promise<void> {
    await this.redis.del(`market:${id}`)
  }
}
```

### Cache-Aside Pattern

```typescript
async function getMarketWithCache(id: string): Promise<Market> {
  const cacheKey = `market:${id}`

  // Try cache
  const cached = await redis.get(cacheKey)
  if (cached) return JSON.parse(cached)

  // Cache miss - fetch from DB
  const market = await db.markets.findUnique({ where: { id } })

  if (!market) throw new Error('Market not found')

  // Update cache
  await redis.setex(cacheKey, 300, JSON.stringify(market))

  return market
}
```
## Authentication & Sessions

- Use established libraries (Passport, NextAuth, Lucia, Clerk, Auth0). Do not roll your own JWT.
- Session cookies: `HttpOnly`, `Secure`, `SameSite=Lax` (or `Strict` for high-security).
- Passwords: bcrypt (cost 12+) or argon2id. Never MD5, SHA1, or unsalted.
- MFA for admin / high-privilege operations.
- Token rotation for refresh tokens. Detect token reuse.
- Rate limit auth endpoints aggressively (5 attempts / 15 min / IP).

## Authorization

AuthN (who) and AuthZ (what) are separate concerns.

```typescript
async function deletePost(userId: string, postId: string) {
  const post = await postRepo.findById(postId)
  if (!post) throw new NotFoundError('post', postId)
  if (post.authorId !== userId && !user.isAdmin) {
    throw new ForbiddenError('cannot delete this post')
  }
  await postRepo.delete(postId)
}
```

Centralize authorization logic. Do not scatter `if (user.id === post.authorId)` checks across the codebase.

## Logging

Structured JSON logs. Include:
- timestamp, level, message
- request_id, user_id (if authed)
- duration_ms for any operation > 10ms
- error stack and code for failures

Never log:
- Passwords, tokens, API keys, session IDs
- PII unless explicitly required (and even then, hash or mask)
- Full request/response bodies in prod (too verbose, may contain PII)

## Background Jobs & Queues

The pattern below is single-process and best-effort only (cache warm-up, debounced writes, fire-and-forget indexing). Anything that must survive a restart needs a durable broker — an in-memory queue loses every pending job on deploy and never delivers across replicas.

### Simple Queue Pattern

```typescript
class JobQueue<T> {
  private queue: T[] = []
  private processing = false

  async add(job: T): Promise<void> {
    this.queue.push(job)

    if (!this.processing) {
      this.process()
    }
  }

  private async process(): Promise<void> {
    this.processing = true

    while (this.queue.length > 0) {
      const job = this.queue.shift()!

      try {
        await this.execute(job)
      } catch (error) {
        console.error('Job failed:', error)
      }
    }

    this.processing = false
  }

  private async execute(job: T): Promise<void> {
    // Job execution logic
  }
}

// Usage for indexing markets
interface IndexJob {
  marketId: string
}

const indexQueue = new JobQueue<IndexJob>()

export async function POST(request: Request) {
  const { marketId } = await request.json()

  // Add to queue instead of blocking
  await indexQueue.add({ marketId })

  return NextResponse.json({ success: true, message: 'Job queued' })
}
```
## Anti-Patterns

- **Business logic in controllers** — extract to services.
- **Repository chains that call each other** — services orchestrate, repositories isolate.
- **`SELECT *` in production code** — explicit column lists.
- **Long transactions with external calls** — locks held during network I/O.
- **Catching errors and ignoring them** — rethrow or handle explicitly.
- **Logging PII or secrets** — mask, hash, or omit.
- **Auth in the frontend only** — backend must enforce authorization on every request.
- **One file per "thing" with 1000+ lines** — split by layer or aggregate.
