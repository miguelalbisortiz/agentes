---
name: turso-libsql
description: Turso/libSQL patterns for edge databases, embedded replicas, and global distribution. Use when working with Turso, libSQL, or needing a SQLite-compatible edge database.
triggers: [turso, libsql, edge-database, sqlite, embedded-replica, global-database]
---

# Turso/libSQL Patterns

Patrones de Turso/libSQL para bases de datos edge globales.

## Instalación

```bash
npm install @libsql/client
```

## Client Setup

```typescript
// lib/turso.ts
import { createClient } from '@libsql/client'

export const turso = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN,
})
```

## Queries

```typescript
// Execute query
const result = await turso.execute('SELECT * FROM tasks')

// With parameters
const result = await turso.execute({
  sql: 'SELECT * FROM tasks WHERE user_id = ?',
  args: [userId]
})

// Insert
await turso.execute({
  sql: 'INSERT INTO tasks (title, user_id) VALUES (?, ?)',
  args: ['New task', userId]
})

// Update
await turso.execute({
  sql: 'UPDATE tasks SET completed = ? WHERE id = ?',
  args: [true, taskId]
})

// Delete
await turso.execute({
  sql: 'DELETE FROM tasks WHERE id = ?',
  args: [taskId]
})
```

## Batch Transactions

```typescript
await turso.batch([
  {
    sql: 'INSERT INTO tasks (title, user_id) VALUES (?, ?)',
    args: ['Task 1', userId]
  },
  {
    sql: 'INSERT INTO tasks (title, user_id) VALUES (?, ?)',
    args: ['Task 2', userId]
  }
], 'write')
```

## Embedded Replicas (Local Cache)

```typescript
import { createClient } from '@libsql/client'

const turso = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN,
  syncUrl: process.env.TURSO_DATABASE_URL,
  syncInterval: 60,
})

// Sync periodically
await turso.sync()
```

## Variables de entorno

```env
TURSO_DATABASE_URL=libsql://xxx.turso.io
TURSO_AUTH_TOKEN=eyJ...
```

## Errores comunes

- ❌ No configurar auth token
- ❌ No usar embedded replicas para low latency
- ❌ No manejar errores de sync
- ❌ No usar batch para transacciones
