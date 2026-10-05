#!/usr/bin/env node
/**
 * state.js - flow state persistence for resumable commands
 *
 * Writes/updates docs/state/{command}-{timestamp}.json so long-running
 * commands (orchestrate, plan, flow-*) can be resumed after interruption.
 *
 * Usage:
 *   node .opencode/bin/state.js init <command> <user-request> [<prd-path>]
 *   node .opencode/bin/state.js update <state-file> <phase> <context-json>
 *   node .opencode/bin/state.js complete <state-file>
 *   node .opencode/bin/state.js fail <state-file> <error-message>
 *   node .opencode/bin/state.js list                    # list active states
 *   node .opencode/bin/state.js archive <state-file>     # move to _archive/
 *
 * Zero deps, CommonJS, Windows + POSIX.
 */

const fs = require('fs');
const path = require('path');

const STATE_DIR = path.join(process.cwd(), 'docs', 'state');
const ARCHIVE_DIR = path.join(STATE_DIR, '_archive');

function ensureDirs() {
  if (!fs.existsSync(STATE_DIR)) fs.mkdirSync(STATE_DIR, { recursive: true });
  if (!fs.existsSync(ARCHIVE_DIR)) fs.mkdirSync(ARCHIVE_DIR, { recursive: true });
}

function nowIso() { return new Date().toISOString(); }

function readState(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function writeState(file, state) {
  fs.writeFileSync(file, JSON.stringify(state, null, 2), 'utf8');
}

function init(command, userRequest, prdPath, dryRun) {
  ensureDirs();
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const file = path.join(STATE_DIR, `${command}-${stamp}.json`);
  const state = {
    command,
    started: nowIso(),
    prd: prdPath || null,
    currentPhase: 0,
    completed: [],
    context: {
      userRequest: userRequest || '',
      agentsInvoked: [],
      filesModified: [],
    },
    error: null,
  };
  if (dryRun) {
    process.stdout.write(`[dry-run] would create: ${file}\n`);
    process.stdout.write(`[dry-run] initial state:\n`);
    process.stdout.write(JSON.stringify(state, null, 2) + '\n');
    return;
  }
  writeState(file, state);
  process.stdout.write(file + '\n');
}

function update(file, phase, contextJson, dryRun) {
  const resolved = resolveStatePath(file);
  if (!resolved) {
    process.stderr.write(`state file not found: ${file}\n`);
    process.stderr.write(`hint: pass the full path from 'state.js init' or just the basename\n`);
    process.exit(1);
  }
  // <phase> must be an integer. Non-numeric input used to sail through
  // parseInt() and get stored as null in the JSON - a silent corruption
  // that later made session-start resume from null. Fail loudly instead.
  const phaseRaw = String(phase === undefined || phase === null ? '' : phase).trim();
  const phaseNum = Number(phaseRaw);
  if (phaseRaw === '' || !Number.isInteger(phaseNum)) {
    process.stderr.write(`invalid phase: ${phaseRaw}\n`);
    process.stderr.write(`hint: <phase> must be an integer (1, 2, 3...); keep the readable name in the context JSON as "phase"\n`);
    process.exit(1);
  }

  const state = readState(resolved);
  const before = JSON.parse(JSON.stringify(state));
  state.currentPhase = phaseNum;
  if (!state.completed.includes(state.currentPhase)) {
    state.completed.push(state.currentPhase);
  }
  if (contextJson) {
    try {
      const ctx = parseContext(contextJson);
      state.context = { ...state.context, ...ctx };
    } catch (e) {
      process.stderr.write(`invalid context: ${e.message}\n`);
      process.stderr.write(`hint: write JSON to a file and pass via --context-file <path>\n`);
      process.exit(1);
    }
  }
  if (dryRun) {
    process.stdout.write(`[dry-run] would update: ${resolved}\n`);
    process.stdout.write(`[dry-run] before: phase=${before.currentPhase} completed=[${before.completed.join(',')}]\n`);
    process.stdout.write(`[dry-run] after:  phase=${state.currentPhase} completed=[${state.completed.join(',')}]\n`);
    return;
  }
  writeState(resolved, state);
  process.stdout.write(`updated: phase=${state.currentPhase} completed=[${state.completed.join(',')}]\n`);
}

// Parse a context value: accepts inline JSON, a @filepath, or auto-strip shell quoting.
function parseContext(input) {
  if (typeof input !== 'string') throw new Error('context must be a string');
  const trimmed = input.trim();
  if (trimmed.startsWith('@')) {
    const p = trimmed.slice(1);
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  }
  let cleaned = trimmed;
  while ((cleaned.startsWith('"') && cleaned.endsWith('"')) ||
         (cleaned.startsWith("'") && cleaned.endsWith("'"))) {
    cleaned = cleaned.slice(1, -1);
  }
  return JSON.parse(cleaned);
}

function complete(file) {
  const resolved = resolveStatePath(file);
  if (!resolved) {
    process.stderr.write(`state file not found: ${file}\n`);
    process.exit(1);
  }
  fs.unlinkSync(resolved);
  process.stdout.write(`completed: ${resolved} removed\n`);
}

function fail(file, errorMessage) {
  const resolved = resolveStatePath(file);
  if (!resolved) {
    process.stderr.write(`state file not found: ${file}\n`);
    process.exit(1);
  }
  const state = readState(resolved);
  state.error = errorMessage;
  state.failedAt = nowIso();
  writeState(resolved, state);
  process.stderr.write(`failed: ${errorMessage}\n`);
  process.exit(1);
}

function list() {
  ensureDirs();
  const files = fs.readdirSync(STATE_DIR).filter(f => f.endsWith('.json'));
  if (files.length === 0) {
    process.stdout.write('(no active states)\n');
    return;
  }
  for (const f of files) {
    const state = readState(path.join(STATE_DIR, f));
    const err = state.error ? ` ERROR: ${state.error}` : '';
    process.stdout.write(`${f}\n  command=${state.command} phase=${state.currentPhase} completed=[${state.completed.join(',')}]${err}\n`);
  }
}

function archive(file) {
  const resolved = resolveStatePath(file);
  if (!resolved) {
    process.stderr.write(`state file not found: ${file}\n`);
    process.exit(1);
  }
  ensureDirs();
  const base = path.basename(resolved);
  const dest = path.join(ARCHIVE_DIR, base);
  fs.renameSync(resolved, dest);
  process.stdout.write(`archived: ${dest}\n`);
}

// Resolve a file argument: try as-is first, then as basename in STATE_DIR.
// Lets users pass either a full path (from `init` output) or just the basename
// (from `list` output). Returns null if neither resolves.
function resolveStatePath(file) {
  if (!file) return null;
  if (fs.existsSync(file)) return file;
  const guess = path.join(STATE_DIR, path.basename(file));
  if (fs.existsSync(guess)) return guess;
  return null;
}

// Parse argv: separate flags (--dry-run, --help, -h) from positionals (sub + args).
// Flags can appear anywhere; positionals are order-sensitive after the subcommand.
const rawArgv = process.argv.slice(2);
const flags = new Set();
const positional = [];
for (const a of rawArgv) {
  if (a.startsWith('--') || a === '-h') flags.add(a);
  else positional.push(a);
}

// Standalone --help / -h: show help and exit before sub dispatch.
if (flags.has('--help') || flags.has('-h')) {
  positional.unshift('help');
}

const dryRun = flags.has('--dry-run');
const sub = positional[0];
const args = positional.slice(1);

function showHelp() {
  process.stdout.write(`state.js - flow state persistence

Usage:
  state.js init <command> <user-request> [<prd-path>] [--dry-run]
  state.js update <state-file> <phase> <context> [--dry-run]
  state.js complete <state-file>
  state.js fail <state-file> <error-message>
  state.js list
  state.js archive <state-file>
  state.js --help

Flags:
  --dry-run    for init/update: show what would change, do not write

Context can be:
  - inline JSON: '{"agentsInvoked":["x"]}'
  - @filepath:   @/tmp/context.json
  - quoted JSON: state.js will strip surrounding shell quotes

State file resolution:
  - Full path (from 'init' output)  -- preferred
  - Basename (from 'list' output)  -- resolved against STATE_DIR

Examples:
  state.js init orchestrate "build feature" docs/prds/foo.prd.md
  state.js init plan "design X" --dry-run
  state.js update $FILE 1 '{"agentsInvoked":["prd-agent"]}'
  state.js update $(ls docs/state/ | head -1) 2 @/tmp/c.json --dry-run
  echo '{"agentsInvoked":["x"]}' > /tmp/c.json
  state.js update $FILE 1 @/tmp/c.json
`);
}

switch (sub) {
  case 'help':
    showHelp();
    process.exit(0);
    break;
  case 'init':
    init(args[0], args[1], args[2], dryRun);
    break;
  case 'update':
    update(args[0], args[1], args.slice(2).join(' '), dryRun);
    break;
  case 'complete':
    complete(args[0]);
    break;
  case 'fail':
    fail(args[0], args.slice(1).join(' '));
    break;
  case 'list':
    list();
    break;
  case 'archive':
    archive(args[0]);
    break;
  default:
    process.stderr.write('Usage: state.js {init|update|complete|fail|list|archive|--help} ...\n');
    process.exit(2);
}
