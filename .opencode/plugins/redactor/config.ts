// config.ts - optional redactor.config.json loader (tolerant)
import { existsSync, readFileSync } from 'fs'
import { join } from 'path'
import { logRedact } from './log'

export type RedactorConfig = {
  enabled?: boolean
  rules?: string[]
  exclusions?: string[]
}

const DEFAULT_EXCLUSIONS = ['localhost', '127.0.0.1', '0.0.0.0', 'example.com']

export function loadConfig(): { rules?: string[]; exclusions: string[]; enabled: boolean } {
  const candidates = [
    join(process.cwd(), 'redactor.config.json'),
    join(process.cwd(), '.opencode', 'redactor.config.json'),
    join(process.env.LOCALAPPDATA || '', 'opencode', 'redactor.config.json'),
  ]
  for (const p of candidates) {
    if (!existsSync(p)) continue
    try {
      const raw = readFileSync(p, 'utf8')
      const cfg = JSON.parse(raw) as RedactorConfig
      const exclusions = Array.isArray(cfg.exclusions) ? cfg.exclusions : DEFAULT_EXCLUSIONS
      return {
        enabled: cfg.enabled !== false,
        rules: Array.isArray(cfg.rules) ? cfg.rules : undefined,
        exclusions,
      }
    } catch (e) {
      try {
        logRedact('config.load_failed', { path: p, err: String(e) })
      } catch {}
      // fall through to base
    }
  }
  return { enabled: true, exclusions: DEFAULT_EXCLUSIONS }
}
