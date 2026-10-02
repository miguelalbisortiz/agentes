---
name: supabase-patterns
description: Supabase patterns for database, auth, realtime, storage, and Edge Functions. Use when working with Supabase client, Row Level Security, subscriptions, or file storage.
triggers: [supabase, postgres, rls, realtime, storage, edge-functions, row-level-security, subscription]
---

# Supabase Patterns

Patrones de Supabase para database, auth, realtime, storage.

## Instalación

```bash
npm install @supabase/supabase-js @supabase/ssr
```

## Client Setup

```typescript
// lib/supabase/client.ts
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

```typescript
// lib/supabase/server.ts
import { createServerClient } from '@supabase/ssr'

export async function createClient() {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        },
      },
    }
  )
  return supabase
}
```

## Queries

```typescript
// Fetch data
const { data, error } = await supabase
  .from('tasks')
  .select('*')
  .order('created_at', { ascending: false })

// Insert
const { data, error } = await supabase
  .from('tasks')
  .insert({ title: 'New task', user_id: userId })
  .select()

// Update
const { data, error } = await supabase
  .from('tasks')
  .update({ completed: true })
  .eq('id', taskId)

// Delete
const { error } = await supabase
  .from('tasks')
  .delete()
  .eq('id', taskId)
```

## Row Level Security (RLS)

```sql
-- Enable RLS
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own tasks
CREATE POLICY "Users can view own tasks" ON tasks
  FOR SELECT USING (auth.uid() = user_id);

-- Policy: Users can insert their own tasks
CREATE POLICY "Users can insert own tasks" ON tasks
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own tasks
CREATE POLICY "Users can update own tasks" ON tasks
  FOR UPDATE USING (auth.uid() = user_id);

-- Policy: Users can delete their own tasks
CREATE POLICY "Users can delete own tasks" ON tasks
  FOR DELETE USING (auth.uid() = user_id);
```

## Realtime Subscriptions

```typescript
// Subscribe to changes
const channel = supabase
  .channel('tasks-changes')
  .on(
    'postgres_changes',
    { event: '*', schema: 'public', table: 'tasks' },
    (payload) => {
      console.log('Change:', payload)
    }
  )
  .subscribe()

// Cleanup
supabase.removeChannel(channel)
```

## File Storage

```typescript
// Upload file
const { data, error } = await supabase.storage
  .from('avatars')
  .upload(`${userId}/avatar.jpg`, file)

// Get public URL
const { data: { publicUrl } } = supabase.storage
  .from('avatars')
  .getPublicUrl(`${userId}/avatar.jpg`)
```

## Variables de entorno

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

## Errores comunes

- ❌ No configurar RLS (CRÍTICO)
- ❌ No usar server client para auth
- ❌ No limpiar suscripciones de realtime
- ❌ No manejar errores de storage
