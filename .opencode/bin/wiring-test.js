#!/usr/bin/env node
/**
 * wiring-test.js — EvalOps layer 1: is the pack WIRED correctly?
 *
 * The other verifiers prove the pack is well BUILT (frontmatter, prose, counts,
 * installer, token weight). This one proves the pieces are CONNECTED: that
 * every command reaches a real agent, that every agent and skill can actually
 * be dispatched to, and that nothing is an orphan.
 *
 * It is deliberately static (no LLM, no network, no runtime) so it can run in
 * CI next to validate-frontmatter and smoke-test.
 *
 *   node .opencode/bin/wiring-test.js
 *   node .opencode/bin/wiring-test.js --json
 *
 * Exit codes:
 *   0 = every check passed
 *   1 = at least one check failed
 *
 * Checks:
 *   W1  every command's `agent:` is a builtin or an existing agent file
 *   W2  every agent is reachable from a dispatch surface
 *   W3  every skill is reachable from ROUTE / router / INDEX / commands
 *   W4  every skill's `name:` matches its directory and is unique
 *   W5  every skill declares `triggers:` or `description:`
 *   W6  every skill directory contains a SKILL.md
 *   W7  every command has a description and a body after its frontmatter
 *   W8  every agent declares a `permission:` block
 */

const fs = require('fs');
const path = require('path')

const ROOT = path.resolve(__dirname, '..', '..')
const AGENTS_DIR = path.join(ROOT, '.opencode', 'agents')
const COMMANDS_DIR = path.join(ROOT, '.opencode', 'commands')
const SKILLS_DIR = path.join(ROOT, '.agents', 'skills')
const ROUTE = path.join(ROOT, '.opencode', 'manual', 'ROUTE.md')
const ROUTER = path.join(ROOT, '.agents', 'skills', 'router', 'SKILL.md')
const AGENTS_INDEX = path.join(ROOT, '.opencode', 'AGENTS_INDEX.md')
const SKILLS_INDEX = path.join(ROOT, '.agents', 'skills', 'INDEX.md')
const COMMANDS_DOC = path.join(ROOT, '.opencode', 'manual', 'COMMANDS.md')

// Same list validate-frontmatter.js uses — do not fork the definition.
const BUILTIN = ['build', 'plan', 'general', 'explore', 'compaction', 'title', 'task', 'session']

const asJson = process.argv.includes('--json')
const results = []
let failures = 0

function check(id, label, fn) {
  let detail = ''
  let ok = true
  try {
    const r = fn()
    if (r && typeof r === 'object') { ok = r.ok !== false; detail = r.detail || '' }
    else if (typeof r === 'string') { detail = r }
  } catch (e) {
    ok = false
    detail = 'exception: ' + e.message
  }
  if (!ok) failures++
  results.push({ id, label, ok, detail })
}

function read(p) { try { return fs.readFileSync(p, 'utf8') } catch { return '' } }
function listMd(dir) {
  try { return fs.readdirSync(dir).filter(f => f.endsWith('.md')).map(f => f.replace(/\.md$/, '')) }
  catch { return [] }
}
function fm(text) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---/)
  return m ? m[1] : ''
}
function body(text) {
  const m = text.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/)
  return m ? text.slice(m[0].length) : text
}
function exists(p) { try { fs.accessSync(p); return true } catch { return false } }

// ---------------------------------------------------------------------------
const agentFiles = listMd(AGENTS_DIR)
const commandFiles = listMd(COMMANDS_DIR)
let skillDirs = []
try {
  skillDirs = fs.readdirSync(SKILLS_DIR)
    .filter(d => fs.statSync(path.join(SKILLS_DIR, d)).isDirectory())
} catch { skillDirs = [] }

const corpus = [
  ROUTE, ROUTER, AGENTS_INDEX, SKILLS_INDEX, COMMANDS_DOC,
  ...commandFiles.map(c => path.join(COMMANDS_DIR, c + '.md')),
  ...agentFiles.map(a => path.join(AGENTS_DIR, a + '.md')),
].map(read).join('\n')

// W1 — every command reaches a real agent
check('W1', 'commands -> agent resuelve', () => {
  const bad = []
  for (const c of commandFiles) {
    const a = (fm(read(path.join(COMMANDS_DIR, c + '.md'))).match(/^agent:\s*([^\s\r\n]+)/m) || [])[1]
    if (!a) continue // no agent: declared -> validate-frontmatter warns already
    const name = a.replace(/[`'"]/g, '')
    if (BUILTIN.includes(name)) continue
    if (!exists(path.join(AGENTS_DIR, name + '.md'))) bad.push('/' + c + ' -> ' + name)
  }
  return { ok: bad.length === 0, detail: bad.length ? bad.join(', ') : commandFiles.length + ' comandos' }
})

// W2 — every agent is reachable from a dispatch surface
check('W2', 'agents alcanzables', () => {
  const surfaces = [read(ROUTE), read(ROUTER), read(COMMANDS_DOC),
    ...commandFiles.map(c => read(path.join(COMMANDS_DIR, c + '.md')))].join('\n')
  const orphan = agentFiles.filter(a => {
    if (surfaces.includes(a)) return false
    // indirect: some OTHER agent file points at it
    const indirect = agentFiles.some(o => o !== a && read(path.join(AGENTS_DIR, o + '.md')).includes(a))
    return !indirect
  })
  return { ok: orphan.length === 0, detail: orphan.length ? orphan.join(', ') : agentFiles.length + ' agents' }
})

// W3 — every skill is reachable
check('W3', 'skills alcanzables', () => {
  const s = [read(ROUTE), read(ROUTER), read(AGENTS_INDEX), read(SKILLS_INDEX),
    read(COMMANDS_DOC), corpus].join('\n')
  const orphan = skillDirs.filter(d => !s.includes(d))
  return { ok: orphan.length === 0, detail: orphan.length ? orphan.join(', ') : skillDirs.length + ' skills' }
})

// W4 — skill identity: name: matches dir, unique
check('W4', 'skill name unico y coincide con el dir', () => {
  const seen = new Map()
  const bad = []
  for (const d of skillDirs) {
    const t = read(path.join(SKILLS_DIR, d, 'SKILL.md'))
    const n = (fm(t).match(/^name:\s*([^\s\r\n]+)/m) || [])[1]
    if (!n) { bad.push(d + ' (sin name:)'); continue }
    if (n !== d) bad.push(d + ' (name: ' + n + ')')
    if (seen.has(n)) bad.push(n + ' duplicado en ' + seen.get(n) + ' y ' + d)
    seen.set(n, d)
  }
  return { ok: bad.length === 0, detail: bad.length ? bad.join(' | ') : skillDirs.length + ' skills' }
})

// W5 — skill has an activation signal
check('W5', 'skill con triggers o description', () => {
  const bad = skillDirs.filter(d => {
    const f = fm(read(path.join(SKILLS_DIR, d, 'SKILL.md')))
    return !/^triggers:/m.test(f) && !/^description:/m.test(f)
  })
  return { ok: bad.length === 0, detail: bad.length ? bad.join(', ') : skillDirs.length + ' skills' }
})

// W6 — skill dir actually has SKILL.md
check('W6', 'dir de skill con SKILL.md', () => {
  const bad = skillDirs.filter(d => !exists(path.join(SKILLS_DIR, d, 'SKILL.md')))
  return { ok: bad.length === 0, detail: bad.length ? bad.join(', ') : skillDirs.length + ' dirs' }
})

// W7 — command has a description and a body
check('W7', 'command con description y cuerpo', () => {
  const bad = []
  for (const c of commandFiles) {
    const t = read(path.join(COMMANDS_DIR, c + '.md'))
    const front = fm(t)
    const rest = body(t).trim()
    if (!/^description:/m.test(front)) bad.push('/' + c + ' (sin description)')
    else if (rest.length < 20) bad.push('/' + c + ' (cuerpo ' + rest.length + ' B)')
  }
  return { ok: bad.length === 0, detail: bad.length ? bad.join(', ') : commandFiles.length + ' comandos' }
})

// W8 — agent declares its permission block (least privilege is opt-out here)
check('W8', 'agent con bloque permission', () => {
  const bad = agentFiles.filter(a => !/^permission:/m.test(fm(read(path.join(AGENTS_DIR, a + '.md')))))
  return { ok: bad.length === 0, detail: bad.length ? bad.join(', ') : agentFiles.length + ' agents' }
})

// ---------------------------------------------------------------------------
if (asJson) {
  console.log(JSON.stringify({
    counts: { agents: agentFiles.length, commands: commandFiles.length, skills: skillDirs.length },
    passed: results.filter(r => r.ok).length,
    failed: failures,
    results,
  }, null, 2))
} else {
  console.log('wiring-test: ' + agentFiles.length + ' agents | ' + commandFiles.length +
    ' commands | ' + skillDirs.length + ' skills')
  console.log('')
  for (const r of results) {
    console.log('  ' + (r.ok ? 'ok  ' : 'FAIL') + '  ' + r.id + ' ' + r.label.padEnd(38) + ' ' + r.detail)
  }
  console.log('')
  console.log('===============================')
  console.log('  PASSED:   ' + results.filter(r => r.ok).length)
  console.log('  FAILED:   ' + failures)
  console.log('===============================')
  console.log(failures === 0 ? '  WIRING OK' : '  WIRING BROKEN')
}

process.exit(failures === 0 ? 0 : 1)
