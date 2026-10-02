#!/usr/bin/env node
/**
 * smoke-test.js - verify the starter pack is healthy
 *
 * Checks:
 *   - structure (required files and folders)
 *   - counts (agents, skills, commands, bin scripts)
 *   - junctions (agent, skill — backwards compat for opencode 1.17.x)
 *   - bin scripts (instinct.js, context.js, prd not needed)
 *   - frontmatter (every agent/command has description, every skill has name)
 *
 * Usage:
 *   node .opencode/bin/smoke-test.js          # full check
 *   node .opencode/bin/smoke-test.js --quiet  # only show failures
 *
 * Exit codes:
 *   0 = all passed
 *   1 = at least one FAIL
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const CWD = process.cwd();
const QUIET = process.argv.includes('--quiet');

let passed = 0, failed = 0, warnings = 0;

function check(name, fn) {
  try {
    const result = fn();
    if (result === false) {
      if (!QUIET) console.log(`  FAIL  ${name}`);
      failed++;
    } else if (typeof result === 'object' && result.warn) {
      if (!QUIET) console.log(`  WARN  ${name}: ${result.warn}`);
      warnings++;
    } else {
      if (!QUIET) console.log(`  ok    ${name}`);
      passed++;
    }
  } catch (e) {
    if (!QUIET) console.log(`  FAIL  ${name}: ${e.message}`);
    failed++;
  }
}

function countFiles(dir, ext) {
  if (!fs.existsSync(dir)) return 0;
  return fs.readdirSync(dir).filter(f => f.endsWith(ext) && f !== 'INDEX.md').length;
}

function isJunction(p) {
  if (!fs.existsSync(p)) return false;
  try {
    const lst = fs.lstatSync(p);
    if (lst.isSymbolicLink()) return true;
    if (process.platform === 'win32' && lst.isDirectory()) {
      // NTFS junctions and symlinks both report isSymbolicLink() === true in modern Node
      return lst.isSymbolicLink();
    }
  } catch {}
  return false;
}

function readFile(p) {
  try { return fs.readFileSync(p, 'utf8'); } catch { return ''; }
}

function hasFrontmatter(dir, key) {
  if (!fs.existsSync(dir)) return false;
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.md') && f !== 'INDEX.md');
  return files.every(f => readFile(path.join(dir, f)).match(new RegExp(`^${key}:`, 'm')));
}

function testScript(p, args = '') {
  try {
    const out = execSync(`node "${p}" ${args}`, { encoding: 'utf8', stdio: 'pipe' });
    return out.length > 0;
  } catch {
    return false;
  }
}

console.log('Starter Pack Smoke Test');
console.log('=======================');
console.log('');

console.log('[Structure]');
check('opencode.json exists', () => fs.existsSync('opencode.json'));
check('.opencode/AGENTS.md exists', () => fs.existsSync('.opencode/AGENTS.md'));
check('.opencode/manual/README.md exists', () => fs.existsSync('.opencode/manual/README.md'));
check('.opencode/README.md exists', () => fs.existsSync('.opencode/README.md'));
check('.opencode/CHANGELOG.md exists', () => fs.existsSync('.opencode/CHANGELOG.md'));
check('.opencode/ folder', () => fs.existsSync('.opencode'));
check('.agents/ folder', () => fs.existsSync('.agents'));

console.log('');
console.log('[Counts]');
const agents = countFiles('.opencode/agents', '.md');
const skills = fs.existsSync('.agents/skills') ? fs.readdirSync('.agents/skills').filter(d => {
  try { return fs.statSync(path.join('.agents/skills', d)).isDirectory(); } catch { return false; }
}).length : 0;
const commands = countFiles('.opencode/commands', '.md');
const binScripts = countFiles('.opencode/bin', '.js');

// Instalaciones filtradas por stack (-Stack flutter|node|...) traen menos agents
// que el pack maestro. `.opencode/.stack` lo marca (lo escribe init-opencode.ps1).
const stackMarker = (() => {
  try { return fs.readFileSync('.opencode/.stack', 'utf8').trim(); } catch { return null; }
})();
const minAgents = stackMarker ? 45 : 64;
const scope = stackMarker ? `stack=${stackMarker}` : 'full pack';

check(`agents (got ${agents}, min ${minAgents} for ${scope})`, () => agents >= minAgents);
check(`skills (got ${skills}, expected 10+)`, () => skills >= 10);
check(`commands (got ${commands}, expected 47+)`, () => commands >= 47);
check(`bin scripts (got ${binScripts}, expected 2+)`, () => binScripts >= 2);

console.log('');
console.log('[Junctions (opencode 1.17.x backwards compat)]');
const agentJunction = isJunction('.opencode/agent');
const skillJunction = isJunction('.opencode/skill');
check('.opencode/agent is a junction/symlink', () => agentJunction);
check('.opencode/skill is a junction/symlink', () => skillJunction);

console.log('');
console.log('[Bin scripts]');
check('instinct.js runs (help command)', () => testScript('.opencode/bin/instinct.js', 'help'));
check('context.js runs (--skills)', () => testScript('.opencode/bin/context.js', '--skills'));
check('smoke-test.js itself runs', () => true);

console.log('');
console.log('[Frontmatter]');
check('agents have description:', () => hasFrontmatter('.opencode/agents', 'description'));
check('commands have description:', () => hasFrontmatter('.opencode/commands', 'description'));
check('SKILL.md files have name:', () => {
  if (!fs.existsSync('.agents/skills')) return { warn: '.agents/skills missing' };
  const dirs = fs.readdirSync('.agents/skills').filter(d => {
    try { return fs.statSync(path.join('.agents/skills', d)).isDirectory(); } catch { return false; }
  });
  return dirs.every(d => {
    const skill = path.join('.agents/skills', d, 'SKILL.md');
    if (!fs.existsSync(skill)) return { warn: `${d}/SKILL.md missing` };
    return readFile(skill).match(/^name:/m);
  });
});

check('validate-frontmatter.js runs', () => testScript('.opencode/bin/validate-frontmatter.js', '--quiet'));

console.log('');
console.log('[No broken paths in pack]');
function findBrokenRefs() {
  if (!fs.existsSync('.opencode')) return [];
  const knownSkills = ['api-design', 'backend-patterns', 'coding-standards', 'documentation-lookup', 'error-handling', 'frontend-patterns', 'git-workflow', 'intent-driven-development', 'mcp-server-patterns', 'security-review', 'task-decomposition', 'tdd-workflow', 'verification-loop', 'caveman'];
  const broken = [];
  const files = require('child_process').execSync(
    `powershell -NoProfile -Command "Get-ChildItem -Path .opencode -Recurse -File -Force | Where-Object { $_.FullName -notmatch 'node_modules' } | Select-Object -ExpandProperty FullName"`,
    { encoding: 'utf8', stdio: 'pipe' }
  ).split('\n').filter(Boolean);
  for (const f of files) {
    const c = readFile(f);
    const matches = c.match(/skills\/([\w-]+)\//g);
    if (matches) {
      for (const m of matches) {
        const name = m.replace('skills/', '').replace('/', '');
        if (!knownSkills.includes(name)) broken.push(`${path.basename(f)}: skills/${name}/`);
      }
    }
    if (c.match(/rules\//)) broken.push(`${path.basename(f)}: rules/`);
    if (c.match(/CLAUDE_PLUGIN_ROOT/)) broken.push(`${path.basename(f)}: CLAUDE_PLUGIN_ROOT`);
  }
  return broken;
}
try {
  const broken = findBrokenRefs();
  check('no broken skill/rules/CLAUDE_PLUGIN refs in .opencode', () => broken.length === 0);
  if (broken.length > 0 && !QUIET) {
    console.log('');
    console.log('  Broken refs found:');
    for (const b of broken) console.log(`    - ${b}`);
  }
} catch (e) {
  if (!QUIET) console.log(`  SKIP  broken-refs check (powershell not available): ${e.message}`);
}

console.log('');
console.log('=======================');
console.log(`PASSED:   ${passed}`);
console.log(`WARNINGS: ${warnings}`);
console.log(`FAILED:   ${failed}`);
console.log('=======================');

if (failed > 0) {
  console.log('');
  console.log('SMOKE TEST FAILED — see issues above');
  process.exit(1);
} else if (warnings > 0) {
  console.log('');
  console.log('SMOKE TEST PASSED (with warnings — non-blocking)');
  process.exit(0);
} else {
  console.log('');
  console.log('SMOKE TEST PASSED');
  process.exit(0);
}
