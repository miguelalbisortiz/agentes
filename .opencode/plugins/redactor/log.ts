// log.ts - silent logger to .opencode/logs/redact.log
import { existsSync, mkdirSync, appendFileSync } from 'fs'
import { join } from 'path'

function getLogPath(): string {
  const dir = join(process.cwd(), '.opencode', 'logs')
  try {
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  } catch {}
  return join(dir, 'redact.log')
}

export function logRedact(event: string, meta?: Record<string, unknown>) {
  try {
    const line = JSON.stringify({ ts: new Date().toISOString(), event, ...(meta || {}) }) + '\n'
    appendFileSync(getLogPath(), line, 'utf8')
  } catch {
    // never propagate
  }
}
