#!/usr/bin/env node
/**
 * refresh-project.js - regenerate docs/PROJECT.md from current project state
 *
 * Scans:
 *   - package.json (Node/JS/TS, including workspaces)
 *   - pubspec.yaml (Flutter/Dart)
 *   - pyproject.toml / requirements.txt / setup.py (Python)
 *   - Cargo.toml (Rust)
 *   - go.mod (Go)
 *   - *.csproj / *.sln (.NET)
 *   - pom.xml / build.gradle* (Java/Kotlin)
 *   - index.html (Web)
 *   - README.*.md
 *   - tsconfig.json (TypeScript strict mode)
 *   - turbo.json / nx.json / pnpm-workspace.yaml (monorepo)
 *   - .eslintrc* / eslint.config.* / biome.json (lint)
 *   - .prettierrc* / prettier.config.* (format)
 *   - vitest.config.* / jest.config.* / pytest.ini (test)
 *   - .github/workflows / .gitlab-ci.yml / .circleci (CI)
 *   - Dockerfile / docker-compose*.yml (container)
 *   - .env.example / .env.sample (env vars)
 *
 * Generates a fresh docs/PROJECT.md and (in --dry-run) shows the diff
 * without writing. Manual sections (Non-Negotiables, Architecture Notes,
 * Open Questions) are preserved across refreshes.
 *
 * Usage:
 *   node .opencode/bin/refresh-project.js              # scan + write
 *   node .opencode/bin/refresh-project.js --dry-run    # scan + show diff, no write
 *   node .opencode/bin/refresh-project.js --check      # exit 0 if up to date, 1 if stale
 *   node .opencode/bin/refresh-project.js --status     # show freshness + summary, no write
 *   node .opencode/bin/refresh-project.js --auto       # silent write, only logs changes
 *   node .opencode/bin/refresh-project.js --help       # this help
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

const CWD = process.cwd();
const ARGS = process.argv.slice(2);
const DRY_RUN = ARGS.includes('--dry-run');
const CHECK_ONLY = ARGS.includes('--check');
const STATUS_ONLY = ARGS.includes('--status');
const AUTO = ARGS.includes('--auto');
const STALE_DAYS = 7;

if (ARGS.includes('--help') || ARGS.includes('-h')) {
  console.log(`Usage:
  node .opencode/bin/refresh-project.js              # scan + write
  node .opencode/bin/refresh-project.js --dry-run    # scan + show diff, no write
  node .opencode/bin/refresh-project.js --check      # exit 0 if up to date, 1 if stale
  node .opencode/bin/refresh-project.js --status     # show freshness + summary, no write
  node .opencode/bin/refresh-project.js --auto       # silent write, only log changes
  node .opencode/bin/refresh-project.js --help       # this help

Scans: package.json, pubspec.yaml, pyproject.toml, requirements.txt, setup.py,
       Cargo.toml, go.mod, *.csproj, *.sln, pom.xml, build.gradle*, index.html,
       README.*.md, tsconfig.json, turbo.json, nx.json, pnpm-workspace.yaml,
       eslint config, prettier config, test config, CI dirs, Dockerfile,
       docker-compose*.yml, .env.example, .env.sample
Writes: docs/PROJECT.md (backup at docs/PROJECT.md.bak.<ts>)

Sections regenerated: Identity, Stack, Tooling, Directory Layout, License, Entry Points
Sections preserved: Non-Negotiables, Architecture Notes, Open Questions (manual edits kept)
`);
  process.exit(0);
}

const HOME = os.homedir();
const PROJECT_MD = path.join(CWD, 'docs', 'PROJECT.md');
const BACKUP_MD = path.join(CWD, 'docs', `PROJECT.md.bak.${Date.now()}`);

function exists(p) { return fs.existsSync(p); }
function read(p) { try { return fs.readFileSync(p, 'utf8'); } catch { return ''; } }
function readJSON(p) { try { return JSON.parse(read(p)); } catch { return null; } }
function readYAML(p) {
  // Lightweight YAML parser for pubspec.yaml / pyproject.toml
  const txt = read(p);
  if (!txt) return null;
  const out = {};
  for (const line of txt.split('\n')) {
    const m = line.match(/^([\w-]+):\s*(.+)$/);
    if (m) out[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
  }
  return out;
}

// El pack no tiene package.json en la raiz a proposito (regla cero-deps): su
// manifiesto vive en .opencode/package.json y los agents delatan el layout.
const PACK_MANIFEST = path.join(CWD, '.opencode', 'package.json');

function isPack() {
  // Cualquier proyecto real acaba teniendo .opencode/ tras instalar el pack:
  // lo que distingue al pack es su instalador en la raiz y la ausencia de
  // manifiesto propio (package.json, pubspec.yaml, pyproject.toml, ...).
  if (exists('package.json') || !exists('init-opencode.js')) return false;
  return exists(path.join('.opencode', 'agents')) && exists(PACK_MANIFEST);
}

function manifest() {
  if (exists('package.json')) return readJSON('package.json');
  if (isPack()) return readJSON(PACK_MANIFEST);
  return null;
}

function detectType() {
  if (isPack()) return 'opencode-pack';
  if (exists('pubspec.yaml')) return 'flutter-app';
  if (exists('package.json')) {
    const pkg = readJSON('package.json');
    if (pkg && pkg.workspaces) return 'node-monorepo';
    if (pkg && pkg.dependencies && pkg.dependencies['next']) return 'web-app';
    if (pkg && pkg.dependencies && pkg.dependencies['express']) return 'api-service';
    if (pkg && pkg.bin) return 'cli';
    return 'node-app';
  }
  if (exists('turbo.json') || exists('nx.json') || exists('pnpm-workspace.yaml')) return 'node-monorepo';
  if (exists('pyproject.toml') || exists('setup.py')) return 'python-app';
  if (exists('Cargo.toml')) return 'rust-app';
  if (exists('go.mod')) return 'go-app';
  if (exists('pom.xml') || exists('build.gradle')) return 'java-app';
  if (exists('index.html')) return 'web-app';
  return 'unknown';
}

function detectName() {
  if (isPack()) return path.basename(CWD);
  if (exists('package.json')) {
    const pkg = readJSON('package.json');
    if (pkg && pkg.name) return pkg.name;
  }
  if (exists('pubspec.yaml')) {
    const pub = readYAML('pubspec.yaml');
    if (pub && pub.name) return pub.name;
  }
  if (exists('pyproject.toml')) {
    const py = readYAML('pyproject.toml');
    if (py && py.name) return py.name;
  }
  if (exists('Cargo.toml')) {
    const cargo = readYAML('Cargo.toml');
    if (cargo && cargo.name) return cargo.name;
  }
  if (exists('go.mod')) {
    const go = read('go.mod');
    const m = go.match(/^module\s+(\S+)/m);
    if (m) return m[1].split('/').pop();
  }
  return path.basename(CWD);
}

function detectDescription() {
  if (exists('README.md')) {
    const m = read('README.md').match(/^#\s+.+?\n+(.+?)(\n\n|\n#)/);
    if (m) return m[1].trim();
  }
  if (exists('package.json')) {
    const pkg = readJSON('package.json');
    if (pkg && pkg.description) return pkg.description;
  }
  if (exists('pubspec.yaml')) {
    const pub = readYAML('pubspec.yaml');
    if (pub && pub.description) return pub.description;
  }
  return '(no description)';
}

function detectStack(type) {
  const stack = { language: '?', framework: '?', runtime: '?', package_manager: '?' };
  if (exists('package.json')) {
    const pkg = readJSON('package.json') || {};
    stack.language = exists('tsconfig.json') ? 'TypeScript' : 'JavaScript';
    const deps = pkg.dependencies || {};
    const fw = [];
    if (deps['next']) fw.push(`Next.js ${deps['next']}`);
    if (deps['react'] && !deps['next']) fw.push(`React ${deps['react']}`);
    if (deps['vue']) fw.push(`Vue ${deps['vue']}`);
    if (deps['svelte']) fw.push(`Svelte ${deps['svelte']}`);
    if (deps['@angular/core']) fw.push(`Angular ${deps['@angular/core']}`);
    if (deps['express']) fw.push(`Express ${deps['express']}`);
    if (deps['fastify']) fw.push(`Fastify ${deps['fastify']}`);
    if (deps['koa']) fw.push(`Koa ${deps['koa']}`);
    if (deps['hono']) fw.push(`Hono ${deps['hono']}`);
    if (deps['@nestjs/core']) fw.push(`NestJS ${deps['@nestjs/core']}`);
    if (deps['electron']) fw.push(`Electron ${deps['electron']}`);
    stack.framework = fw.length ? fw.join(' + ') : '(none)';
    stack.runtime = pkg.engines && pkg.engines.node ? `Node ${pkg.engines.node}` : 'Node';
    stack.package_manager = exists('pnpm-lock.yaml') ? 'pnpm' :
                           exists('yarn.lock') ? 'yarn' :
                           exists('bun.lockb') ? 'bun' :
                           exists('bun.lock') ? 'bun' : 'npm';
  } else if (isPack()) {
    const pkg = manifest() || {};
    stack.language = 'JavaScript/TypeScript';
    stack.framework = 'opencode (agents, commands, skills, plugins)';
    stack.runtime = pkg.engines && pkg.engines.node ? `Node ${pkg.engines.node}` : 'Node';
    stack.package_manager = 'ninguno (cero dependencias)';
  } else if (exists('pubspec.yaml')) {
    const pub = readYAML('pubspec.yaml') || {};
    stack.language = 'Dart';
    stack.framework = 'Flutter';
    stack.runtime = 'Dart SDK';
    stack.package_manager = 'pub';
  } else if (exists('pyproject.toml')) {
    stack.language = 'Python';
    stack.package_manager = exists('poetry.lock') ? 'poetry' :
                           exists('uv.lock') ? 'uv' :
                           exists('Pipfile.lock') ? 'pipenv' : 'pip';
  } else if (exists('Cargo.toml')) {
    stack.language = 'Rust';
    stack.package_manager = 'cargo';
  } else if (exists('go.mod')) {
    stack.language = 'Go';
    stack.package_manager = 'go mod';
  } else if (exists('pom.xml')) {
    stack.language = 'Java';
    stack.package_manager = 'maven';
  } else if (exists('build.gradle')) {
    stack.language = 'Kotlin/Java';
    stack.package_manager = 'gradle';
  }
  return stack;
}

function detectTypeScriptStrict() {
  if (!exists('tsconfig.json')) return null;
  const txt = read('tsconfig.json');
  const strictMatch = txt.match(/"strict":\s*true/);
  if (strictMatch) return true;
  // also check via extends or compilerOptions block
  const blockMatch = txt.match(/"strict":\s*(true|false)/);
  if (blockMatch) return blockMatch[1] === 'true';
  return false;
}

function detectMonorepo(stack) {
  if (exists('turbo.json')) return 'Turbo';
  if (exists('nx.json')) return 'Nx';
  if (exists('pnpm-workspace.yaml')) return 'pnpm workspaces';
  if (exists('package.json')) {
    const pkg = readJSON('package.json');
    if (pkg && pkg.workspaces) {
      if (Array.isArray(pkg.workspaces)) return 'npm workspaces';
      if (pkg.workspaces.packages) return 'yarn workspaces';
    }
  }
  return null;
}

function detectTestRunner() {
  if (exists('vitest.config.ts') || exists('vitest.config.js')) return 'vitest';
  if (exists('jest.config.js') || exists('jest.config.ts') || exists('jest.config.cjs')) return 'jest';
  if (exists('playwright.config.ts') || exists('playwright.config.js')) return 'playwright';
  if (exists('pytest.ini') || exists('conftest.py')) return 'pytest';
  if (exists('phpunit.xml') || exists('phpunit.xml.dist')) return 'phpunit';
  // check package.json scripts
  if (exists('package.json')) {
    const pkg = readJSON('package.json') || {};
    const scripts = pkg.scripts || {};
    if (scripts.test) {
      if (scripts.test.includes('vitest')) return 'vitest';
      if (scripts.test.includes('jest')) return 'jest';
      if (scripts.test.includes('mocha')) return 'mocha';
      if (scripts.test.includes('ava')) return 'ava';
      return 'npm test (custom)';
    }
  }
  return null;
}

function detectCoverage() {
  if (exists('c8.config.json') || exists('.c8rc.json')) return 'c8';
  if (exists('nyc.config.js') || exists('.nycrc')) return 'nyc';
  if (exists('vitest.config.ts') || exists('vitest.config.js')) return 'vitest --coverage';
  if (exists('coverage/')) return 'coverage/ dir present';
  if (exists('codecov.yml') || exists('.codecov.yml')) return 'codecov';
  return null;
}

function detectLinter() {
  if (exists('eslint.config.js') || exists('eslint.config.mjs') || exists('eslint.config.cjs')) return 'eslint (flat config)';
  if (exists('.eslintrc') || exists('.eslintrc.json') || exists('.eslintrc.js') || exists('.eslintrc.yml')) return 'eslint';
  if (exists('biome.json') || exists('biome.jsonc')) return 'biome';
  if (exists('ruff.toml') || exists('.ruff.toml')) return 'ruff';
  if (exists('.pylintrc')) return 'pylint';
  if (exists('.golangci.yml') || exists('.golangci.yaml')) return 'golangci-lint';
  if (exists('clippy.toml')) return 'clippy';
  return null;
}

function detectFormatter() {
  if (exists('.prettierrc') || exists('.prettierrc.json') || exists('.prettierrc.js') ||
      exists('.prettierrc.yml') || exists('prettier.config.js') || exists('prettier.config.cjs')) return 'prettier';
  if (exists('biome.json') || exists('biome.jsonc')) return 'biome';
  if (exists('black.toml') || exists('pyproject.toml')) {
    const py = readYAML('pyproject.toml');
    if (py && (py['black'] || (py.tool && py.tool.black))) return 'black';
  }
  if (exists('.rustfmt.toml')) return 'rustfmt';
  if (exists('.gofmt')) return 'gofmt';
  return null;
}

function detectCI() {
  const cis = [];
  if (exists('.github/workflows')) {
    const wf = fs.readdirSync('.github/workflows').filter(f => f.endsWith('.yml') || f.endsWith('.yaml'));
    if (wf.length) cis.push(`GitHub Actions (${wf.length})`);
  }
  if (exists('.gitlab-ci.yml')) cis.push('GitLab CI');
  if (exists('.circleci/config.yml')) cis.push('CircleCI');
  if (exists('.travis.yml')) cis.push('Travis CI');
  if (exists('Jenkinsfile')) cis.push('Jenkins');
  return cis.length ? cis.join(', ') : null;
}

function detectContainer() {
  const containers = [];
  if (exists('Dockerfile')) containers.push('Dockerfile');
  if (exists('docker-compose.yml') || exists('docker-compose.yaml')) containers.push('docker-compose');
  if (exists('Dockerfile.dev')) containers.push('Dockerfile.dev');
  return containers.length ? containers.join(', ') : null;
}

function parseEnvVars() {
  const files = ['.env.example', '.env.sample', '.env.template'];
  for (const f of files) {
    if (!exists(f)) continue;
    const txt = read(f);
    const vars = [];
    for (const line of txt.split('\n')) {
      const m = line.match(/^([A-Z][A-Z0-9_]+)\s*=/);
      if (m) vars.push(m[1]);
    }
    return vars.length ? `${vars.length} (${vars.slice(0, 8).join(', ')}${vars.length > 8 ? '…' : ''})` : null;
  }
  return null;
}

function detectEntryPoints() {
  if (isPack()) {
    const eps = [];
    if (exists('init-opencode.js')) eps.push('init-opencode.js');
    if (exists(path.join('.opencode', 'bin'))) eps.push('.opencode/bin/');
    if (exists(path.join('.opencode', 'plugins'))) eps.push('.opencode/plugins/');
    return eps;
  }
  const entries = [];
  const candidates = [
    'src/index.ts', 'src/index.js', 'src/main.ts', 'src/main.js',
    'index.ts', 'index.js', 'main.ts', 'main.js',
    'app.ts', 'app.js', 'server.ts', 'server.js',
    'cmd/main.go', 'src/lib.rs', 'src/main.rs',
    'lib/index.ts', 'lib/index.js',
  ];
  for (const c of candidates) {
    if (exists(c)) entries.push(c);
  }
  // check package.json main/bin
  if (exists('package.json')) {
    const pkg = readJSON('package.json') || {};
    if (pkg.main && !entries.includes(pkg.main)) entries.push(`${pkg.main} (main)`);
    if (pkg.bin) {
      if (typeof pkg.bin === 'string') entries.push(`${pkg.bin} (bin)`);
      else Object.values(pkg.bin).forEach(b => { if (!entries.includes(b)) entries.push(`${b} (bin)`); });
    }
  }
  return entries.length ? entries : null;
}

function detectConventions() {
  const conv = [];
  if (exists('.eslintrc') || exists('.eslintrc.json') || exists('eslint.config.js')) conv.push('eslint');
  if (exists('.prettierrc') || exists('prettier.config.js')) conv.push('prettier');
  if (exists('tsconfig.json')) conv.push('TypeScript');
  if (exists('jest.config.js') || exists('jest.config.ts')) conv.push('jest');
  if (exists('vitest.config.ts') || exists('vitest.config.js')) conv.push('vitest');
  if (exists('pytest.ini') || exists('pyproject.toml')) {
    const py = readYAML('pyproject.toml');
    if (py && (py.tool && (py.tool.pytest || py['pytest-runner']))) conv.push('pytest');
  }
  if (exists('.github/workflows')) conv.push('GitHub Actions CI');
  return conv.length ? conv.join(', ') : 'free-form';
}

function listKeyDirs() {
  if (isPack()) {
    return ['.opencode', '.agents', 'docs'].filter(d => exists(d));
  }
  const dirs = ['src', 'lib', 'app', 'pkg', 'cmd', 'internal', 'modules', 'components', 'pages', 'test', 'tests', 'docs'];
  return dirs.filter(d => exists(d));
}

function detectLicense() {
  for (const f of ['LICENSE', 'LICENSE.md', 'LICENSE.txt']) {
    if (exists(f)) {
      const c = read(f).toLowerCase();
      if (c.includes('mit license')) return 'MIT';
      if (c.includes('apache license')) return 'Apache-2.0';
      if (c.includes('bsd')) return 'BSD';
      if (c.includes('gpl')) return 'GPL';
      return 'custom (see LICENSE)';
    }
  }
  return 'unspecified';
}

function generate() {
  const type = detectType();
  const name = detectName();
  const desc = detectDescription();
  const stack = detectStack(type);
  const tsStrict = detectTypeScriptStrict();
  const monorepo = detectMonorepo(stack);
  const test = detectTestRunner();
  const coverage = detectCoverage();
  const linter = detectLinter();
  const formatter = detectFormatter();
  const ci = detectCI();
  const container = detectContainer();
  const envVars = parseEnvVars();
  const entryPoints = detectEntryPoints();
  const conv = detectConventions();
  const dirs = listKeyDirs();
  const license = detectLicense();
  const date = new Date().toISOString().slice(0, 10);

  return `# Project Context

> Auto-refreshed by refresh-project.js on ${date}.
> Source of truth: actual project files (package.json, pubspec.yaml, etc.)
> Edit \`Non-Negotiables\` / \`Architecture Notes\` / \`Open Questions\` sections manually — they are preserved across refreshes.

## Identity
- **Name**: ${name}
- **Type**: ${type}
- **Description**: ${desc}

## Stack
- **Language**: ${stack.language}
- **Framework**: ${stack.framework}
- **Runtime / Build**: ${stack.runtime || '?'}
- **Package manager**: ${stack.package_manager}
${tsStrict !== null ? `- **TypeScript strict**: ${tsStrict ? 'yes' : 'no (strict not enabled)'}` : ''}
${monorepo ? `- **Monorepo**: ${monorepo}` : ''}

## Tooling
- **Test runner**: ${test || '(not detected)'}
- **Coverage**: ${coverage || '(not detected)'}
- **Linter**: ${linter || '(not detected)'}
- **Formatter**: ${formatter || '(not detected)'}
- **CI**: ${ci || '(not detected)'}
- **Container**: ${container || '(not detected)'}
- **Env vars**: ${envVars || '(not detected)'}

## Conventions
${conv}

## Entry Points
${entryPoints ? entryPoints.map(e => `- \`${e}\``).join('\n') : '- (no standard entry point detected)'}

## Directory Layout
${dirs.length ? dirs.map(d => `- \`${d}/\``).join('\n') : '(no standard layout detected)'}

## License
${license}

## Non-Negotiables
- (manually edited — preserve across refreshes)

## Architecture Notes
- (manually edited — preserve across refreshes)

## Open Questions
- (manually edited — preserve across refreshes)
`;
}

function simpleDiff(oldText, newText) {
  const oldLines = oldText.split('\n');
  const newLines = newText.split('\n');
  const max = Math.max(oldLines.length, newLines.length);
  const diff = [];
  for (let i = 0; i < max; i++) {
    if (oldLines[i] !== newLines[i]) {
      if (oldLines[i] !== undefined) diff.push(`- L${i + 1}: ${oldLines[i]}`);
      if (newLines[i] !== undefined) diff.push(`+ L${i + 1}: ${newLines[i]}`);
    }
  }
  return diff.length ? diff.join('\n') : '(no changes)';
}

// ---- refresco por marcador ----------------------------------------------
// docs/PROJECT.md declara su propio contrato en la cabecera:
//   <!-- auto:... -->       se regenera
//   <!-- auto+manual -->    se refrescan los valores detectados, se conservan el resto
//   <!-- manual -->         se conserva tal cual
//   <!-- auto-managed -->   append-only (Recent Activity)
// Antes esto reemplazaba el doc entero y se comia toda seccion que el template
// no supiera emitir (Build & Run, Domain Map, Dependencies, Glossary, ...).
const AUTO_MARK = /^<!--\s*(auto|auto\+manual)\b/i;
const OVERRIDE_MARK = /^<!--\s*override\b/i;
const DETAIL_MARK = /^<!--\s*auto\+manual\b/i;

const PACK_BUILD_RUN = {
  Install: '`node init-opencode.js --project-path <ruta>`',
  'Dry run': '`node init-opencode.js --dry-run --project-path <ruta>`',
  Perfil: '`node .opencode/bin/project-profile.js <ruta>`',
  Tests: '`node .opencode/bin/smoke-test.js`',
  'Tests del instalador': '`node .opencode/bin/installer-test.js`',
};

const PACK_DEPS = '- Sin dependencias npm: los plugins del pack son locales (API V2) y `node_modules/` no hace falta.';

function repoLine() {
  const cfg = read(path.join('.git', 'config'));
  // Solo el remoto origin: el config puede tener otros (upstream, espejos) y
  // el primero no es necesariamente el del proyecto.
  const block = /\[remote "origin"\]([\s\S]*?)(?=\n\[|$)/.exec(cfg);
  const m = block && /url\s*=\s*(\S+)/.exec(block[1]);
  return m ? `- **Repo**: ${m[1].replace(/\.git$/, '')}` : null;
}

function splitDoc(text) {
  const lines = text.split('\n');
  const blocks = [];
  let cur = { title: null, lines: [] };
  for (const line of lines) {
    const m = /^##\s+(.+?)\s*$/.exec(line);
    if (m) { blocks.push(cur); cur = { title: m[1], lines: [line] }; }
    else cur.lines.push(line);
  }
  blocks.push(cur);
  return blocks;
}

function buildRunMap() {
  if (isPack()) return PACK_BUILD_RUN;
  const pkg = manifest();
  const scripts = (pkg && pkg.scripts) || {};
  const map = {};
  map.Install = '`npm install`';
  if (scripts.dev) map.Dev = '`npm run dev`';
  if (scripts.start) map.Start = '`npm run start`';
  if (scripts.test) map.Test = '`npm test`';
  if (scripts.lint) map.Lint = '`npm run lint`';
  if (scripts.build) map.Build = '`npm run build`';
  return map;
}

function conventionsMap() {
  const map = {};
  const test = detectTestRunner();
  const linter = detectLinter();
  const formatter = detectFormatter();
  const ci = detectCI();
  if (test) map['Test runner'] = test;
  if (linter) map.Linter = linter;
  if (formatter) map.Formatter = formatter;
  if (ci) map.CI = ci;
  return map;
}

function dependenciesBody() {
  if (isPack()) return PACK_DEPS;
  const pkg = manifest();
  if (!pkg) return null;
  const deps = Object.entries(pkg.dependencies || {});
  if (!deps.length) return '- Sin dependencias declaradas.';
  return deps.slice(0, 10).map(([k, v]) => `- **${k}** \`${v}\``).join('\n');
}

// Refresca solo las claves que sabemos detectar y conserva las demas lineas.
function keyedBody(oldLines, map) {
  const detected = Object.keys(map);
  if (!detected.length) return null;
  const used = new Set();
  const out = [];
  for (const raw of oldLines) {
    const line = raw.replace(/\s+$/, '');
    const m = /^-\s+\*\*(.+?)\*\*\s*:\s*(.*)$/.exec(line.trim());
    if (!m) continue;
    const key = m[1];
    const value = m[2].trim();
    const bare = value.replace(/`/g, '').trim();
    const placeholder = bare === '' || bare === '—' || bare === '-' || bare === '(not detected)';
    if (Object.prototype.hasOwnProperty.call(map, key)) {
      out.push(`- **${key}**: ${map[key]}`);
      used.add(key);
    } else if (!placeholder) {
      out.push(line.trim());
    }
  }
  for (const k of detected) if (!used.has(k)) out.push(`- **${k}**: ${map[k]}`);
  return out.length ? out.join('\n') : null;
}

function mergeRefresh(oldText, generatedText) {
  const gen = splitDoc(generatedText).filter(b => b.title);
  // El remoto sale de .git/config: el template no lo puede adivinar y perderlo
  // borraria un dato que el doc ya tenia.
  const repo = repoLine();
  if (repo) {
    for (const b of gen) if (b.title === 'Identity') b.lines.splice(2, 0, repo);
  }
  const genByTitle = new Map(gen.map(b => [b.title, b.lines.slice(1).join('\n').trim()]));

  const extras = { 'Build & Run': buildRunMap(), Conventions: conventionsMap() };
  const depBody = dependenciesBody();
  if (depBody) extras.Dependencies = depBody;

  const old = splitDoc(oldText);
  const seen = new Set();
  const out = [];

  for (const block of old) {
    if (!block.title) { out.push(block.lines.join('\n')); continue; }
    const heading = block.lines[0];
    const body = block.lines.slice(1);

    // Marcadores al inicio del cuerpo (auto:/manual/auto+manual/conditional).
    const markers = [];
    for (const l of body) {
      if (/^\s*<!--/.test(l)) {
        if (!OVERRIDE_MARK.test(l.trim())) markers.push(l.replace(/\s+$/, ''));
        continue;
      }
      if (l.trim() === '') continue;
      break;
    }
    const isAuto = markers.some(m => AUTO_MARK.test(m.trim()));

    // Overrides del usuario bajo "<!-- Override ... -->" (secciones auto+manual).
    const ovIdx = body.findIndex(l => OVERRIDE_MARK.test(l.trim()));
    let overrideTail = null;
    if (ovIdx >= 0) {
      const tail = body.slice(ovIdx + 1).filter(l => l.trim() !== '');
      if (tail.length) overrideTail = { marker: body[ovIdx].replace(/\s+$/, ''), lines: tail };
    }

    const rawBody = body.slice(markers.length, ovIdx >= 0 ? ovIdx : body.length);
    const extra = extras[block.title];
    const genString = genByTitle.get(block.title);

    let newBody = null;
    if (extra && typeof extra === 'object') newBody = keyedBody(rawBody, extra);
    else if (typeof extra === 'string') newBody = extra;
    else if (genString !== undefined) newBody = genString;

    if (isAuto && newBody) {
      seen.add(block.title);
      const parts = [heading];
      if (markers.length) parts.push(markers.join('\n'));
      parts.push(newBody.trim());
      if (ovIdx >= 0) {
        parts.push(body[ovIdx].replace(/\s+$/, ''));
        if (overrideTail) parts.push(overrideTail.lines.join('\n'));
      }
      parts.push('');
      out.push(parts.join('\n'));
    } else {
      out.push(block.lines.join('\n'));
    }
  }

  // Secciones auto que el doc aun no tiene (doc viejo + template nuevo).
  for (const b of gen) {
    if (seen.has(b.title) || !AUTO_MARK.test((b.lines[1] || '').trim())) continue;
    if (['Identity', 'Stack', 'Tooling', 'Entry Points', 'Directory Layout'].includes(b.title)) {
      out.push(b.lines.join('\n'));
    }
  }

  return out.join('\n');
}

function daysSince(dateStr) {
  // parse "2026-07-14" format
  const m = dateStr && dateStr.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  const then = new Date(`${m[1]}-${m[2]}-${m[3]}`);
  const now = new Date();
  return Math.floor((now - then) / (1000 * 60 * 60 * 24));
}

const newContentRaw = generate();
const oldContent = read(PROJECT_MD);
const newContent = oldContent ? mergeRefresh(oldContent, newContentRaw) : newContentRaw;

// --status: show freshness + summary, no write
if (STATUS_ONLY) {
  if (!oldContent) {
    console.log('STATUS: missing');
    console.log('  docs/PROJECT.md does not exist. Run refresh-project.js to create it.');
    process.exit(1);
  }
  const dateMatch = oldContent.match(/refresh-project\.js on (\d{4}-\d{2}-\d{2})/);
  const age = dateMatch ? daysSince(dateMatch[1]) : null;
  const fresh = oldContent === newContent;
  if (fresh) {
    console.log(`STATUS: fresh${age !== null ? ` (${age} day${age === 1 ? '' : 's'} old)` : ''}`);
    process.exit(0);
  } else {
    console.log(`STATUS: stale${age !== null ? ` (${age} day${age === 1 ? '' : 's'} old)` : ''}`);
    console.log('  Run refresh-project.js to update.');
    process.exit(1);
  }
}

if (CHECK_ONLY) {
  if (oldContent === newContent) {
    console.log('OK: PROJECT.md is up to date');
    process.exit(0);
  } else {
    console.log('STALE: PROJECT.md needs refresh (run refresh-project.js)');
    process.exit(1);
  }
}

if (DRY_RUN) {
  console.log('--- DRY RUN: would write to docs/PROJECT.md ---');
  console.log('');
  if (oldContent === newContent) {
    console.log('(no changes — already up to date)');
  } else {
    console.log('--- DIFF ---');
    console.log(simpleDiff(oldContent, newContent));
  }
  process.exit(0);
}

if (oldContent === newContent) {
  if (!AUTO) {
    console.log('PROJECT.md is already up to date. Nothing to do.');
  } else {
    console.log('[auto] PROJECT.md already up to date, skipping');
  }
  process.exit(0);
}

// Un proyecto sin docs/ no tiene donde escribir: el instalador la crea, pero
// el script tambien debe poder correr solo sobre un repo cualquiera.
fs.mkdirSync(path.dirname(PROJECT_MD), { recursive: true });

if (oldContent) {
  fs.copyFileSync(PROJECT_MD, BACKUP_MD);
  if (!AUTO) console.log(`Backup: ${path.relative(CWD, BACKUP_MD)}`);
}
fs.writeFileSync(PROJECT_MD, newContent);

if (AUTO) {
  console.log(`[auto] Updated: docs/PROJECT.md`);
  const added = (newContent.match(/^/gm) || []).length;
  const removed = oldContent ? (oldContent.match(/^/gm) || []).length : 0;
  console.log(`[auto] Lines: ${oldContent ? removed : 0} -> ${added}`);
} else {
  console.log(`Updated: ${path.relative(CWD, PROJECT_MD)}`);
  console.log('');
  console.log('--- REPORT ---');
  const diff = simpleDiff(oldContent, newContent);
  const added = (diff.match(/^\+/gm) || []).length;
  const removed = (diff.match(/^-/gm) || []).length;
  console.log(`Lines added: ${added}`);
  console.log(`Lines removed: ${removed}`);
  console.log('');
  console.log('Sections regenerated: Identity, Stack, Tooling, Conventions, Entry Points, Directory Layout, License');
  console.log('Sections preserved: Non-Negotiables, Architecture Notes, Open Questions (manual edits kept)');
}
