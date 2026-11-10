#!/usr/bin/env node
'use strict';
// .opencode/bin/project-profile.js
//
// Decide QUE se activa en un proyecto segun sus caracteristicas. Es la unica
// fuente de verdad del filtro: el instalador (init-opencode.js) consume su
// plan en vez de decidir por su cuenta.
//
// Reglas (y el porque de cada una):
//
//   AGENTS  union de los stacks detectados. Un repo Flutter+Node conserva los
//           reviewers/resolvers de los dos. Stack desconocido -> no se poda
//           nada (podar de mas rompe el ciclo spec-driven).
//   SKILLS  solo el trio estrictamente JS/TS se descarta, y unicamente cuando
//           el proyecto no es Node (son multi-stack los demas).
//   MCP     automatico SOLO lo que no pide credenciales: `context7` siempre y
//           `playwright` solo con E2E configurado. Los MCP con secreto se
//           RECOMIENDAN pero no se encienden: sin token el servidor arranca
//           roto, gasta tiempo de boot y ensucia el contexto.
//   LSP     se usan los servidores integrados de OpenCode 2 (`lsp: true`) y se
//           declara una entrada explicita solo si el lenguaje esta detectado Y
//           el binario existe en el PATH. Un LSP declarado sin binario falla al
//           abrir el archivo.
//   PLUGINS solo API V2. Los plugins V1 cargan en OpenCode 2 y no ejecutan
//           nada: instalarlos es coste sin efecto.
//
// Uso:
//   node .opencode/bin/project-profile.js [dir] [--json] [--stack <nombre>]

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

// ---------------------------------------------------------------------------
// Stacks: agentes por lenguaje (misma forma que init-opencode.js / .ps1)
// ---------------------------------------------------------------------------

const STACK_AGENTS = [
  'angular-build-resolver', 'angular-reviewer',
  'cpp-build-resolver', 'cpp-reviewer',
  'csharp-reviewer',
  'dart-build-resolver', 'flutter-reviewer',
  'django-build-resolver', 'fastapi-reviewer', 'pytorch-build-resolver', 'python-reviewer',
  'go-build-resolver', 'go-reviewer',
  'harmonyos-app-resolver',
  'java-build-resolver', 'java-reviewer',
  'kotlin-build-resolver', 'kotlin-reviewer',
  'php-reviewer',
  'react-build-resolver', 'react-reviewer', 'svelte-reviewer', 'typescript-reviewer', 'vue-reviewer',
  'rust-build-resolver', 'rust-reviewer',
  'swift-build-resolver', 'swift-reviewer',
];

const STACK_KEEP = {
  flutter: ['dart-build-resolver', 'flutter-reviewer'],
  node: ['angular-build-resolver', 'angular-reviewer', 'react-build-resolver', 'react-reviewer',
    'svelte-reviewer', 'typescript-reviewer', 'vue-reviewer'],
  python: ['django-build-resolver', 'fastapi-reviewer', 'pytorch-build-resolver', 'python-reviewer'],
  rust: ['rust-build-resolver', 'rust-reviewer'],
  go: ['go-build-resolver', 'go-reviewer'],
  java: ['java-build-resolver', 'java-reviewer'],
  kotlin: ['kotlin-build-resolver', 'kotlin-reviewer', 'harmonyos-app-resolver'],
  csharp: ['csharp-reviewer'],
  cpp: ['cpp-build-resolver', 'cpp-reviewer'],
  php: ['php-reviewer'],
  swift: ['swift-build-resolver', 'swift-reviewer'],
};

const JS_ONLY_SKILLS = ['drizzle-patterns', 'turso-libsql', 'clerk-auth'];

// ---------------------------------------------------------------------------
// Catalogo LSP
// ---------------------------------------------------------------------------
// `bin` es lo que se comprueba en el PATH; `hint` es lo que se imprime cuando
// falta. En Windows los shims de npm son .cmd, asi que el comando se envuelve
// en `cmd /c` (misma forma que ya usaba el pack para dart).

const LSP_SERVERS = {
  node: {
    id: 'typescript',
    command: ['typescript-language-server', '--stdio'],
    bin: 'typescript-language-server',
    extensions: ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.mts', '.cts'],
    hint: 'npm i -g typescript-language-server typescript',
  },
  python: {
    id: 'pyright',
    command: ['pyright-langserver', '--stdio'],
    bin: 'pyright-langserver',
    extensions: ['.py', '.pyi'],
    hint: 'npm i -g pyright',
  },
  flutter: {
    id: 'dart',
    command: ['dart', 'language-server'],
    bin: 'dart',
    extensions: ['.dart'],
    hint: 'viene con el SDK de Flutter (dart en el PATH)',
  },
  rust: {
    id: 'rust',
    command: ['rust-analyzer'],
    bin: 'rust-analyzer',
    extensions: ['.rs'],
    hint: 'rustup component add rust-analyzer',
  },
  go: {
    id: 'go',
    command: ['gopls'],
    bin: 'gopls',
    extensions: ['.go'],
    hint: 'go install golang.org/x/tools/gopls@latest',
  },
  java: {
    id: 'java',
    command: ['jdtls'],
    bin: 'jdtls',
    extensions: ['.java'],
    hint: 'instala eclipse.jdt.ls (jdtls en el PATH)',
  },
  kotlin: {
    id: 'kotlin',
    command: ['kotlin-language-server'],
    bin: 'kotlin-language-server',
    extensions: ['.kt', '.kts'],
    hint: 'instala kotlin-language-server',
  },
  csharp: {
    id: 'csharp',
    command: ['csharp-ls'],
    bin: 'csharp-ls',
    extensions: ['.cs'],
    hint: 'dotnet tool install -g csharp-ls',
  },
  cpp: {
    id: 'clangd',
    command: ['clangd'],
    bin: 'clangd',
    extensions: ['.c', '.h', '.cc', '.cpp', '.cxx', '.hpp'],
    hint: 'instala clangd (LLVM) y ponlo en el PATH',
  },
  php: {
    id: 'php',
    command: ['intelephense', '--stdio'],
    bin: 'intelephense',
    extensions: ['.php'],
    hint: 'npm i -g intelephense',
  },
  swift: {
    id: 'swift',
    command: ['sourcekit-lsp'],
    bin: 'sourcekit-lsp',
    extensions: ['.swift'],
    hint: 'viene con el toolchain de Swift',
  },
};

// ---------------------------------------------------------------------------
// Catalogo MCP
// ---------------------------------------------------------------------------
// `auto` = sin credenciales, se puede encender sin preguntar.
// `recommend` = necesita token/API key: se propone y se activa a mano.

const MCP_AUTO = [
  {
    name: 'context7',
    when: () => true,
    reason: 'documentacion de librerias en vivo (sin credenciales)',
  },
  {
    name: 'playwright',
    when: (d) => d.testing.includes('playwright'),
    reason: 'E2E/browser configurado en el proyecto (sin credenciales)',
  },
];

const MCP_RECOMMEND = [
  { name: 'supabase', when: (d) => d.databases.includes('supabase'),
    why: 'el proyecto usa Supabase: inspeccionar tablas, RLS y migraciones' },
  { name: 'postgres', when: (d) => d.databases.includes('postgres'),
    why: 'consultas de solo lectura para depurar datos y validar migraciones' },
  { name: 'stripe', when: (d) => d.payments.includes('stripe'),
    why: 'leer clientes, suscripciones y eventos de pago' },
  { name: 'sentry', when: (d) => d.observability.includes('sentry'),
    why: 'triaje de errores en produccion con stack traces reales' },
  { name: 'vercel', when: (d) => d.infra.includes('vercel'),
    why: 'estado de despliegues, logs de build y variables de entorno' },
  { name: 'github', when: (d) => d.infra.includes('github-actions'),
    why: 'leer issues, PRs y ejecuciones de CI sin salir del agente' },
  { name: 'gitlab', when: (d) => d.infra.includes('gitlab-ci'),
    why: 'MRs, issues y pipelines en proyectos GitLab' },
];

// ---------------------------------------------------------------------------
// Catalogo de plugins
// ---------------------------------------------------------------------------
// PLUGIN_V2: paquetes que exponen la API nueva (`@opencode/plugin`,
// Plugin.define + setup). Hoy el pack no publica ninguno; el plugin local
// hookify.ts ya esta migrado y se autodescubre desde .opencode/plugins/.

const PLUGIN_V2 = [];

const PLUGIN_V1_ONLY = [
  { pkg: '@tarquinen/opencode-dcp', why: 'peer @opencode-ai/plugin >=1.18.29 (API V1): carga y no ejecuta en V2' },
  { pkg: 'opencode-pty', why: 'depende de @opencode-ai/plugin ^1.3.13 (API V1): carga y no ejecuta en V2' },
  { pkg: 'opencode-vibeguard', why: '0.1.0 sin API V2: carga y no ejecuta en V2' },
];

// ---------------------------------------------------------------------------
// Deteccion
// ---------------------------------------------------------------------------

const MANIFESTS = [
  'package.json', 'tsconfig.json', 'pubspec.yaml', 'pyproject.toml',
  'requirements.txt', 'setup.py', 'Cargo.toml', 'go.mod', 'pom.xml',
  'build.gradle', 'build.gradle.kts', 'composer.json', 'Package.swift',
  'CMakeLists.txt',
];

function readText(p) {
  try {
    let t = fs.readFileSync(p, 'utf8');
    if (t.charCodeAt(0) === 0xFEFF) t = t.slice(1);
    return t;
  } catch { return null; }
}

function listDir(dir) {
  try { return fs.readdirSync(dir); } catch { return []; }
}

function escRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Todos los manifiestos del proyecto como un solo texto: los ecosystems
 *  declaran dependencias en formatos distintos y aqui solo interesa si un
 *  nombre aparece o no. */
function manifestBlob(dir) {
  const parts = [];
  for (const f of MANIFESTS) {
    const t = readText(path.join(dir, f));
    if (t) parts.push(t);
  }
  return parts.join('\n');
}

/** Matcher de dependencia. Los nombres con @ o / (paquetes scoped) se buscan
 *  como subcadena; los simples exigen limite de token para que `pg` no casar
 *  dentro de `page`. */
function makeDepMatcher(blob) {
  const lower = blob.toLowerCase();
  return (name) => {
    const n = String(name).toLowerCase();
    if (n.includes('@') || n.includes('/')) return lower.includes(n);
    return new RegExp('(^|[^a-z0-9_./-])' + escRe(n) + '([^a-z0-9_-]|$)', 'i').test(lower);
  };
}

function detect(projectDir) {
  const dir = path.resolve(projectDir);
  const files = listDir(dir);
  const has = (f) => fs.existsSync(path.join(dir, f));
  const hasFile = (re) => files.some((f) => re.test(f));
  const dep = makeDepMatcher(manifestBlob(dir));

  const languages = [];
  const lang = (id, cond) => { if (cond && !languages.includes(id)) languages.push(id); };

  lang('node', has('package.json') || has('tsconfig.json') || hasFile(/\.(mjs|cjs|jsx|tsx)$/i));
  lang('flutter', has('pubspec.yaml'));
  lang('python', has('pyproject.toml') || has('requirements.txt') || has('setup.py') || has('manage.py'));
  lang('rust', has('Cargo.toml'));
  lang('go', has('go.mod'));
  lang('java', has('pom.xml') || has('build.gradle'));
  lang('kotlin', has('build.gradle.kts') || hasFile(/\.kt$/));
  lang('csharp', hasFile(/\.(csproj|sln)$/i));
  lang('cpp', has('CMakeLists.txt') || hasFile(/\.(cpp|cc|cxx|hpp)$/i));
  lang('php', has('composer.json'));
  lang('swift', has('Package.swift') || hasFile(/\.xcodeproj$/i));

  const frameworks = [];
  const fw = (name, cond) => { if (cond) frameworks.push(name); };

  fw('next', dep('next') || has('next.config.js') || has('next.config.mjs') || has('next.config.ts'));
  fw('react-native', dep('react-native'));
  fw('expo', dep('expo'));
  fw('react', dep('react') || dep('react-dom'));
  fw('vue', dep('vue'));
  fw('nuxt', dep('nuxt'));
  fw('svelte', dep('svelte') || dep('@sveltejs/kit'));
  fw('angular', dep('@angular/core'));
  fw('astro', dep('astro'));
  fw('nestjs', dep('@nestjs/core'));
  fw('express', dep('express'));
  fw('fastify', dep('fastify'));
  fw('django', dep('django') || has('manage.py'));
  fw('fastapi', dep('fastapi'));
  fw('flask', dep('flask'));
  fw('pytorch', dep('torch'));
  fw('laravel', dep('laravel/framework'));
  fw('spring', dep('spring-boot-starter'));

  const databases = [];
  const db = (name, cond) => { if (cond) databases.push(name); };

  db('supabase', dep('@supabase/supabase-js') || has('supabase'));
  db('postgres', dep('pg') || dep('postgres') || dep('psycopg2') || dep('psycopg') || dep('asyncpg'));
  db('sqlite', dep('better-sqlite3') || dep('sqlite3') || dep('aiosqlite'));
  db('mysql', dep('mysql2') || dep('mysqlclient') || dep('pymysql'));
  db('mongodb', dep('mongoose') || dep('mongodb') || dep('pymongo'));
  db('redis', dep('redis') || dep('ioredis'));
  db('prisma', dep('prisma') || dep('@prisma/client'));
  db('drizzle', dep('drizzle-orm'));

  const infra = [];
  if (has('Dockerfile') || has('docker-compose.yml') || has('docker-compose.yaml') || has('compose.yaml')) infra.push('docker');
  if (has('k8s') || has('kubernetes') || has('helm') || has('charts')) infra.push('kubernetes');
  if (hasFile(/\.tf$/)) infra.push('terraform');
  if (has('.github')) infra.push('github-actions');
  if (has('.gitlab-ci.yml')) infra.push('gitlab-ci');
  if (has('vercel.json') || dep('vercel')) infra.push('vercel');
  if (has('netlify.toml')) infra.push('netlify');
  if (has('fly.toml')) infra.push('fly');
  if (has('render.yaml')) infra.push('render');

  const testing = [];
  if (has('playwright.config.ts') || has('playwright.config.js') || has('playwright.config.mts') || dep('@playwright/test')) testing.push('playwright');
  if (has('cypress.config.ts') || has('cypress.config.js') || dep('cypress')) testing.push('cypress');
  if (dep('vitest')) testing.push('vitest');
  if (dep('jest')) testing.push('jest');
  if (has('pytest.ini') || has('conftest.py') || dep('pytest')) testing.push('pytest');

  const payments = [];
  if (dep('stripe') || dep('@stripe/stripe-js')) payments.push('stripe');

  const observability = [];
  if (dep('@sentry/node') || dep('@sentry/react') || dep('sentry-sdk')) observability.push('sentry');

  const stacks = languages.filter((l) => Object.prototype.hasOwnProperty.call(STACK_KEEP, l));
  const unsupported = languages.filter((l) => !Object.prototype.hasOwnProperty.call(STACK_KEEP, l));

  return { root: dir, languages, stacks, unsupported, frameworks, databases, infra, testing, payments, observability };
}

// ---------------------------------------------------------------------------
// Plan
// ---------------------------------------------------------------------------

function commandExists(bin) {
  const probe = process.platform === 'win32' ? 'where' : 'which';
  try {
    const r = spawnSync(probe, [bin], { stdio: 'ignore' });
    return r.status === 0;
  } catch { return false; }
}

/** En Windows los binarios instalados por npm son shims .cmd: hay que pasar
 *  por el interprete o el spawn del servidor falla. */
function platformCommand(command) {
  return process.platform === 'win32' ? ['cmd', '/c', ...command] : command.slice();
}

function planMcp(detected) {
  const enabled = MCP_AUTO.filter((m) => m.when(detected)).map((m) => ({ name: m.name, reason: m.reason }));
  const recommended = MCP_RECOMMEND.filter((m) => m.when(detected))
    .map((m) => ({ name: m.name, why: m.why, activate: '/setup-mcp ' + m.name }));
  return { enabled, recommended };
}

function planLsp(detected) {
  const servers = {};
  const unavailable = [];
  for (const language of detected.languages) {
    const spec = LSP_SERVERS[language];
    if (!spec) continue;
    if (commandExists(spec.bin)) {
      servers[spec.id] = { command: platformCommand(spec.command), extensions: spec.extensions.slice() };
    } else {
      unavailable.push({ language, id: spec.id, bin: spec.bin, hint: spec.hint });
    }
  }
  // OpenCode 2 trae servidores integrados: `lsp: true` los habilita y las
  // entradas de arriba solo cubren lo que el proyecto necesita y la maquina
  // puede ejecutar.
  return { enableBuiltins: true, servers, unavailable };
}

function planPlugins(opts) {
  const packDir = opts.packDir || path.resolve(__dirname, '..', '..');
  const local = [];
  if (fs.existsSync(path.join(packDir, '.opencode', 'plugins', 'hookify.ts'))) local.push('hookify');
  return { install: PLUGIN_V2.slice(), skip: PLUGIN_V1_ONLY.slice(), local };
}

function plan(opts) {
  const o = opts || {};
  const detected = o.detected || detect(o.projectDir || process.cwd());
  const forced = o.stack && STACK_KEEP[o.stack] ? [o.stack] : null;
  const stacks = forced || detected.stacks.slice();

  const pool = o.agentsPool || STACK_AGENTS;
  const keepByStack = o.keepByStack || STACK_KEEP;

  let agentsToDrop = [];
  if (!o.allAgents && stacks.length > 0) {
    const keep = new Set();
    for (const s of stacks) for (const a of (keepByStack[s] || [])) keep.add(a);
    agentsToDrop = pool.filter((a) => !keep.has(a));
  }

  const isNode = detected.languages.includes('node');
  const skillsToDrop = (!o.allAgents && !isNode) ? (o.jsOnlySkills || JS_ONLY_SKILLS).slice() : [];

  const notes = [];
  if (stacks.length === 0) {
    notes.push('stack no reconocido: no se podan agentes de lenguaje (conservador)');
  }
  if (detected.unsupported.length > 0) {
    notes.push('sin agentes de lenguaje para: ' + detected.unsupported.join(', '));
  }
  if (isNode) {
    notes.push('proyecto Node: los skills JS/TS (drizzle, turso, clerk) se conservan');
  }

  return {
    detected,
    stacks,
    agents: {
      pool: pool.length,
      drop: agentsToDrop,
      keep: pool.length - agentsToDrop.length,
    },
    agentsToDrop,
    skillsToDrop,
    mcp: planMcp(detected),
    lsp: planLsp(detected),
    plugins: planPlugins(o),
    notes,
  };
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function render(p) {
  const d = p.detected;
  const list = (a) => (a.length ? a.join(', ') : '(ninguno)');

  console.log('PROYECTO  ' + d.root);
  console.log('  Lenguajes   ' + list(d.languages));
  console.log('  Stacks      ' + list(p.stacks) + (d.unsupported.length ? '   [sin agentes: ' + d.unsupported.join(', ') + ']' : ''));
  console.log('  Frameworks  ' + list(d.frameworks));
  console.log('  Datos       ' + list(d.databases));
  console.log('  Infra       ' + list(d.infra));
  console.log('  Testing     ' + list(d.testing));

  console.log('');
  console.log('AGENTS  ' + p.agents.keep + '/' + p.agents.pool + ' se copian, ' + p.agentsToDrop.length + ' de lenguaje se descartan');
  if (p.agentsToDrop.length) console.log('  fuera: ' + p.agentsToDrop.join(', '));

  console.log('SKILLS  ' + (p.skillsToDrop.length ? 'se descartan: ' + p.skillsToDrop.join(', ') : 'sin poda'));

  console.log('MCP     ' + (p.mcp.enabled.length ? p.mcp.enabled.map((m) => m.name).join(', ') : '(ninguno)'));
  for (const m of p.mcp.enabled) console.log('  + ' + m.name + '  -> ' + m.reason);
  if (p.mcp.recommended.length) {
    console.log('  recomendados (requieren credenciales, no se encienden solos):');
    for (const m of p.mcp.recommended) console.log('  · ' + m.name + ' (' + m.activate + ')  -> ' + m.why);
  }

  console.log('LSP     builtins=' + (p.lsp.enableBuiltins ? 'on' : 'off') +
    (Object.keys(p.lsp.servers).length ? '  + ' + Object.keys(p.lsp.servers).join(', ') : '  + (sin overrides)'));
  for (const [id, s] of Object.entries(p.lsp.servers)) {
    console.log('  + ' + id + '  ' + s.command.join(' ') + '  ' + s.extensions.join(' '));
  }
  for (const u of p.lsp.unavailable) {
    console.log('  ! ' + u.language + ': falta ' + u.bin + ' -> ' + u.hint);
  }

  console.log('PLUGINS ' + (p.plugins.install.length ? 'instalar: ' + p.plugins.install.join(', ') : 'sin paquetes npm que instalar') +
    (p.plugins.local.length ? '  |  local: ' + p.plugins.local.join(', ') + ' (autodescubierto, V2)' : ''));
  for (const s of p.plugins.skip) console.log('  - ' + s.pkg + ': ' + s.why);

  if (p.notes.length) {
    console.log('');
    for (const n of p.notes) console.log('NOTA    ' + n);
  }
}

function main() {
  const argv = process.argv.slice(2);
  const json = argv.includes('--json');
  let stack = null;
  const rest = [];
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--stack') { stack = argv[++i]; continue; }
    if (argv[i] === '--json') continue;
    rest.push(argv[i]);
  }
  const dirArg = rest.find((a) => !a.startsWith('--'));
  const projectDir = path.resolve(dirArg || process.cwd());

  if (!fs.existsSync(projectDir)) {
    console.error('[ERROR] no existe el directorio: ' + projectDir);
    process.exit(1);
  }

  const p = plan({ projectDir, stack });
  if (json) console.log(JSON.stringify(p, null, 2));
  else render(p);
}

module.exports = {
  detect, plan, render,
  STACK_AGENTS, STACK_KEEP, JS_ONLY_SKILLS,
  LSP_SERVERS, MCP_AUTO, MCP_RECOMMEND, PLUGIN_V2, PLUGIN_V1_ONLY,
  commandExists, platformCommand,
};

if (require.main === module) main();
