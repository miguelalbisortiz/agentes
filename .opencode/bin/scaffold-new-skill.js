#!/usr/bin/env node
/**
 * scaffold-new-skill.js - create .agents/skills/<name>/SKILL.md with frontmatter
 *
 * Use when contributing a new skill to the pack. Validates the name
 * (lowercase, hyphens, no dots), refuses to overwrite, and produces
 * a SKILL.md with the correct frontmatter + body template.
 *
 * Usage:
 *   node .opencode/bin/scaffold-new-skill.js <name>
 *   node .opencode/bin/scaffold-new-skill.js my-skill --triggers "foo,bar,baz"
 *   node .opencode/bin/scaffold-new-skill.js my-skill --force
 *   node .opencode/bin/scaffold-new-skill.js my-skill --dry-run
 *   node .opencode/bin/scaffold-new-skill.js --help
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

const NAME = ARGS.find(a => !a.startsWith('--') && a !== ARGS[0] || (a === ARGS[0] && !a.startsWith('--')));
// Simpler: first non-flag arg
const POSITIONAL = ARGS.filter(a => !a.startsWith('--') && a !== HELP && !HELP);
const SKILL_NAME = POSITIONAL[0];

function arg(name, def) {
  const i = ARGS.indexOf(name);
  if (i === -1) return def;
  return ARGS[i + 1];
}

const TRIGGERS_STR = arg('--triggers', '');
const DESCRIPTION = arg('--description', 'Use when <describe what this skill covers and the situations that should trigger it>.');

if (HELP || !SKILL_NAME) {
  console.log(`Usage: node .opencode/bin/scaffold-new-skill.js <name> [--triggers "t1,t2,t3"] [--description "..."] [--force] [--dry-run]

Creates .agents/skills/<name>/SKILL.md with proper frontmatter.

Name rules:
  - lowercase letters, digits, hyphens
  - must start with a letter
  - no dots, no underscores, no spaces

Options:
  --triggers "t1,t2"   Comma-separated trigger keywords
  --description "..."  Description line (default: "> ")
  --force              Overwrite existing skill
  --dry-run            Show what would be created, don't write
  --help               This help
`);
  process.exit(SKILL_NAME ? 0 : 1);
}

if (!/^[a-z][a-z0-9-]*$/.test(SKILL_NAME)) {
  console.error(`Invalid name: ${SKILL_NAME}`);
  console.error(`  Must match /^[a-z][a-z0-9-]*$/`);
  process.exit(1);
}

const TRIGGERS = TRIGGERS_STR
  ? TRIGGERS_STR.split(',').map(s => s.trim()).filter(Boolean)
  : [];

const SKILLS_DIR = path.join(CWD, '.agents', 'skills');
const SKILL_DIR = path.join(SKILLS_DIR, SKILL_NAME);
const SKILL_FILE = path.join(SKILL_DIR, 'SKILL.md');

const FRONTMATTER = `---
name: ${SKILL_NAME}
description: >
  ${DESCRIPTION}
  ${TRIGGERS.length > 0 ? `Triggers on: ${TRIGGERS.join(', ')}.` : 'TODO: add 1-1024 char description in third person, "Use when...".'}
${TRIGGERS.length > 0 ? `triggers: [${TRIGGERS.map(t => `"${t}"`).join(', ')}]\n` : ''}---`;

const BODY = `
# ${SKILL_NAME}

> Scaffolded by \`.opencode/bin/scaffold-new-skill.js\` on ${new Date().toISOString().slice(0, 10)}.
> Edit freely. The frontmatter above is consumed by opencode at boot.

## When to Activate

TODO: describe the trigger conditions. When does the primary agent load this skill?

## Core Principle

TODO: one-paragraph thesis for this skill.

## Workflow

TODO: step-by-step process. Use \`### Step N — <name>\` headings.

## Output Format

TODO: what does the agent produce when following this skill? Template, sections, or examples.

## Rules

- TODO: hard rules
- TODO: hard rules

## Anti-Patterns

- TODO: what NOT to do

## Integration

- Related skills: \`other-skill\`, \`another-skill\`
- Related agents: \`some-agent\`
- Related commands: \`/some-command\`

## Quick Example

TODO: minimal worked example.
`;

const CONTENT = FRONTMATTER + BODY;

function exists(p) {
  try { fs.accessSync(p); return true; } catch { return false; }
}

if (exists(SKILL_FILE) && !FORCE) {
  console.error(`Already exists: ${path.relative(CWD, SKILL_FILE)}`);
  console.error(`  Use --force to overwrite.`);
  process.exit(1);
}

if (DRY_RUN) {
  console.log(`Would create: ${path.relative(CWD, SKILL_FILE)} (${CONTENT.split('\n').length} lines)`);
  process.exit(0);
}

fs.mkdirSync(SKILL_DIR, { recursive: true });
fs.writeFileSync(SKILL_FILE, CONTENT, 'utf8');
// Crear el skill desfasa el ## Counts de los README (cuenta ficheros).
// Refresca TODOS los ficheros con marcadores, igual que hace el scaffolder
// de agents: una lista fija dejaba stale cualquier otro (p. ej. README.md raiz).
try {
  const { compute, renderMarkdown, updateFile, findCountFiles, ROOT } = require('./counts.js');
  const block = renderMarkdown(compute());
  for (const p of findCountFiles(ROOT)) updateFile(p, block);
} catch { /* counts es best-effort */ }
console.log(`Created: ${path.relative(CWD, SKILL_FILE)} (${CONTENT.split('\n').length} lines)`);
console.log(`\nNext:`);
console.log(`  1. Edit the description and triggers in the frontmatter`);
console.log(`  2. Replace the TODO sections`);
console.log(`  3. Run \`node .opencode/bin/build-skills-index.js\` to refresh .agents/skills/INDEX.md`);
console.log(`  4. Run \`node .opencode/bin/validate-frontmatter.js\` to check the frontmatter`);
