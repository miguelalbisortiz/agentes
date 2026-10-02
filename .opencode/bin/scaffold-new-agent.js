#!/usr/bin/env node
/**
 * scaffold-new-agent.js - create .opencode/agents/<name>.md with frontmatter + permission
 *
 * Use when contributing a new agent to the pack. Validates the name,
 * refuses to overwrite, and produces an agent .md with the canonical
 * frontmatter (description, mode, permission) + prompt-defense
 * reference + body template.
 *
 * Usage:
 *   node .opencode/bin/scaffold-new-agent.js <name>
 *   node .opencode/bin/scaffold-new-agent.js my-agent --mode subagent
 *   node .opencode/bin/scaffold-new-agent.js my-agent --force
 *   node .opencode/bin/scaffold-new-agent.js my-agent --dry-run
 *   node .opencode/bin/scaffold-new-agent.js --help
 *
 * Zero deps, CommonJS, Windows + POSIX.
 */

const fs = require('fs');
const path = require('path');

const CWD = process.cwd();
const ARGS = process.argv.slice(2);
const HELP = ARGS.includes('--help') || ARGS.includes('-h');
const DRY_RUN = ARGS.includes('--dry-run');
const FORCE = ARGS.includes('--force');

const POSITIONAL = ARGS.filter(a => !a.startsWith('--') && a !== HELP && !HELP);
const AGENT_NAME = POSITIONAL[0];

function arg(name, def) {
  const i = ARGS.indexOf(name);
  if (i === -1) return def;
  return ARGS[i + 1];
}

const MODE = arg('--mode', 'subagent');
const PERMISSION = arg('--permission', 'bash: allow, read: allow, write: allow, edit: allow, glob: allow, grep: allow, webfetch: allow, task: allow, skill: allow');
const DESCRIPTION = arg('--description', 'Use when <describe the request patterns that should route to this agent>.');

if (HELP || !AGENT_NAME) {
  console.log(`Usage: node .opencode/bin/scaffold-new-agent.js <name> [--mode MODE] [--permission "..."] [--force] [--dry-run]

Creates .opencode/agents/<name>.md with proper frontmatter + permission block.

Name rules:
  - lowercase letters, digits, hyphens
  - must start with a letter
  - no dots, no underscores, no spaces
  - examples: react-reviewer, code-architect, prd-agent

Options:
  --mode MODE              subagent (default) or primary
  --permission "..."       permission block (default: all allow)
  --description "..."      Description line (default: "> ")
  --force                  Overwrite existing agent
  --dry-run                Show what would be created, don't write
  --help                   This help
`);
  process.exit(AGENT_NAME ? 0 : 1);
}

if (!/^[a-z][a-z0-9-]*$/.test(AGENT_NAME)) {
  console.error(`Invalid name: ${AGENT_NAME}`);
  console.error(`  Must match /^[a-z][a-z0-9-]*$/`);
  process.exit(1);
}

if (!['subagent', 'primary'].includes(MODE)) {
  console.error(`Invalid --mode: ${MODE} (must be 'subagent' or 'primary')`);
  process.exit(1);
}

const AGENTS_DIR = path.join(CWD, '.opencode', 'agents');
const AGENT_FILE = path.join(AGENTS_DIR, `${AGENT_NAME}.md`);

// Escalar plegado con contenido indentado: `description: >` SIN lineas
// indentadas se parsea como cadena vacia y validate-frontmatter lo reporta
// como "missing required field: description". El default anterior era literal
// `> `, o sea exactamente eso.
const FRONTMATTER = `---
description: >
  ${DESCRIPTION}
mode: ${MODE}
permission:
  ${PERMISSION.split(',').map(p => p.trim()).join('\n  ')}
---`;

const BODY = `<!-- Prompt Defense Baseline: see INSTRUCTIONS.md § Prompt Defense Baseline (GLOBAL) -->

# \`${AGENT_NAME}\`

> Scaffolded by \`.opencode/bin/scaffold-new-agent.js\` on ${new Date().toISOString().slice(0, 10)}.
> Edit freely. The frontmatter above is consumed by opencode at boot.

## When to Invoke

TODO: describe the trigger conditions. What user request patterns should route to this agent?

## What It Does

TODO: 1-3 sentences on the agent's purpose.

## Workflow

1. TODO: step 1
2. TODO: step 2
3. TODO: step 3

## Output

TODO: what does this agent produce? Report, file, PR, code review?

## Anti-Patterns

- TODO: what NOT to invoke this agent for

## Pairing

- Related skills: \`some-skill\`
- Related agents: \`other-agent\`
- Related commands: \`/some-command\`
`;

const CONTENT = FRONTMATTER + '\n' + BODY;

function exists(p) {
  try { fs.accessSync(p); return true; } catch { return false; }
}

if (exists(AGENT_FILE) && !FORCE) {
  console.error(`Already exists: ${path.relative(CWD, AGENT_FILE)}`);
  console.error(`  Use --force to overwrite.`);
  process.exit(1);
}

if (DRY_RUN) {
  console.log(`Would create: ${path.relative(CWD, AGENT_FILE)} (${CONTENT.split('\n').length} lines)`);
  process.exit(0);
}

fs.writeFileSync(AGENT_FILE, CONTENT, 'utf8');
// Crear el agente desfasa el ## Counts de los README (cuenta ficheros).
// Best-effort: si falla no debe romper el scaffolder.
try {
  const { compute, renderMarkdown, updateFile } = require('./counts.js');
  const block = renderMarkdown(compute());
  for (const p of [
    path.join(__dirname, '..', 'README.md'),
    path.join(__dirname, '..', 'manual', 'README.md'),
  ]) { if (fs.existsSync(p)) updateFile(p, block); }
} catch (e) { console.error(`[warn] no pude refrescar ## Counts: ${e.message}`); }
console.log(`Created: ${path.relative(CWD, AGENT_FILE)} (${CONTENT.split('\n').length} lines)`);
console.log(`\nNext:`);
console.log(`  1. Edit the description (this drives the router skill matching)`);
console.log(`  2. Replace the TODO sections with the agent's actual workflow`);
console.log(`  3. Run \`node .opencode/bin/validate-frontmatter.js\` to check the frontmatter`);
console.log(`  4. Run \`node .opencode/bin/build-agents-index.js\` to refresh .opencode/AGENTS_INDEX.md`);
