---
name: caching-patterns
description: Use this skill when implementing caching strategies. Covers Redis, Memcached, CDN, HTTP caching, application-level caching, cache invalidation, and cache warming patterns.
triggers: [cache, redis, memcached, CDN, HTTP cache, cache invalidation, cache warming, TTL, LRU]
origin: starter-pack
---

# Caching Patterns

Patterns for implementing effective caching strategies at every layer.

## When to Activate

- Setting up Redis or Memcached
- Implementing HTTP caching headers
- Designing cache invalidation strategies
- Adding cache warming for cold starts
- Debugging cache consistency issues
- Optimizing application performance with caching

## Cache Layers

```
┌─────────────────────────────────────────┐
│  Browser Cache (HTTP headers)           │
├─────────────────────────────────────────┤
│  CDN Cache (CloudFront, Cloudflare)     │
├─────────────────────────────────────────┤
│  API Gateway Cache                       │
├─────────────────────────────────────────┤
│  Application Cache (in-memory)          │
├─────────────────────────────────────────┤
│  Distributed Cache (Redis/Memcached)    │
├─────────────────────────────────────────┤
│  Database Cache (query cache, buffer)   │
└─────────────────────────────────────────┘
```

## Redis Patterns

### Connection Setup

```typescript
import { Redis } from 'ioredis';

const redis = new Redis({
  host: process.env.REDIS_HOST,
  port: 6379,
  maxRetriesPerRequest: 3,
  retryStrategy(times) {
    const delay = Math.min(times * 50, 2000);
    return delay;
  }
});

// Handle errors
redis.on('error', (err) => {
  console.error('Redis error:', err);
});
```

### Basic Cache Operations

```typescript
class CacheService {
  async get<T>(key: string): Promise<T | null> {
    const data = await this.redis.get(key);
    if (!data) return null;
    return JSON.parse(data);
  }

  async set(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    await this.redis.set(key, JSON.stringify(value), 'EX', ttlSeconds);
  }

  async del(key: string): Promise<void> {
    await this.redis.del(key);
  }

  async exists(key: string): Promise<boolean> {
    const result = await this.redis.exists(key);
    return result === 1;
  }
}
```

### Cache-Aside Pattern

```typescript
async function getUser(userId: string): Promise<User> {
  const cacheKey = `user:${userId}`;

  // Check cache first
  const cached = await cache.get<User>(cacheKey);
  if (cached) return cached;

  // Fetch from database
  const user = await db.users.findById(userId);
  if (!user) return null;

  // Store in cache
  await cache.set(cacheKey, user, 3600);  // 1 hour TTL

  return user;
}
```

### Write-Through Pattern

```typescript
async function updateUser(userId: string, data: Partial<User>): Promise<User> {
  // Write to database
  const user = await db.users.update(userId, data);

  // Update cache
  const cacheKey = `user:${userId}`;
  await cache.set(cacheKey, user, 3600);

  return user;
}
```

### Write-Behind Pattern

```typescript
async function updateUser(userId: string, data: Partial<User>): Promise<User> {
  // Update cache immediately
  const cacheKey = `user:${userId}`;
  const cached = await cache.get<User>(cacheKey);
  const updated = { ...cached, ...data };
  await cache.set(cacheKey, updated, 3600);

  // Async write to database
  setImmediate(async () => {
    await db.users.update(userId, data);
  });

  return updated;
}
```

### Cache Invalidation

```typescript
// Delete on write
async function deleteUser(userId: string): Promise<void> {
  await db.users.delete(userId);
  await cache.del(`user:${userId}`);
  await cache.del(`user:${userId}:profile`);
  await cache.del(`user:${userId}:settings`);
}

// Pattern-based invalidation
async function invalidatePattern(pattern: string): Promise<void> {
  const keys = await this.redis.keys(pattern);
  if (keys.length > 0) {
    await this.redis.del(...keys);
  }
}

// Usage
await invalidatePattern('user:123:*');
```

### Cache Warming

```typescript
// Pre-populate cache on startup
async function warmCache(): Promise<void> {
  const criticalUsers = await db.users.findCritical();
  const promises = criticalUsers.map(async (user) => {
    const key = `user:${user.id}`;
    await cache.set(key, user, 3600);
  });
  await Promise.all(promises);
}

// Warm on deployment
if (process.env.NODE_ENV === 'production') {
  await warmCache();
}
```

### Rate Limiting

```typescript
async function checkRateLimit(key: string, limit: number, windowMs: number): Promise<boolean> {
  const now = Date.now();
  const windowStart = now - windowMs;

  const multi = redis.multi();
  multi.zremrangebyscore(key, 0, windowStart);
  multi.zadd(key, now, now);
  multi.zcard(key);
  multi.expire(key, Math.ceil(windowMs / 1000));

  const results = await multi.exec();
  const count = results[2][1] as number;

  return count <= limit;
}
```

## HTTP Caching Patterns

### Cache-Control Headers

```typescript
// Express.js
app.get('/api/users/:id', (req, res) => {
  res.set({
    'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
    'ETag': generateETag(user),
    'Last-Modified': user.updatedAt.toUTCString()
  });
  res.json(user);
});

// Different strategies per endpoint
app.get('/api/products', (req, res) => {
  res.set('Cache-Control', 'private, max-age=300');  // 5 min
  res.json(products);
});

app.get('/api/health', (req, res) => {
  res.set('Cache-Control', 'no-store');  // Never cache
  res.json({ status: 'ok' });
});
```

### Conditional Requests

```typescript
app.get('/api/data/:id', (req, res) => {
  const data = await getData(req.params.id);
  const etag = generateETag(data);

  // Check If-None-Match
  if (req.headers['if-none-match'] === etag) {
    return res.status(304).end();  // Not modified
  }

  res.set('ETag', etag);
  res.json(data);
});
```

### CDN Caching

```yaml
# CloudFront behavior
CacheBehaviors:
  - PathPattern: '/api/products*'
    TTL:
      DefaultTTL: 300
      MaxTTL: 3600
      MinTTL: 0
    Compress: true
    ViewerProtocolPolicy: redirect-to-https
```

## Application-Level Caching

### In-Memory LRU Cache

```typescript
import { LRUCache } from 'lru-cache';

const cache = new LRUCache({
  max: 500,  // Max items
  ttl: 1000 * 60 * 5,  // 5 minutes
  updateAgeOnGet: true
});

function getCached(key: string): unknown {
  return cache.get(key);
}

function setCached(key: string, value: unknown): void {
  cache.set(key, value);
}
```

### Multi-Level Cache

```typescript
class MultiLevelCache {
  private memory = new LRUCache({ max: 100, ttl: 60000 });  // 1 min
  private redis: Redis;

  async get<T>(key: string): Promise<T | null> {
    // L1: Memory
    const memCached = this.memory.get(key) as T;
    if (memCached) return memCached;

    // L2: Redis
    const redisCached = await this.redis.get(key);
    if (redisCached) {
      const parsed = JSON.parse(redisCached) as T;
      this.memory.set(key, parsed);  // Promote to L1
      return parsed;
    }

    return null;
  }

  async set(key: string, value: unknown, ttl: number): Promise<void> {
    this.memory.set(key, value);
    await this.redis.set(key, JSON.stringify(value), 'EX', ttl);
  }
}
```

## Cache Invalidation Strategies

### Time-Based (TTL)
```typescript
// Simple expiration
await cache.set('user:123', userData, 3600);  // 1 hour
```

### Event-Based
```typescript
// Invalidate on write
await db.users.update(id, data);
await cache.del(`user:${id}`);
```

### Version-Based
```typescript
// Include version in key
const key = `user:${id}:v${user.version}`;
```

### Tag-Based
```typescript
// Tag-based invalidation
async function invalidateTag(tag: string): Promise<void> {
  const keys = await redis.smembers(`tag:${tag}`);
  if (keys.length) {
    await redis.del(...keys);
    await redis.del(`tag:${tag}`);
  }
}

// Tag items
await redis.sadd('tag:users', 'user:123', 'user:456');
```

## Anti-Patterns

1. **No TTL** → Cache grows forever
2. **Thundering herd** → Many requests hit DB on cache miss
3. **Cache stampede** → Concurrent rebuilds of same key
4. **Stale data** → Inconsistent cache invalidation
5. **Over-caching** → Caching everything, including mutable data
6. **No monitoring** → Blind to cache hit rates
7. **Hardcoded TTLs** → Different data needs different TTLs

## Related Skills

- `message-queue-patterns` — for Redis Streams
- `observability` — for cache metrics
- `database-migrations` — for database query caching

## Related Agents

- `performance-optimizer` — for cache optimization
- `event-driven-architect` — for event-based invalidation
