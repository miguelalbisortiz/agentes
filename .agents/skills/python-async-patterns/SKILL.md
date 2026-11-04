---
name: python-async-patterns
description: Use this skill when working with Python async/await, FastAPI, background tasks, connection pooling, and async database operations. Covers asyncio, aiohttp, asyncpg, SQLAlchemy async, and performance optimization.
triggers: [python async, asyncio, fastapi, background tasks, connection pooling, async database, aiohttp, asyncpg]
origin: starter-pack
---

# Python Async Patterns

Patterns for async/await, FastAPI, background tasks, and connection pooling.

## When to Activate

- Setting up FastAPI with async endpoints
- Implementing background tasks with Celery or ARQ
- Configuring connection pooling for databases
- Optimizing async performance
- Handling concurrent operations
- Setting up async HTTP clients

## FastAPI Async Patterns

### Basic Async Endpoint

```python
from fastapi import FastAPI
import httpx

app = FastAPI()

@app.get("/users/{user_id}")
async def get_user(user_id: int):
    async with httpx.AsyncClient() as client:
        response = await client.get(f"https://api.example.com/users/{user_id}")
        return response.json()
```

### Dependency Injection

```python
from fastapi import Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

async def get_db():
    async with async_session() as session:
        try:
            yield session
        finally:
            await session.close()

@app.get("/users/{user_id}")
async def get_user(user_id: int, db: AsyncSession = Depends(get_db)):
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user
```

### Background Tasks

```python
from fastapi import BackgroundTasks

def send_email(email: str, message: str):
    # Simulate email sending
    time.sleep(2)
    print(f"Email sent to {email}")

@app.post("/send-notification/")
async def send_notification(email: str, background_tasks: BackgroundTasks):
    background_tasks.add_task(send_email, email, "Hello!")
    return {"message": "Notification sent in background"}
```

## Async Database Patterns

### SQLAlchemy Async

```python
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

engine = create_async_engine(
    "postgresql+asyncpg://user:pass@localhost/db",
    pool_size=20,
    max_overflow=10,
    pool_pre_ping=True
)

async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

async def get_user(user_id: int):
    async with async_session() as session:
        result = await session.execute(select(User).where(User.id == user_id))
        return result.scalar_one_or_none()
```

### Connection Pooling

```python
import asyncpg

# Create connection pool
pool = await asyncpg.create_pool(
    "postgresql://user:pass@localhost/db",
    min_size=5,
    max_size=20,
    command_timeout=60
)

async def get_user(user_id: int):
    async with pool.acquire() as conn:
        return await conn.fetchrow(
            "SELECT * FROM users WHERE id = $1", user_id
        )
```

### Batch Operations

```python
async def create_users(users: list[UserCreate]):
    async with async_session() as session:
        objects = [User(**user.model_dump()) for user in users]
        session.add_all(objects)
        await session.commit()
        return objects

async def batch_update(updates: list[dict]):
    async with pool.acquire() as conn:
        await conn.executemany(
            "UPDATE users SET name = $1 WHERE id = $2",
            [(u['name'], u['id']) for u in updates]
        )
```

## Background Task Patterns

### Celery

```python
from celery import Celery

celery_app = Celery('tasks', broker='redis://localhost:6379')

@celery_app.task
def process_order(order_id: int):
    # Long-running task
    order = db.get(Order, order_id)
    # Process...
    return {"status": "completed", "order_id": order_id}

# Usage
process_order.delay(order_id=123)
```

### ARQ (Async)

```python
from arq import create_pool
from arq.connections import RedisSettings

async def process_order(ctx, order_id: int):
    # Async background task
    await send_notification(order_id)
    return {"status": "completed"}

# Schedule task
await pool.enqueue_job(process_order, order_id=123)
```

### Task Queues

```python
import asyncio
from collections import deque

class TaskQueue:
    def __init__(self, max_concurrent: int = 10):
        self.queue = deque()
        self.semaphore = asyncio.Semaphore(max_concurrent)
        self.running = False

    async def add_task(self, coro):
        self.queue.append(coro)
        if not self.running:
            self.running = True
            asyncio.create_task(self._process())

    async def _process(self):
        while self.queue:
            coro = self.queue.popleft()
            async with self.semaphore:
                await coro
        self.running = False
```

## Async HTTP Clients

### httpx

```python
import httpx

async def fetch_data():
    async with httpx.AsyncClient(
        timeout=30.0,
        limits=httpx.Limits(max_connections=100)
    ) as client:
        response = await client.get("https://api.example.com/data")
        return response.json()
```

### aiohttp

```python
import aiohttp

async def fetch_data():
    async with aiohttp.ClientSession(
        timeout=aiohttp.ClientTimeout(total=30)
    ) as session:
        async with session.get("https://api.example.com/data") as response:
            return await response.json()
```

### Concurrent Requests

```python
import asyncio
import httpx

async def fetch_all(urls: list[str]):
    async with httpx.AsyncClient() as client:
        tasks = [client.get(url) for url in urls]
        responses = await asyncio.gather(*tasks)
        return [r.json() for r in responses]
```

## Performance Patterns

### Connection Pooling

```python
# Database connection pool
engine = create_async_engine(
    DATABASE_URL,
    pool_size=20,          # Base connections
    max_overflow=10,       # Extra connections when needed
    pool_timeout=30,       # Wait time for connection
    pool_recycle=1800,     # Recycle connections every 30 min
    pool_pre_ping=True     # Verify connections
)

# Redis connection pool
redis_pool = await redis.create_pool(
    REDIS_URL,
    minsize=5,
    maxsize=20
)
```

### Caching

```python
from functools import lru_cache
from cachetools import TTLCache

# In-memory cache
cache = TTLCache(maxsize=1000, ttl=300)

async def get_user(user_id: int):
    if user_id in cache:
        return cache[user_id]

    user = await db.get(User, user_id)
    cache[user_id] = user
    return user
```

### Rate Limiting

```python
import asyncio
from collections import defaultdict

class RateLimiter:
    def __init__(self, max_requests: int, window_seconds: int):
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self.requests = defaultdict(list)

    async def acquire(self, key: str) -> bool:
        now = time.time()
        window_start = now - self.window_seconds

        # Clean old requests
        self.requests[key] = [
            req for req in self.requests[key]
            if req > window_start
        ]

        if len(self.requests[key]) >= self.max_requests:
            return False

        self.requests[key].append(now)
        return True
```

## Error Handling

### Retry Logic

```python
import asyncio
from tenacity import retry, stop_after_attempt, wait_exponential

@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=4, max=10)
)
async def fetch_data():
    async with httpx.AsyncClient() as client:
        response = await client.get("https://api.example.com/data")
        response.raise_for_status()
        return response.json()
```

### Circuit Breaker

```python
import asyncio
from datetime import datetime, timedelta

class CircuitBreaker:
    def __init__(self, failure_threshold: int = 5, reset_timeout: int = 60):
        self.failure_threshold = failure_threshold
        self.reset_timeout = reset_timeout
        self.failures = 0
        self.last_failure = None
        self.state = "closed"

    async def call(self, func, *args, **kwargs):
        if self.state == "open":
            if datetime.now() - self.last_failure > timedelta(seconds=self.reset_timeout):
                self.state = "half-open"
            else:
                raise Exception("Circuit breaker is open")

        try:
            result = await func(*args, **kwargs)
            if self.state == "half-open":
                self.state = "closed"
                self.failures = 0
            return result
        except Exception as e:
            self.failures += 1
            self.last_failure = datetime.now()
            if self.failures >= self.failure_threshold:
                self.state = "open"
            raise
```

## Anti-Patterns

1. **Blocking I/O in async** → `time.sleep()` instead of `asyncio.sleep()`
2. **Missing connection pooling** → New connection per request
3. **No error handling** → Unhandled exceptions crash workers
4. **Missing timeout** → Requests hang forever
5. **No retry logic** → Temporary failures become permanent

## Related Skills

- `caching-patterns` — for Redis caching
- `message-queue-patterns` — for Celery/ARQ
- `observability` — for async monitoring

## Related Agents

- `python-reviewer` — for Python code review
- `performance-optimizer` — for async optimization
