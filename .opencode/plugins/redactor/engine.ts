// engine.ts - redact/rehydrate with in-memory map (FIFO, max 4096)
import { createHash } from 'crypto'
import { RULES, DEFAULT_EXCLUSIONS } from './rules'
import { loadConfig } from './config'
import { logRedact } from './log'

type Entry = { value: string; ts: number }

const MAX = 4096
const map = new Map<string, Entry>()

const cfg = loadConfig()

function isExcluded(s: string): boolean {
  const ex = cfg.exclusions || DEFAULT_EXCLUSIONS
  const lower = s.toLowerCase()
  for (const e of ex) {
    const el = e.toLowerCase()
    if (!el) continue
    if (lower === el) return true
    if (el === 'example.com') {
      if (lower.endsWith('@' + el)) return true
      if (lower === el) return true
    }
    if (lower.endsWith('@' + el)) return true
    if (el === 'localhost' || el === '127.0.0.1' || el === '0.0.0.0') {
      if (lower.includes(el)) return true
    }
  }
  return false
}

function stableId(ruleId: string, value: string): string {
  const h = createHash('sha256').update(value).digest('hex').slice(0, 12)
  return `[REDACTED:${ruleId.toUpperCase()}:${h}]`
}

function ensureSize() {
  if (map.size <= MAX) return
  // FIFO by ts
  let oldestKey: string | null = null
  let oldestTs = Infinity
  for (const [k, v] of map.entries()) {
    if (v.ts < oldestTs) {
      oldestTs = v.ts
      oldestKey = k
      if (oldestTs === 0) break
    }
  }
  if (oldestKey) map.delete(oldestKey)
  // if still over (shouldn't happen), trim
  if (map.size > MAX) {
    // delete arbitrary first
    const first = map.keys().next().value
    if (first) map.delete(first)
  }
}

export function redact(text: string): string {
  if (!cfg.enabled) return text
  if (typeof text !== 'string' || text.length === 0) return text

  let out = text

  for (const rule of RULES) {
    // reset regex
    rule.re.lastIndex = 0
    out = out.replace(rule.re, (match) => {
      // for assignments, try to redact just the value part? be conservative and redact the match if value present
      // but easier: check exclusions on match
      // avoid double-redacting
      if (match.includes('[REDACTED:')) return match
      if (isExcluded(match)) return match

      const marker = stableId(rule.id, match)
      map.set(marker, { value: match, ts: Date.now() })
      ensureSize()
      logRedact('redact', { rule: rule.id, marker })
      return marker
    })
  }

  return out
}

export function rehydrate(text: string): string {
  if (typeof text !== 'string' || text.length === 0) return text
  if (!text.includes('[REDACTED:')) return text

  const re = /\[REDACTED:([A-Z0-9_-]+):([0-9a-f]+)\]/g
  re.lastIndex = 0
  let out = text
  const misses: string[] = []

  out = out.replace(re, (m) => {
    const e = map.get(m)
    if (!e) {
      misses.push(m)
      return m // will be treated as block condition by caller
    }
    return e.value
  })

  if (misses.length > 0) {
    logRedact('rehydrate.missing', { count: misses.length })
    const err = new Error(`REDACT_MAP_MISSING:${misses.length}`)
    ;(err as any).code = 'REDACT_MAP_MISSING'
    throw err
  }

  return out
}

export function clearMap() {
  map.clear()
}

export function mapSize() {
  return map.size
}
