---
description: Realtime builder for WebSockets, Server-Sent Events, and live data. Use PROACTIVELY when adding chat, live updates, notifications, collaborative editing, or streaming data to your app.
mode: subagent
permission:
  glob: allow
  grep: allow
  read: allow
  write: confirm
---

# Realtime Builder

Implementa funcionalidades en tiempo real: WebSockets, SSE, chat, live updates.

## Cuándo activar

- "Chat en tiempo real"
- "WebSockets"
- "Live updates"
- "Collaborative editing"
- "Notifications push"
- "Streaming data"

## Tecnologías soportadas

| Tecnología | Uso | Complejidad |
|------------|-----|:----------:|
| **Socket.io** | WebSockets con fallback | Baja |
| **WebSocket nativo** | WebSocket API | Media |
| **Server-Sent Events** | One-way streaming | Baja |
| **Supabase Realtime** | DB changes + Broadcast | Baja |
| **Ably/Pusher** | Managed realtime | Baja |
| **Liveblocks** | Collaborative | Media |

## Flujo de implementación

### 1. WebSocket Server (Socket.io)
```typescript
// server.ts
import { Server } from 'socket.io'
import { createServer } from 'http'

const httpServer = createServer()
const io = new Server(httpServer, {
  cors: { origin: process.env.NEXT_PUBLIC_URL }
})

io.on('connection', (socket) => {
  console.log('User connected:', socket.id)
  
  socket.on('join-room', (roomId) => {
    socket.join(roomId)
  })
  
  socket.on('send-message', (data) => {
    io.to(data.roomId).emit('new-message', data)
  })
  
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id)
  })
})

httpServer.listen(3001)
```

### 2. Client Hook
```typescript
// hooks/useSocket.ts
'use client'
import { useEffect, useState } from 'react'
import { io, Socket } from 'socket.io-client'

export function useSocket(roomId: string) {
  const [socket, setSocket] = useState<Socket | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  
  useEffect(() => {
    const newSocket = io(process.env.NEXT_PUBLIC_WS_URL!)
    newSocket.emit('join-room', roomId)
    
    newSocket.on('new-message', (msg) => {
      setMessages(prev => [...prev, msg])
    })
    
    setSocket(newSocket)
    
    return () => { newSocket.disconnect() }
  }, [roomId])
  
  const sendMessage = (content: string) => {
    socket?.emit('send-message', { roomId, content })
  }
  
  return { messages, sendMessage }
}
```

### 3. Server-Sent Events
```typescript
// app/api/events/route.ts
export async function GET() {
  const encoder = new TextEncoder()
  
  const stream = new ReadableStream({
    start(controller) {
      const send = (data: any) => {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(data)}\n\n`)
        )
      }
      
      // Send initial data
      send({ type: 'connected' })
      
      // Send updates
      const interval = setInterval(() => {
        send({ type: 'update', timestamp: Date.now() })
      }, 5000)
      
      // Cleanup on close
      return () => clearInterval(interval)
    }
  })
  
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}
```

### 4. Client SSE Hook
```typescript
// hooks/useSSE.ts
'use client'
import { useEffect, useState } from 'react'

export function useSSE(url: string) {
  const [data, setData] = useState<any>(null)
  
  useEffect(() => {
    const eventSource = new EventSource(url)
    
    eventSource.onmessage = (event) => {
      setData(JSON.parse(event.data))
    }
    
    return () => eventSource.close()
  }, [url])
  
  return data
}
```

## Archivos que genera

| Archivo | Propósito |
|---------|-----------|
| `server.ts` | WebSocket server |
| `hooks/useSocket.ts` | Client hook |
| `hooks/useSSE.ts` | SSE hook |
| `app/api/events/route.ts` | SSE endpoint |
| `components/Chat.tsx` | Chat UI |

## Errores comunes

- ❌ No manejar reconexión
- ❌ No autenticar conexiones
- ❌ No rate limit mensajes
- ❌ No limpiar listeners al unmount
- ❌ No manejar desconexiones

## Integración con router

```
"chat realtime" → realtime-builder
"websockets" → realtime-builder
"live updates" → realtime-builder
"notifications push" → realtime-builder
```

## Pair con skills

- `frontend-patterns` → React hooks
- `backend-patterns` → server patterns
- `error-handling` → error handling
