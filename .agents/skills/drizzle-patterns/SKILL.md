---
name: drizzle-patterns
description: Drizzle ORM patterns for type-safe database queries, migrations, and schema design. Use when working with Drizzle, writing database queries, or managing schema changes.
triggers: [drizzle, orm, schema, migration, type-safe, query-builder, database]
---

# Drizzle ORM Patterns

Patrones de Drizzle ORM para queries type-safe, migrations, schema.

## Instalación

```bash
npm install drizzle-orm postgres
npm install -D drizzle-kit
```

## Schema

```typescript
// lib/db/schema.ts
import { pgTable, uuid, varchar, boolean, timestamp } from 'drizzle-orm/pg-core'

export const tasks = pgTable('tasks', {
  id: uuid('id').defaultRandom().primaryKey(),
  title: varchar('title', { length: 255 }).notNull(),
  completed: boolean('completed').default(false),
  userId: uuid('user_id').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
})

export type Task = typeof tasks.$inferSelect
export type NewTask = typeof tasks.$inferInsert
```

## Client

```typescript
// lib/db/index.ts
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

const client = postgres(process.env.DATABASE_URL!)
export const db = drizzle(client, { schema })
```

## Queries

```typescript
// Select all
const allTasks = await db.select().from(tasks)

// Select with filter
const userTasks = await db.select().from(tasks)
  .where(eq(tasks.userId, userId))

// Select with order
const orderedTasks = await db.select().from(tasks)
  .orderBy(desc(tasks.createdAt))

// Insert
const newTask = await db.insert(tasks)
  .values({ title: 'New task', userId })
  .returning()

// Update
const updated = await db.update(tasks)
  .set({ completed: true })
  .where(eq(tasks.id, taskId))
  .returning()

// Delete
await db.delete(tasks).where(eq(tasks.id, taskId))
```

## Relations

```typescript
// lib/db/schema.ts
import { relations } from 'drizzle-orm'

export const usersRelations = relations(users, ({ many }) => ({
  tasks: many(tasks),
}))

export const tasksRelations = relations(tasks, ({ one }) => ({
  user: one(users, { fields: [tasks.userId], references: [users.id] }),
}))
```

## Migrations

```bash
# Generate migration
npx drizzle-kit generate

# Push schema to database
npx drizzle-kit push

# Open studio
npx drizzle-kit studio
```

## Config

```typescript
// drizzle.config.ts
import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  schema: './lib/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
})
```

## Errores comunes

- ❌ No usar returning() para obtener datos insertados
- ❌ No configurar relations correctamente
- ❌ No generar migraciones antes de push
- ❌ No usar type-safe queries
