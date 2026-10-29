// index.ts - OpenCode V2 plugin for redactor
import type { Plugin } from '@opencode-ai/plugin'
import { redact, rehydrate } from './engine'
import { logRedact } from './log'

// We need to hook before sending to model (context/compaction/generate/title)
// and handle tool execution (rehydrate inputs, block on map miss)
const plugin: Plugin = async (ctx) => {
  const safe = (fn: () => void) => {
    try { fn() } catch (e) { logRedact('hook.error', { err: String(e) }) }
  }

  // Session-level hooks: redact outgoing context/messages/options where possible
  // API V2: ctx.session.hook accepts context|compaction|generate|title
  try {
    ctx.session.hook('context', (event: any) => {
      safe(() => {
        if (!event) return event
        // try to redact common fields
        if (typeof event.messages === 'string') event.messages = redact(event.messages)
        else if (Array.isArray(event.messages)) {
          for (let i = 0; i < event.messages.length; i++) {
            const m = event.messages[i]
            if (typeof m === 'string') event.messages[i] = redact(m)
            else if (m && typeof m.content === 'string') m.content = redact(m.content)
            else if (m && Array.isArray(m.content)) {
              for (let j = 0; j < m.content.length; j++) {
                const c = m.content[j]
                if (c && typeof c.text === 'string') c.text = redact(c.text)
              }
            }
          }
        }
        if (typeof event.system === 'string') event.system = redact(event.system)
        if (typeof event.options === 'string') event.options = redact(event.options)
        return event
      })
    })
  } catch (e) { logRedact('hook.reg', { hook: 'context', err: String(e) }) }

  try {
    ctx.session.hook('compaction', (event: any) => {
      safe(() => {
        if (!event) return event
        if (typeof event.messages === 'string') event.messages = redact(event.messages)
        else if (Array.isArray(event.messages)) {
          for (let i = 0; i < event.messages.length; i++) {
            const m = event.messages[i]
            if (typeof m === 'string') event.messages[i] = redact(m)
            else if (m && typeof m.content === 'string') m.content = redact(m.content)
          }
        }
        if (typeof event.system === 'string') event.system = redact(event.system)
        return event
      })
    })
  } catch (e) { logRedact('hook.reg', { hook: 'compaction', err: String(e) }) }

  try {
    ctx.session.hook('generate', (event: any) => {
      safe(() => {
        if (!event) return event
        if (typeof event.messages === 'string') event.messages = redact(event.messages)
        else if (Array.isArray(event.messages)) {
          for (let i = 0; i < event.messages.length; i++) {
            const m = event.messages[i]
            if (typeof m === 'string') event.messages[i] = redact(m)
            else if (m && typeof m.content === 'string') m.content = redact(m.content)
            else if (m && Array.isArray(m.content)) {
              for (let j = 0; j < m.content.length; j++) {
                const c = m.content[j]
                if (c && typeof c.text === 'string') c.text = redact(c.text)
              }
            }
          }
        }
        if (typeof event.system === 'string') event.system = redact(event.system)
        if (typeof event.options === 'string') event.options = redact(event.options)
        return event
      })
    })
  } catch (e) { logRedact('hook.reg', { hook: 'generate', err: String(e) }) }

  try {
    ctx.session.hook('title', (event: any) => {
      safe(() => {
        if (!event) return event
        if (typeof event.input === 'string') event.input = redact(event.input)
        if (typeof event.messages === 'string') event.messages = redact(event.messages)
        return event
      })
    })
  } catch (e) { logRedact('hook.reg', { hook: 'title', err: String(e) }) }

  // Tool execution: rehydrate inputs before tool runs
  try {
    ctx.tool.hook('execute.before', (event: any) => {
      if (!event) return
      // try to rehydrate common fields
      const rehyd = (obj: any, path: string) => {
        if (!obj || typeof obj !== 'object') return
        for (const k of Object.keys(obj)) {
          const v = obj[k]
          if (typeof v === 'string') {
            if (v.includes('[REDACTED:')) {
              try {
                obj[k] = rehydrate(v)
              } catch (e: any) {
                logRedact('tool.block', { path: path + '.' + k, code: e?.code })
                // block by throwing as per spec (degrade securely)
                throw e
              }
            }
          } else if (Array.isArray(v)) {
            for (let i = 0; i < v.length; i++) {
              if (typeof v[i] === 'string' && v[i].includes('[REDACTED:')) {
                try {
                  v[i] = rehydrate(v[i])
                } catch (e: any) {
                  logRedact('tool.block', { path: path + '.' + k, code: e?.code })
                  throw e
                }
              } else if (v[i] && typeof v[i] === 'object') {
                rehyd(v[i], path + '.' + k + '[' + i + ']')
              }
            }
          } else if typeof (v) === 'object' {
            rehyd(v, path + '.' + k)
          }
        }
      }

      try {
        if (event.input) rehyd(event.input, 'input')
        if (event.toolInput) rehyd(event.toolInput, 'toolInput')
      } catch (e) {
        throw e
      }
    })
  } catch (e) { logRedact('hook.reg', { hook: 'tool.execute.before', err: String(e) }) }

  return {}
}

export default plugin
