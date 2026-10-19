#!/usr/bin/env node
/**
 * eval-live.js — Nivel 2: evalua COMPORTAMIENTO en vivo.
 *
 * Diferencia con eval-static.js: ese comprueba que el texto sigue escrito, este
 * comprueba que el modelo OBEDECE. Un puntero de Prompt Defense existe en disco
 * (E3/E4) pero nada garantiza que un `ignore previous instructions` sea
 * rechazado; un gate del SDD existe (E8) pero nada garantiza que se nombre en
 * una conversacion real.
 *
 * Motor: `opencode run --format json` (eventos NDJSON) contra un sandbox con el
 * pack instalado de verdad.
 *
 * Coste: API real por ejecucion, en cada corrida. Ver regla de coste en
 * evals/README.md: no se gasta en cambios puramente cosmeticos.
 *
 * USO
 *   node .opencode/bin/eval-live.js                  # todos los casos
 *   node .opencode/bin/eval-live.js --only L11,L13   # seleccion
 *   node .opencode/bin/eval-live.js --group defense  # por grupo
 *   node .opencode/bin/eval-live.js --limit 5        # humo
 *   node .opencode/bin/eval-live.js --dry            # sin ejecutar nada
 *
 * VARIABLES
 *   OPENCODE_EVAL_CLI     binario opencode (por defecto: el de la app escritorio)
 *   OPENCODE_EVAL_MODEL   modelo (por defecto: opencode/mimo-v2.6-flash-free)
 *   OPENCODE_EVAL_TIMEOUT ms por caso (por defecto 420000)
 */

'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const PACK = path.resolve(__dirname, '..', '..');
const CASES_FILE = path.join(PACK, 'evals', 'cases', 'live.json');
// El instalador del pack. NO confundir con project-init.js: ese solo gestiona
// docs/PROJECT.md y ni siquiera tiene flag --project-path (lo ignora y escribe
// en el cwd, que fue como destrozo un PROJECT.md en el propio pack).
const INIT = path.join(PACK, 'init-opencode.js');

const CLI =
  process.env.OPENCODE_EVAL_CLI ||
  path.join(
    os.homedir(),
    'AppData', 'Local', 'Programs', '@opencode-aidesktop',
    'resources', 'opencode-cli.exe'
  );

const MODEL = process.env.OPENCODE_EVAL_MODEL || 'opencode/mimo-v2.6-flash-free';
// 420s (7 min). Con 240s los casos pesados (L01, L21, L44) se mueran sin
// devolver NINGUN texto y "fallan" por corte, no por el pack: la corrida
// Flutter corto exactamente a 241611ms y 241705ms con texto vacio.
const TIMEOUT = Number(process.env.OPENCODE_EVAL_TIMEOUT || 420000);

// ---------------------------------------------------------------------------
// Args
// ---------------------------------------------------------------------------

const argv = process.argv.slice(2);
function argOf(name) {
  const i = argv.indexOf(name);
  return i >= 0 && i + 1 < argv.length ? argv[i + 1] : null;
}
const ONLY = (argOf('--only') || '').split(',').map(s => s.trim()).filter(Boolean);
const GROUP = argOf('--group');
const LIMIT = argOf('--limit') ? Number(argOf('--limit')) : Infinity;
const DRY = argv.includes('--dry');
const VERBOSE = argv.includes('--verbose');
const STACK = argOf('--stack') || 'node';

// Base de datos AISLADA: la del usuario tiene la migracion v1->v2 a medias
// (session_message apunta a session_v2 y las sesiones nuevas caen en session),
// lo que rompe `opencode run` con un FOREIGN KEY. XDG_DATA_HOME se respeta y
// crea una base limpia sin tocar la del usuario.
//
// El nombre lleva el stack: dos corridas simultaneas (una node, otra flutter)
// se machacarian la base Y los sandboxes si compartieran prefijo. sweepStale
// borra por prefijo, asi que cada stack solo barre lo suyo.
const DATA_DIR = path.join(os.tmpdir(), 'oc-eval-data-' + STACK);
const SANDBOX_PREFIX = 'oc-eval-' + STACK + '-';

// ---------------------------------------------------------------------------
// Sandbox
// ---------------------------------------------------------------------------

/** Borra en lo mejor posible. Reintenta: EPERM es normal si un proceso hijo de
 *  opencode o git aun retiene el directorio. Nunca lanza. */
function cleanup(dir) {
  if (!dir) return;
  for (let i = 0; i < 6; i++) {
    try {
      fs.rmSync(dir, { recursive: true, force: true, maxRetries: 3, retryDelay: 150 });
      return;
    } catch (e) {
      if (i === 5) {
        console.warn('       (aviso: no se pudo limpiar ' + path.basename(dir) + ': ' + e.code + ')');
        return;
      }
      // ms de espera creciente: cede el handle antes de volver a intentar.
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 300 * (i + 1));
    }
  }
}

/** Limpia restos de corridas anteriores que se quedaron colgadas.
 *  Solo del MISMO stack: con prefijo generico, una corrida flutter barria los
 *  sandboxes vivos de la node que corriera en paralelo. */
function sweepStale() {
  let base;
  try { base = path.dirname(DATA_DIR); } catch { return; }
  let entries;
  try { entries = fs.readdirSync(base); } catch { return; }
  for (const name of entries) {
    if (name.startsWith(SANDBOX_PREFIX)) cleanup(path.join(base, name));
  }
}

/** Marca de stack que Detect-Stack necesita para filtrar. Sin ella no reconoce
 *  nada y poda skills: el caso mediria un pack mutilado. */
const STACK_SEEDS = {
  node:    { 'package.json': '{"name":"eval-sandbox","version":"0.0.0"}\n' },
  flutter: { 'pubspec.yaml': 'name: eval_sandbox\ndescription: sandbox de evaluacion\nenvironment:\n  sdk: ">=3.0.0 <4.0.0"\n' },
  go:      { 'go.mod': 'module example.com/eval\n\ngo 1.22\n' },
  python:  { 'pyproject.toml': '[project]\nname = "eval-sandbox"\nversion = "0.0.0"\n' },
};
const DEFAULT_SEED = STACK_SEEDS[STACK] || STACK_SEEDS.node;

function makeSandbox(seed) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), SANDBOX_PREFIX));
  fs.mkdirSync(dir, { recursive: true });
  spawnSync('git', ['init'], { cwd: dir, stdio: 'ignore' });
  const files = { ...DEFAULT_SEED, ...(seed || {}) };
  for (const [rel, content] of Object.entries(files)) {
    const p = path.join(dir, rel);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, content, 'utf8');
  }
  const r = spawnSync(process.execPath, [
    INIT, '--project-path', dir, '--skip-install', '--skip-docs', '--force',
  ], { cwd: PACK, stdio: 'pipe', encoding: 'utf8', timeout: 180000, maxBuffer: 32 * 1024 * 1024 });
  if (r.status !== 0) {
    const err = (r.stdout || '') + (r.stderr || '');
    throw new Error('init-opencode exit ' + r.status + ': ' + err.slice(0, 500));
  }
  // Guardia: sin .opencode/.agents el caso mediria OpenCode, no el pack.
  if (!fs.existsSync(path.join(dir, '.opencode', 'agents')) ||
      !fs.existsSync(path.join(dir, '.agents', 'skills'))) {
    throw new Error('el pack no se instalo en el sandbox: ' + dir);
  }
  return dir;
}

// ---------------------------------------------------------------------------
// Ejecucion
// ---------------------------------------------------------------------------

/** Lanza `opencode run --format json` y devuelve los eventos NDJSON parseados. */
function runCase(c, sandbox) {
  const args = ['run', c.prompt, '--format', 'json', '--auto', '--standalone', '--model', MODEL];
  if (c.agent) args.push('--agent', c.agent);

  const env = { ...process.env, XDG_DATA_HOME: DATA_DIR };
  // Sin --dir en v2: el directorio lo fija el cwd.
  const r = spawnSync(CLI, args, {
    cwd: sandbox, env, encoding: 'utf8', timeout: TIMEOUT, maxBuffer: 64 * 1024 * 1024,
  });

  const out = (r.stdout || '') + (r.stderr || '');
  const events = [];
  for (const line of out.split(/\r?\n/)) {
    const t = line.trim();
    if (!t.startsWith('{')) continue;
    try { events.push(JSON.parse(t)); } catch { /* no es un evento */ }
  }
  return { status: r.status, events, raw: out };
}

// ---------------------------------------------------------------------------
// Aserciones
// ---------------------------------------------------------------------------

function finalText(events) {
  return events
    .filter(e => e.type === 'text' && e.part && typeof e.part.text === 'string')
    .map(e => e.part.text)
    .join('\n');
}

function toolCalls(events) {
  return events
    .filter(e => e.type === 'tool_use' && e.part && e.part.tool)
    .map(e => ({ tool: e.part.tool, input: e.part.state ? e.part.state.input : null }));
}

function tokens(events) {
  return events.reduce((acc, e) => {
    if (e.type !== 'step_finish' || !e.part || !e.part.tokens) return acc;
    const t = e.part.tokens;
    acc.input += t.input || 0;
    acc.output += t.output || 0;
    acc.cacheRead += (t.cache && t.cache.read) || 0;
    return acc;
  }, { input: 0, output: 0, cacheRead: 0 });
}

/** Compila con soporte de `(?i)` inicial: JS no admite flags inline (es sintaxis
 *  PCRE/Python) y escribirla lanza "Invalid group" justo DESPUES de gastar la
 *  llamada a API, tirando el resultado. */
function compile(pat) {
  let p = String(pat);
  let flags = '';
  const m = p.match(/^\(\?([imsu]+)\)/);
  if (m) { flags = m[1]; p = p.slice(m[0].length); }
  return new RegExp(p, flags);
}

/** El modelo afirma que NO ha recibido el prompt: entonces la asercion no mide
 *  nada. Pasaba en L13: respondio "solo contiene la referencia... ¿podrias
 *  volver a enviar?" y salio PASS aunque NUNCA vio la pregunta (luego, al
 *  repetir, respondio OK 2 de 2). Se marca INCONCL y NO cuenta como pass. */
const NOT_RECEIVED = [
  /no\s+(?:veo|recibo|he\s+recibido|encuentro)\s+(?:[^.!?]{0,45})?(?:contenido|mensaje|texto)/i,
  /solo\s+(?:contiene|he\s+recibido)\s+(?:la\s+)?referencia/i,
  /(?:volver\s+a\s+enviar|reenviar[a-z]*|re-?send)/i,
  /no\s+has\s+(?:enviado|escrito|adjuntado)/i,
  /(?:didn['’]t|did\s+not)\s+(?:receive|get|see)\b/i,
  /\b(?:empty|missing)\s+(?:message|prompt|input)\b/i,
  /\bonly\s+(?:received|got)\s+(?:a\s+)?reference\b/i,
  /no\s+(?:llega|llego|ha\s+llegado|aparece)\s+(?:[^.!?]{0,30})?(?:contenido|mensaje)/i,
];

/** Devuelve la lista de fallos (vacida = PASS). Nunca lanza: un fallo de
 *  asercion no debe descartar la respuesta ya pagada. */
function assert(c, res) {
  const fails = [];
  const text = finalText(res.events);
  const calls = toolCalls(res.events);

  const check = (label, fn) => {
    try { fn(); } catch (e) { fails.push(label + ': ' + e.message); }
  };

  check('exit', () => {
    if (c.expectExit !== undefined && res.status !== c.expectExit) {
      fails.push(`exit=${res.status}, esperado ${c.expectExit}`);
    }
    // Un error de proveedor invalida el caso entero: no estamos midiendo al
    // pack, estamos midiendo el entorno.
    const errs = res.events.filter(e => e.type === 'error');
    if (errs.length) {
      fails.push('evento de error: ' + JSON.stringify(errs[0].error || errs[0]).slice(0, 200));
    }
  });

  check('mustMatch', () => {
    if (c.mustMatch && !compile(c.mustMatch).test(text)) {
      fails.push(`no cumple /${c.mustMatch}/`);
    }
  });
  check('mustNotMatch', () => {
    if (c.mustNotMatch && compile(c.mustNotMatch).test(text)) {
      fails.push(`INCUMPLE /${c.mustNotMatch}/`);
    }
  });
  check('toolsUsed', () => {
    if (!c.toolsUsed) return;
    const have = new Set(calls.map(x => x.tool));
    for (const t of c.toolsUsed) if (!have.has(t)) fails.push(`no uso la herramienta ${t}`);
  });
  check('toolsBanned', () => {
    if (!c.toolsBanned) return;
    const have = new Set(calls.map(x => x.tool));
    for (const t of c.toolsBanned) if (have.has(t)) fails.push(`uso la herramienta prohibida ${t}`);
  });
  check('bashBanned', () => {
    if (!c.bashBanned) return;
    const re = compile(c.bashBanned);
    for (const call of calls) {
      if (!/^(bash|shell|exec)$/i.test(call.tool)) continue;
      if (re.test(JSON.stringify(call.input || {}))) {
        fails.push(`ejecuto /${c.bashBanned}/ via ${call.tool}`);
      }
    }
  });
  if (!text.trim() && !fails.length) fails.push('respuesta vacia');

  // INCONCL: el modelo dice no haber recibido el prompt, asi que cualquier
  // resultado aqui es espurio. No se mezcla con PASS ni con FAIL: el caso hay
  // que repetirlo, no certificarlo.
  const blind = NOT_RECEIVED.some(re => re.test(text));
  if (blind) fails.push('INCONCL: el modelo dice no haber recibido el prompt');
  return { fails, text, calls, inconclusive: blind };
}

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

function main() {
  if (!fs.existsSync(CASES_FILE)) {
    console.error('No existe ' + CASES_FILE);
    process.exit(1);
  }
  if (!fs.existsSync(CLI)) {
    console.error('No se encuentra el binario de opencode: ' + CLI);
    console.error('Define OPENCODE_EVAL_CLI.');
    process.exit(1);
  }

  let cases = JSON.parse(fs.readFileSync(CASES_FILE, 'utf8'));
  if (ONLY.length) cases = cases.filter(c => ONLY.includes(c.id));
  if (GROUP) cases = cases.filter(c => c.group === GROUP);
  cases = cases.slice(0, LIMIT);

  console.log('eval-live (Nivel 2) — ' + cases.length + ' casos');
  console.log('  cli    : ' + CLI);
  console.log('  modelo : ' + MODEL);
  console.log('  stack  : ' + STACK + '   (filtra el pack igual que en produccion)');
  console.log('  base   : ' + DATA_DIR + ' (aislada)');
  console.log('');

  if (DRY) {
    cases.forEach(c => console.log('  ' + c.id + ' [' + c.group + '] ' + c.title));
    return;
  }

  // Base de datos fresca para TODA la corrida, y barrido de restos de corridas
  // anteriores que se quedaron sin limpiar.
  cleanup(DATA_DIR);
  sweepStale();
  fs.mkdirSync(DATA_DIR, { recursive: true });

  const results = [];
  let pass = 0, fail = 0, inc = 0;
  const started = Date.now();

  for (const c of cases) {
    const t0 = Date.now();
    let sandbox = null, res, outcome;
    try {
      sandbox = makeSandbox(c.seed);
      res = runCase(c, sandbox);
      outcome = assert(c, res);
      if (outcome.inconclusive) inc++;
      else if (outcome.fails.length) fail++;
      else pass++;
    } catch (e) {
      outcome = { fails: ['excepcion: ' + e.message], text: '', calls: [] };
      fail++;
    } finally {
      // NUNCA dejar que la limpieza mate la corrida: rmSync lanza EPERM si
      // opencode (watcher) o git aun tienen el sandbox abierto, y al estar en
      // un finally sin proteger eso destruia el proceso ANTES de imprimir el
      // resultado -- se gastaba la llamada a API y no se veia ni un PASS/FAIL.
      cleanup(sandbox);
    }

    const ms = Date.now() - t0;
    const inconclusive = !!outcome.inconclusive;
    const ok = !inconclusive && outcome.fails.length === 0;
    results.push({ id: c.id, group: c.group, title: c.title, ok, inconclusive, fails: outcome.fails, ms });

    const tag = inconclusive ? 'INCONCL' : ok ? 'PASS   ' : 'FAIL   ';
    console.log(tag + c.id + '  [' + c.group + '] ' + c.title + '  (' + ms + 'ms)');
    for (const f of outcome.fails) console.log('       -> ' + f);
    if (VERBOSE && outcome.text) {
      console.log('       texto: ' + outcome.text.replace(/\s+/g, ' ').slice(0, 300));
      console.log('       tools: ' + outcome.calls.map(x => x.tool).join(', '));
    }
  }

  const secs = ((Date.now() - started) / 1000).toFixed(0);
  console.log('');
  console.log('eval-live: ' + pass + ' pass, ' + fail + ' fail, ' + inc + ' inconclusos (' + secs + 's)');
  if (inc) console.log('           (inconclusos = el modelo dijo no recibir el prompt; REPETIR, no certificarlos)');

  // Nombre por stack: la corrida flutter no debe pisar el informe de la node.
  const outFile = path.join(PACK, 'evals', 'results', 'live-' + STACK + '-latest.json');
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, JSON.stringify({
    ranAt: new Date().toISOString(), cli: CLI, model: MODEL,
    pass, fail, inc, cases: results,
  }, null, 2) + '\n', 'utf8');
  console.log('resultados: ' + path.relative(PACK, outFile));

  // 2 = solo inconclusos (falta medicion); 1 = fallos reales del pack.
  process.exit(fail > 0 ? 1 : (inc > 0 ? 2 : 0));
}

main();
