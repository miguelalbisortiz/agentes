#!/usr/bin/env node
/**
 * installer-test.js - verifies init-opencode.js breaks nothing
 *
 * WHY THIS EXISTS
 *   init-opencode.js is a full port of init-opencode.ps1 and rewrote every
 *   copy path of the installer. The risks are the ones the PowerShell suite
 *   was written for, so this file is a faithful port of installer-test.ps1:
 *   same 7 scenarios, same 48 checks, same messages - but running the Node
 *   installer, from Node, with zero dependencies.
 *
 * Scenarios:
 *   T1  clean install (stack filter) -> smoke + 0 orphans + pruned skills
 *       and pruned skill router
 *   T2  conservative merge -> does NOT overwrite .gitignore / opencode.json
 *   T3  idempotency -> 2nd run changes nothing, no nesting
 *   T4  --all-agents -> full library, no .stack marker
 *   T5  bad --pack-path -> fails cleanly, installs nothing half-way
 *   T6  node stack keeps JS/TS skills
 *   T7  scaffolders produce valid frontmatter and refresh ## Counts
 *
 * Scratch projects live under os.tmpdir() (never inside the repo) and are
 * removed when the run ends. The installer is invoked as
 *   child_process.execFileSync(process.execPath, [...])
 * so this suite works anywhere Node runs.
 *
 * Usage:
 *   node .opencode/bin/installer-test.js           # full report
 *   node .opencode/bin/installer-test.js --json    # machine readable
 *   node .opencode/bin/installer-test.js --quiet   # summary only
 *
 * Exit codes:
 *   0 = all checks passed
 *   1 = at least one check failed (or init-opencode.js is missing)
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const PACK = path.resolve(__dirname, '..', '..');
const INIT = path.join(PACK, 'init-opencode.js');
const WORK = path.join(os.tmpdir(), 'opencode', 'installer-test');

const AS_JSON = process.argv.includes('--json');
const QUIET = process.argv.includes('--quiet');

const results = [];
let pass = 0;
let fail = 0;
let scenario = '';

function ok(msg) {
  results.push({ scenario, msg, ok: true });
  pass++;
  if (!QUIET && !AS_JSON) console.log('  PASS  ' + msg);
}

function bad(msg) {
  results.push({ scenario, msg, ok: false });
  fail++;
  if (!QUIET && !AS_JSON) console.log('  FAIL  ' + msg);
}

function head(msg) {
  scenario = msg;
  if (!QUIET && !AS_JSON) {
    console.log('');
    console.log('=== ' + msg + ' ===');
  }
}

// ---------------------------------------------------------------------------
// Helpers (ported from installer-test.ps1)
// ---------------------------------------------------------------------------

/** Fresh project dir; the marker file is written BEFORE init so that
 *  Detect-Stack sees the real stack of the project. */
function newProject(dir, marker = 'pubspec.yaml') {
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  if (marker) fs.writeFileSync(path.join(dir, marker), 'name: x\n');
  return dir;
}

function runInit(p, extraArgs = []) {
  try {
    execFileSync(process.execPath, [
      INIT, '--project-path', p, '--skip-install', '--skip-docs', '--force', ...extraArgs,
    ], { cwd: PACK, stdio: 'pipe', encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
  } catch (e) {
    throw new Error('init devolvio exit ' + e.status + (e.stdout ? '\n' + e.stdout : ''));
  }
}

function readFile(p) {
  try { return fs.readFileSync(p, 'utf8'); } catch { return ''; }
}

function listMd(dir) {
  try { return fs.readdirSync(dir).filter(f => f.endsWith('.md')); } catch { return []; }
}

function skillDirs(p) {
  const d = path.join(p, '.agents', 'skills');
  try { return fs.readdirSync(d, { withFileTypes: true }).filter(e => e.isDirectory()); } catch { return []; }
}

/** Commands whose frontmatter `agent:` points at a missing agent. */
function getOrphans(p) {
  const agents = new Set(listMd(path.join(p, '.opencode', 'agents')).map(f => f.replace(/\.md$/, '')));
  const bad = [];
  for (const f of listMd(path.join(p, '.opencode', 'commands'))) {
    const raw = readFile(path.join(p, '.opencode', 'commands', f));
    const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(raw);
    if (!m) continue;
    const a = /^\s*agent:\s*(\S+)/m.exec(m[1]);
    if (!a) continue;
    const name = a[1].trim();
    if (name === 'build') continue;
    if (!agents.has(name)) bad.push(f.replace(/\.md$/, '') + ' -> ' + name);
  }
  return bad;
}

function testSmoke(p) {
  let out = '';
  try {
    out = execFileSync(process.execPath, [path.join(p, '.opencode', 'bin', 'smoke-test.js')], {
      cwd: p, encoding: 'utf8', stdio: 'pipe', maxBuffer: 16 * 1024 * 1024,
    });
  } catch (e) {
    out = String(e.stdout || '') + String(e.stderr || '');
  }
  return out.indexOf('SMOKE TEST PASSED') !== -1;
}

function testCounts(p) {
  // counts.js --check solo es util si valida algo: exige que los bloques
  // ## Counts del proyecto coincidan con lo que realmente hay en disco.
  try {
    execFileSync(process.execPath, [path.join(p, '.opencode', 'bin', 'counts.js'), '--check'], {
      cwd: p, stdio: 'pipe', maxBuffer: 16 * 1024 * 1024,
    });
    return true;
  } catch {
    return false;
  }
}

/** Restos del bug de copiar <dir> contra <dir existente>. */
function getNesting(p) {
  return ['.opencode/.opencode', '.agents/.agents'].filter(n => fs.existsSync(path.join(p, n)));
}

function hashFile(p) {
  try { return require('crypto').createHash('sha256').update(fs.readFileSync(p)).digest('hex'); }
  catch { return 'missing'; }
}

/** Run a bin script of the INSTALLED project; returns its exit code. */
function runNodeIn(p, script, args = []) {
  try {
    execFileSync(process.execPath, [path.join(p, '.opencode', 'bin', script), ...args], {
      cwd: p, encoding: 'utf8', stdio: 'pipe', maxBuffer: 16 * 1024 * 1024,
    });
    return 0;
  } catch (e) {
    return e.status === null || e.status === undefined ? -1 : e.status;
  }
}

// ---------------------------------------------------------------------------
// Scenarios
// ---------------------------------------------------------------------------

function t1() {
  head('T1 - instalacion limpia con filtro de stack');
  const t1 = newProject(path.join(WORK, 't1-flutter'));
  runInit(t1);

  const ag = listMd(path.join(t1, '.opencode', 'agents')).length;
  // Igual que con skills: el 85/86 es el tamano del pack de hoy, no la
  // intencion. Lo que se prueba es que el filtro de stack DESCARTA agents.
  const packAg = listMd(path.join(PACK, '.opencode', 'agents')).length;
  if (ag > 0 && ag < packAg) ok('agents filtrados: ' + ag + ' (pack completo=' + packAg + ')');
  else bad('agents=' + ag + ', se esperaba un conteo filtrado (<' + packAg + ')');

  const cm = listMd(path.join(t1, '.opencode', 'commands')).length;
  if (cm > 0) ok('commands: ' + cm);
  else bad('no hay commands');

  const or = getOrphans(t1);
  if (or.length === 0) ok('0 comandos huerfanos');
  else bad('huerfanos: ' + or.join(', '));

  const stackFile = path.join(t1, '.opencode', '.stack');
  if (fs.existsSync(stackFile)) ok('marcador .stack = ' + readFile(stackFile).trim());
  else bad('falta .opencode/.stack');

  const sk = skillDirs(t1).length;
  // El pack crece; lo que hay que probar es que el filtro de stack DESCARTA
  // skills (las JS/TS en un proyecto flutter) y que el recuento sigue sano.
  const packSkills = skillDirs(PACK).length;
  if (sk >= 35 && sk < packSkills) ok('skills filtrados: ' + sk + ' (pack=' + packSkills + ')');
  else bad('skills=' + sk + ', se esperaba un conteo filtrado (<' + packSkills + ')');

  if (!fs.existsSync(path.join(t1, '.agents', 'skills', 'drizzle-patterns'))) ok('skill JS/TS descartado (drizzle-patterns)');
  else bad('drizzle-patterns no se descarto');

  if (fs.existsSync(path.join(t1, '.agents', 'skills', 'supabase-patterns'))) ok('skill multi-stack conservado (supabase-patterns)');
  else bad('se descarto un skill multi-stack');

  const r = readFile(path.join(t1, '.agents', 'skills', 'router', 'SKILL.md'));
  if (r.indexOf('`drizzle-patterns`') === -1) ok('fila del router podada con el skill');
  else bad('el router sigue apuntando a un skill borrado');

  if (r.indexOf('`supabase-patterns`') !== -1) ok('fila del router multi-stack intacta');
  else bad('se podo una fila que debia conservarse');

  const nest = getNesting(t1);
  if (nest.length === 0) ok('sin anidados residuales (.opencode/.opencode)');
  else bad('anidados: ' + nest.join(', '));

  const rd = readFile(path.join(t1, '.opencode', 'README.md'));
  if (rd.indexOf('**' + ag + '** agents') !== -1) ok('conteos del README regenerados (' + ag + ' agents)');
  else bad('el README sigue con los conteos del maestro');

  if (testCounts(t1)) ok('counts --check PASS');
  else bad('counts --check FAIL');

  if (testSmoke(t1)) ok('smoke-test PASSED');
  else bad('smoke-test FAILED');
}

function t2() {
  head('T2 - fusion conservadora (NO pisa archivos del proyecto)');
  const t2 = newProject(path.join(WORK, 't2-merge'));
  fs.writeFileSync(path.join(t2, '.gitignore'), '# PROYECTO\nbuild/\n.dart_tool/\nreportes/\n');
  const custom = {
    theme: 'mi-tema',
    model: 'mi-modelo',
    mcp: { 'mi-mcp': { type: 'local', command: ['npx', '-y', 'x@1'] } },
  };
  fs.writeFileSync(path.join(t2, 'opencode.json'), JSON.stringify(custom, null, 2) + '\n');

  runInit(t2);

  const g = readFile(path.join(t2, '.gitignore')).split(/\r?\n/);
  for (const need of ['build/', '.dart_tool/', 'reportes/']) {
    if (g.indexOf(need) !== -1) ok(".gitignore conserva '" + need + "'");
    else bad(".gitignore PERDIO '" + need + "'");
  }
  if (g.join('|').indexOf('.opencode/agent') !== -1) ok('.gitignore anade el bloque de junctions del pack');
  else bad('falta el bloque de junctions');

  const j = JSON.parse(readFile(path.join(t2, 'opencode.json')));
  if (j.theme === 'mi-tema') ok('opencode.json conserva theme propio');
  else bad('opencode.json PERDIO theme propio');
  if (j.model === 'mi-modelo') ok('opencode.json conserva model propio');
  else bad('opencode.json PERDIO model propio');
  if (j.mcp && j.mcp['mi-mcp']) ok('opencode.json conserva MCP propio');
  else bad('opencode.json PERDIO MCP propio');

  const packCfg = JSON.parse(readFile(path.join(PACK, 'opencode.json')));
  const packMcpNames = Object.keys(packCfg.mcp || {});
  const destMcpNames = Object.keys(j.mcp || {});
  const missingMcp = packMcpNames.filter(n => destMcpNames.indexOf(n) === -1);
  if (packMcpNames.length > 0 && missingMcp.length === 0) {
    ok('opencode.json anade los ' + packMcpNames.length + ' MCP(s) del pack: ' + packMcpNames.join(', '));
  } else {
    bad('faltan MCPs del pack (faltan: ' + missingMcp.join(', ') + ' / pack declara: ' + packMcpNames.join(', ') + ')');
  }
}

function t3() {
  head('T3 - idempotencia (2a corrida no cambia nada)');
  const t3 = newProject(path.join(WORK, 't3-idem'));
  runInit(t3);

  const h1g = hashFile(path.join(t3, '.gitignore'));
  const h1o = hashFile(path.join(t3, 'opencode.json'));
  const a1 = listMd(path.join(t3, '.opencode', 'agents')).length;

  runInit(t3);

  const h2g = hashFile(path.join(t3, '.gitignore'));
  const h2o = hashFile(path.join(t3, 'opencode.json'));
  const a2 = listMd(path.join(t3, '.opencode', 'agents')).length;

  if (h1g === h2g) ok('.gitignore estable en la 2a corrida');
  else bad('.gitignore cambio en la 2a corrida');
  if (h1o === h2o) ok('opencode.json estable en la 2a corrida');
  else bad('opencode.json cambio en la 2a corrida');
  if (a1 === a2) ok('agents no se duplican (' + a1 + ' -> ' + a2 + ')');
  else bad('agents cambieron (' + a1 + ' -> ' + a2 + ')');

  const nest = getNesting(t3);
  if (nest.length === 0) ok('la 2a corrida no crea anidados');
  else bad('anidados: ' + nest.join(', '));

  if (testCounts(t3)) ok('counts --check PASS tras 2 corridas');
  else bad('counts --check FAIL tras 2 corridas');

  if (testSmoke(t3)) ok('smoke-test PASSED tras 2 corridas');
  else bad('smoke-test FAILED tras 2 corridas');
}

function t4() {
  head('T4 - --all-agents (biblioteca completa)');
  const t4 = newProject(path.join(WORK, 't4-all'));
  runInit(t4, ['--all-agents']);

  const ag = listMd(path.join(t4, '.opencode', 'agents')).length;
  if (ag >= 80) ok('biblioteca completa: ' + ag + ' agents');
  else bad('solo ' + ag + ' agents, se esperaba >= 80');

  if (fs.existsSync(path.join(t4, '.opencode', '.stack'))) {
    bad('no deberia haber marcador .stack con -AllAgents');
  } else {
    ok('sin marcador .stack (pack completo)');
  }

  const nest = getNesting(t4);
  if (nest.length === 0) ok('sin anidados residuales');
  else bad('anidados: ' + nest.join(', '));

  if (testCounts(t4)) ok('counts --check PASS');
  else bad('counts --check FAIL');

  if (testSmoke(t4)) ok('smoke-test PASSED');
  else bad('smoke-test FAILED');
}

function t5() {
  head('T5 - valida un PackPath invalido (falla limpio)');
  const t5 = path.join(WORK, 't5-badpack');
  fs.rmSync(t5, { recursive: true, force: true });
  fs.mkdirSync(t5, { recursive: true });
  fs.writeFileSync(path.join(t5, 'pubspec.yaml'), 'name: x\n');

  let out = '';
  try {
    out = execFileSync(process.execPath, [
      INIT, '--project-path', t5, '--pack-path', path.join(WORK, 'no-existe'),
      '--skip-install', '--skip-docs', '--force',
    ], { cwd: PACK, encoding: 'utf8', stdio: 'pipe', maxBuffer: 16 * 1024 * 1024 });
  } catch (e) {
    out = String(e.stdout || '') + String(e.stderr || '');
  }

  if (/No se encontro el pack/.test(out)) ok('PackPath invalido -> error claro');
  else bad('no reporto el error de PackPath (salida: ' + out.trim() + ')');

  if (!fs.existsSync(path.join(t5, '.opencode', 'agents'))) ok('no instalo nada a medias');
  else bad('instalo parcialmente con PackPath invalido');
}

function t6() {
  head('T6 - stack node NO descarta skills JS/TS');
  const t6 = newProject(path.join(WORK, 't6-node'), 'package.json');
  runInit(t6);

  const sk = skillDirs(t6).length;
  if (sk >= 35) ok('skills: ' + sk);
  else bad('skills=' + sk + ', muy pocos');

  if (fs.existsSync(path.join(t6, '.agents', 'skills', 'drizzle-patterns'))) ok('drizzle-patterns conservado (aplica a node)');
  else bad('se descarto un skill que si aplica a node');

  if (fs.existsSync(path.join(t6, '.agents', 'skills', 'turso-libsql'))) ok('turso-libsql conservado (aplica a node)');
  else bad('se descarto turso-libsql en node');

  const ag = listMd(path.join(t6, '.opencode', 'agents')).length;
  const packAg = listMd(path.join(PACK, '.opencode', 'agents')).length;
  if (ag > 0 && ag < packAg) ok('agents filtrados para node: ' + ag + ' (pack=' + packAg + ')');
  else bad('agents=' + ag + ' (pack=' + packAg + ')');

  const or = getOrphans(t6);
  if (or.length === 0) ok('0 comandos huerfanos');
  else bad('huerfanos: ' + or.join(', '));

  const nest = getNesting(t6);
  if (nest.length === 0) ok('sin anidados residuales');
  else bad('anidados: ' + nest.join(', '));

  if (testCounts(t6)) ok('counts --check PASS');
  else bad('counts --check FAIL');

  if (testSmoke(t6)) ok('smoke-test PASSED');
  else bad('smoke-test FAILED');
}

function t7() {
  head('T7 - scaffolders generan artefactos VALIDOS');
  const t7 = newProject(path.join(WORK, 't7-scaffold'));
  runInit(t7);

  const agentCode = runNodeIn(t7, 'scaffold-new-agent.js', ['zz-scaffold']);
  if (fs.existsSync(path.join(t7, '.opencode', 'agents', 'zz-scaffold.md'))) {
    ok('scaffold-new-agent crea el archivo');
  } else {
    bad('scaffold-new-agent no creo nada (exit ' + agentCode + ')');
  }

  const skillCode = runNodeIn(t7, 'scaffold-new-skill.js', ['zz-scaffold-skill']);
  if (fs.existsSync(path.join(t7, '.agents', 'skills', 'zz-scaffold-skill', 'SKILL.md'))) {
    ok('scaffold-new-skill crea el archivo');
  } else {
    bad('scaffold-new-skill no creo nada (exit ' + skillCode + ')');
  }

  const vfCode = runNodeIn(t7, 'validate-frontmatter.js');
  if (vfCode === 0) ok('validate-frontmatter PASS con lo recien creado');
  else bad('validate-frontmatter FAIL con lo recien creado (frontmatter del scaffolder roto)');

  if (testCounts(t7)) ok('counts --check PASS (scaffolder refresco conteos)');
  else bad('counts --check FAIL: el scaffolder no refresco ## Counts');

  if (testCounts(t7)) ok('counts --check PASS');
  else bad('counts --check FAIL');

  if (testSmoke(t7)) ok('smoke-test PASSED');
  else bad('smoke-test FAILED');
}

const SCENARIOS = [t1, t2, t3, t4, t5, t6, t7];

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

function run() {
  if (!fs.existsSync(INIT)) {
    if (AS_JSON) console.log(JSON.stringify({ passed: 0, failed: 1, results: [], error: 'init-opencode.js no encontrado: ' + INIT }, null, 2));
    else console.log('  FAIL  init-opencode.js no encontrado: ' + INIT);
    process.exit(1);
  }

  // Fresh scratch area at the start, removed when the run ends.
  fs.rmSync(WORK, { recursive: true, force: true });
  fs.mkdirSync(WORK, { recursive: true });

  if (!QUIET && !AS_JSON) {
    console.log('Pack: ' + PACK);
    console.log('Work: ' + WORK);
  }

  for (const t of SCENARIOS) {
    try {
      t();
    } catch (e) {
      bad('excepcion: ' + String(e.message || e).split('\n')[0]);
    }
  }

  if (AS_JSON) {
    console.log(JSON.stringify({ passed: pass, failed: fail, results }, null, 2));
  } else {
    console.log('');
    console.log('================================');
    console.log('  PASS: ' + pass + '   FAIL: ' + fail);
    console.log('================================');
    if (fail > 0) console.log('  INSTALLER TEST FAILED');
    else console.log('  INSTALLER TEST PASSED');
  }
}

try {
  run();
} finally {
  // Scratch projects (junctions included) never stay behind.
  try { fs.rmSync(WORK, { recursive: true, force: true }); } catch { /* best effort */ }
}

process.exit(fail > 0 ? 1 : 0);
