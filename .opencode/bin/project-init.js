#!/usr/bin/env node
/**
 * project-init.js - generate / refresh docs/PROJECT.md from the pack template
 *
 * Source of truth: pack-resident `.opencode/templates/PROJECT.md.template` (v2.1).
 * Detects data from 5 sources: project files, git, docs/, pack catalog,
 * opencode-pack heuristic. Manual sections (Non-Negotiables, Architecture
 * Notes, Open Questions, Glossary) and user overrides (Build & Run,
 * Conventions) are preserved across refreshes.
 *
 * Usage:
 *   node .opencode/bin/project-init.js --init         # create PROJECT.md (overwrite)
 *   node .opencode/bin/project-init.js --refresh      # re-detect, keep manual sections
 *   node .opencode/bin/project-init.js --status       # show freshness, no write
 *   node .opencode/bin/project-init.js --check        # exit 1 if stale/missing
 *   node .opencode/bin/project-init.js --sparse-check # exit 0 if PROJECT.md is sparse (>50% placeholders)
 *   node .opencode/bin/project-init.js --ensure       # check + bootstrap if needed (auto-run)
 *   node .opencode/bin/project-init.js --dry-run      # print to stdout, no write
 *   node .opencode/bin/project-init.js --append-event TYPE NAME [meta]
 *
 * Modes are mutually exclusive (--init takes precedence if both given).
 * --ensure: AGENTS.md behavior #9 trigger. Runs --check; if missing → --init;
 * if stale → --refresh. Always exits 0 (the ensure succeeds if the doc is
 * fresh OR after bootstrap). Output goes to stderr so it doesn't pollute
 * agent stdout.
 *
 * Zero deps, CommonJS, Windows + POSIX.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.join(__dirname, '..', '..');
const TEMPLATE = path.join(ROOT, '.opencode', 'templates', 'PROJECT.md.template');
const OUT = path.join(ROOT, 'docs', 'PROJECT.md');
const AGENTS_DIR = path.join(ROOT, '.opencode', 'agents');
const COMMANDS_DIR = path.join(ROOT, '.opencode', 'commands');
const SKILLS_DIR = path.join(ROOT, '.agents', 'skills');
const BIN_DIR = path.join(__dirname); // .opencode/bin
const PLUGINS_DIR = path.join(ROOT, '.opencode', 'plugins');
const DOCS_DIR = path.join(ROOT, 'docs');

// ---------- arg parsing ----------

function parseArgs(argv) {
  const args = argv.slice(2);
  const out = { _: [], mode: null, dryRun: false, force: false };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--init') out.mode = 'init';
    else if (a === '--refresh') out.mode = 'refresh';
    else if (a === '--status') out.mode = 'status';
    else if (a === '--check') out.mode = 'check';
    else if (a === '--sparse-check') out.mode = 'sparse-check';
    else if (a === '--ensure') out.mode = 'ensure';
    else if (a === '--dry-run') out.dryRun = true;
    else if (a === '--force' || a === '-f') out.force = true;
    else if (a === '--append-event') {
      out.mode = 'append';
      out.appendType = args[++i];
      out.appendName = args[++i];
      out.appendMeta = args[++i] || '';
    } else if (a === '--help' || a === '-h') {
      out.help = true;
    } else {
      out._.push(a);
    }
  }
  return out;
}

// ---------- utils ----------

function readIfExists(p) {
  try { return fs.readFileSync(p, 'utf8'); } catch { return null; }
}

function readJson(p) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; }
}

function listDir(p, filter = () => true) {
  if (!fs.existsSync(p)) return [];
  return fs.readdirSync(p).filter(filter);
}

function tryReadFirst(p, candidates) {
  for (const c of candidates) {
    const f = path.join(p, c);
    if (fs.existsSync(f)) return readIfExists(f);
  }
  return null;
}

function safeExec(cmd) {
  try { return execSync(cmd, { cwd: ROOT, encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }).trim(); }
  catch { return null; }
}

function ageDays(isoDate) {
  if (!isoDate) return Infinity;
  const then = new Date(isoDate).getTime();
  if (isNaN(then)) return Infinity;
  return (Date.now() - then) / (1000 * 60 * 60 * 24);
}

function todayISO() { return new Date().toISOString().slice(0, 10); }
function nowISO() { return new Date().toISOString(); }

// ---------- detection ----------

const MANIFEST_FILES = [
  { name: 'package.json',  type: 'package.json' },
  { name: 'pyproject.toml', type: 'pyproject' },
  { name: 'Cargo.toml',    type: 'cargo' },
  { name: 'go.mod',        type: 'go' },
  { name: 'pubspec.yaml',  type: 'pubspec' },
  { name: 'pom.xml',       type: 'maven' },
  { name: 'build.gradle',  type: 'gradle' },
  { name: '*.csproj',      type: 'csproj' },
];

function detectManifest(isPack) {
  for (const m of MANIFEST_FILES) {
    if (m.name.includes('*')) {
      // glob-ish: list ./*.csproj (root only — never look inside .opencode/ for app manifests)
      const matches = listDir(ROOT, f => f.endsWith('.csproj'));
      if (matches.length > 0) {
        return { type: m.type, file: matches[0], data: readJson(path.join(ROOT, matches[0])) || {} };
      }
    } else {
      // If this IS the opencode pack itself, check root first then .opencode/ (so the pack's
      // own .opencode/package.json is found). If this is a user project with the pack installed,
      // check root ONLY — never look inside .opencode/ for the user's app manifest, because
      // .opencode/ contains the installed PACK, not the user's app.
      const roots = isPack
        ? [ROOT, path.join(ROOT, '.opencode')]
        : [ROOT];
      for (const r of roots) {
        const p = path.join(r, m.name);
        if (fs.existsSync(p)) {
          if (m.type === 'package.json' || m.type === 'csproj') {
            return { type: m.type, file: path.relative(ROOT, p), data: readJson(p) || {} };
          }
          return { type: m.type, file: path.relative(ROOT, p), data: readIfExists(p) || '' };
        }
      }
    }
  }
  return null;
}

function hasUserManifest() {
  // A project is a USER project (not the opencode pack itself) if it has its own
  // app manifest at ROOT. .opencode/ may be installed for tooling, but that doesn't
  // make the project "the pack". Detection priority: pubspec.yaml > package.json
  // (root only) > pyproject > cargo > go.mod > pom > gradle > csproj.
  for (const m of MANIFEST_FILES) {
    if (m.name.includes('*')) {
      const matches = listDir(ROOT, f => f.endsWith('.csproj'));
      if (matches.length > 0) return true;
    } else {
      if (fs.existsSync(path.join(ROOT, m.name))) return true;
    }
  }
  return false;
}

function detectOpencodePack() {
  // Heuristic: .opencode/ + .agents/ + opencode.json + (AGENTS.md or opencode.jsonc)
  if (!fs.existsSync(path.join(ROOT, '.opencode'))) return false;
  if (!fs.existsSync(path.join(ROOT, '.agents'))) return false;
  if (!readIfExists(path.join(ROOT, 'opencode.json'))) return false;
  // If the project has its own user manifest, it's a USER project with the pack
  // installed — NOT the opencode pack itself. .opencode/ being present is not
  // enough signal: every project that installed the pack will have it.
  if (hasUserManifest()) return false;
  // At least one pack artifact
  return listDir(AGENTS_DIR, f => f.endsWith('.md')).length > 0
      || listDir(COMMANDS_DIR, f => f.endsWith('.md')).length > 0
      || listDir(SKILLS_DIR).length > 0;
}

// ---------- generic project inspectors (1.2.5: language-agnostic) ----------
// All these work for any stack: Flutter, Node, Python, PHP, Go, Rust, Java,
// static HTML, etc. No hardcoded framework lists in the calling code.

const SKIP_DIRS = new Set([
  'node_modules', '.git', 'build', 'dist', '.dart_tool', '__pycache__',
  'target', 'vendor', '.next', '.nuxt', 'Pods', 'ephemeral', '.gradle',
  '.idea', '.vscode', '.opencode', '.agents', 'docs',
]);

const DIR_PURPOSE = {
  'src': 'application code', 'lib': 'library code', 'app': 'application code',
  'bin': 'CLI binaries', 'tests': 'test suites', 'test': 'test suites',
  '__tests__': 'test suites', 'spec': 'test suites', 'docs': 'documentation',
  'scripts': 'dev scripts', 'public': 'static assets', 'static': 'static assets',
  'assets': 'static assets', 'config': 'configuration', 'migrations': 'DB migrations',
};

const LIB_SUBDIR_PURPOSE = {
  screens: 'UI screens', widgets: 'reusable widgets', models: 'domain models',
  state: 'state management', logic: 'business logic', theme: 'UI theme',
  views: 'view layer', components: 'UI components', controllers: 'controllers',
  services: 'service layer', providers: 'providers', routes: 'routes',
  pages: 'pages', layouts: 'layouts', helpers: 'helpers', utils: 'utilities',
  core: 'core domain', domain: 'domain layer', infrastructure: 'infrastructure',
};

function walkTopDirs(maxDepth = 2) {
  const results = [];
  function walk(dir, depth) {
    if (depth > maxDepth) return;
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      if (!e.isDirectory()) continue;
      if (SKIP_DIRS.has(e.name)) continue;
      if (depth === 0 && e.name.startsWith('.')) continue;
      const full = path.join(dir, e.name);
      const rel = path.relative(ROOT, full);
      let files = 0;
      try {
        files = fs.readdirSync(full).filter(f => {
          try { return fs.statSync(path.join(full, f)).isFile() && !f.startsWith('.'); }
          catch { return false; }
        }).length;
      } catch {}
      results.push({ rel, name: e.name, files });
      walk(full, depth + 1);
    }
  }
  walk(ROOT, 0);
  return results;
}

function detectDirPurpose(name, rel) {
  if (DIR_PURPOSE[name]) return DIR_PURPOSE[name];
  const seg = rel.split('/').pop();
  if (LIB_SUBDIR_PURPOSE[seg]) return LIB_SUBDIR_PURPOSE[seg];
  return null;
}

function detectLicense(manifest) {
  for (const f of ['LICENSE', 'LICENSE.md', 'LICENSE.txt', 'license', 'License']) {
    const p = path.join(ROOT, f);
    if (fs.existsSync(p)) {
      const content = readIfExists(p) || '';
      const m = content.match(/^(MIT|Apache-2\.0|BSD-3-Clause|BSD-2-Clause|GPL-3\.0|GPL-2\.0|MPL-2\.0|ISC|Unlicense)\b/im);
      if (m) return { name: m[1], source: f };
      const line1 = content.split('\n').find(l => l.trim() && !l.startsWith('//') && !l.startsWith('#'));
      if (line1) return { name: line1.replace(/^Copyright\s+(\d+\s+)?/i, '').replace(/\.$/, '').slice(0, 60).trim(), source: f };
    }
  }
  if (manifest && manifest.type === 'package.json') {
    const lic = manifest.data.license;
    if (lic) return { name: typeof lic === 'string' ? lic : (lic.type || 'see package.json'), source: 'package.json' };
  }
  if (manifest && manifest.type === 'pubspec') {
    const m = manifest.data.match(/^license\s*:\s*(\S+)/m);
    if (m) return { name: m[1].replace(/^["']|["']$/g, ''), source: 'pubspec.yaml' };
  }
  if (manifest && manifest.type === 'cargo') {
    const m = manifest.data.match(/^license\s*=\s*"([^"]+)"/m);
    if (m) return { name: m[1], source: 'Cargo.toml' };
  }
  if (manifest && manifest.type === 'pyproject') {
    const m = manifest.data.match(/^license\s*=\s*["']([^"']+)["']/m);
    if (m) return { name: m[1], source: 'pyproject.toml' };
  }
  return null;
}

const ENTRY_POINT_CANDIDATES = [
  { p: 'lib/main.dart', label: 'lib/main.dart (Flutter entry)' },
  { p: 'lib/app.dart', label: 'lib/app.dart (root widget)' },
  { p: 'src/main.ts', label: 'src/main.ts (Node entry)' },
  { p: 'src/main.js', label: 'src/main.js (Node entry)' },
  { p: 'src/index.ts', label: 'src/index.ts (Node entry)' },
  { p: 'src/index.js', label: 'src/index.js (Node entry)' },
  { p: 'src/App.tsx', label: 'src/App.tsx (React root)' },
  { p: 'src/App.jsx', label: 'src/App.jsx (React root)' },
  { p: 'app/page.tsx', label: 'app/page.tsx (Next.js app router)' },
  { p: 'app/layout.tsx', label: 'app/layout.tsx (Next.js app router)' },
  { p: 'pages/_app.tsx', label: 'pages/_app.tsx (Next.js pages router)' },
  { p: 'pages/index.tsx', label: 'pages/index.tsx (Next.js pages router)' },
  { p: 'main.go', label: 'main.go (Go entry)' },
  { p: 'cmd/main.go', label: 'cmd/main.go (Go entry)' },
  { p: 'main.py', label: 'main.py (Python entry)' },
  { p: '__main__.py', label: '__main__.py (Python module entry)' },
  { p: 'app.py', label: 'app.py (Python entry)' },
  { p: 'wsgi.py', label: 'wsgi.py (WSGI entry)' },
  { p: 'asgi.py', label: 'asgi.py (ASGI entry)' },
  { p: 'manage.py', label: 'manage.py (Django CLI)' },
  { p: 'src/main.rs', label: 'src/main.rs (Rust binary)' },
  { p: 'src/lib.rs', label: 'src/lib.rs (Rust library)' },
  { p: 'index.php', label: 'index.php (PHP entry)' },
  { p: 'public/index.php', label: 'public/index.php (PHP entry)' },
  { p: 'artisan', label: 'artisan (Laravel CLI)' },
  { p: 'index.html', label: 'index.html (static HTML)' },
  { p: 'public/index.html', label: 'public/index.html (static HTML)' },
];

function detectEntryPoints() {
  return ENTRY_POINT_CANDIDATES.filter(c => fs.existsSync(path.join(ROOT, c.p))).map(c => c.label);
}

function detectArchitecture(manifest) {
  const hints = [];
  if (manifest && manifest.type === 'package.json') {
    const all = { ...(manifest.data.dependencies || {}), ...(manifest.data.devDependencies || {}) };
    if (all['@nestjs/core']) hints.push('NestJS');
    if (all['next']) hints.push('Next.js');
    if (all['nuxt']) hints.push('Nuxt');
    if (all['gatsby']) hints.push('Gatsby');
    if (all['react']) hints.push('React');
    if (all['vue']) hints.push('Vue');
    if (all['@angular/core']) hints.push('Angular');
    if (all['svelte']) hints.push('Svelte');
    if (all['express']) hints.push('Express');
    if (all['fastify']) hints.push('Fastify');
    if (all['koa']) hints.push('Koa');
    if (all['redux'] || all['@reduxjs/toolkit']) hints.push('Redux');
    if (all['zustand']) hints.push('Zustand');
    if (all['mobx']) hints.push('MobX');
    if (all['@tanstack/react-query']) hints.push('TanStack Query');
    if (all['graphql'] || all['@apollo/client'] || all['urql']) hints.push('GraphQL');
    if (all['prisma'] || all['@prisma/client']) hints.push('Prisma');
    if (all['mongoose']) hints.push('Mongoose');
  }
  if (manifest && manifest.type === 'pubspec') {
    const ps = manifest.data;
    if (/^\s*flutter_bloc\s*:/m.test(ps)) hints.push('BLoC');
    if (/^\s*provider\s*:/m.test(ps)) hints.push('Provider');
    if (/^\s*flutter_riverpod\s*:|^\s*riverpod\s*:/m.test(ps)) hints.push('Riverpod');
    if (/^\s*get\s*:/m.test(ps)) hints.push('GetX');
    if (/^\s*hive\s*:/m.test(ps)) hints.push('Hive');
    if (/^\s*drift\s*:/m.test(ps)) hints.push('Drift');
    if (/^\s*dio\s*:/m.test(ps)) hints.push('Dio');
  }
  if (manifest && manifest.type === 'pyproject') {
    const py = manifest.data;
    if (/django/i.test(py)) hints.push('Django');
    if (/flask/i.test(py)) hints.push('Flask');
    if (/fastapi/i.test(py)) hints.push('FastAPI');
    if (/pyramid/i.test(py)) hints.push('Pyramid');
    if (/starlette/i.test(py)) hints.push('Starlette');
    if (/tornado/i.test(py)) hints.push('Tornado');
    if (/sqlalchemy/i.test(py)) hints.push('SQLAlchemy');
  }
  if (manifest && manifest.type === 'cargo') {
    const ct = manifest.data;
    if (/actix-web/.test(ct)) hints.push('Actix');
    if (/axum/.test(ct)) hints.push('Axum');
    if (/rocket/.test(ct)) hints.push('Rocket');
    if (/warp/.test(ct)) hints.push('Warp');
  }
  if (manifest && manifest.type === 'go') {
    const g = manifest.data;
    if (/gin-gonic\/gin/.test(g)) hints.push('Gin');
    if (/labstack\/echo/.test(g)) hints.push('Echo');
    if (/gofiber\/fiber/.test(g)) hints.push('Fiber');
    if (/go-chi\/chi/.test(g)) hints.push('Chi');
  }
  return hints;
}

function extractGlossary() {
  const terms = new Set();
  const candidates = ['lib', 'src', 'app', 'models', 'screens', 'widgets', 'views', 'components', 'services', 'core', 'domain'];
  const regexes = [
    /\bclass\s+(\w{4,})/g,
    /\bdef\s+(\w{4,})/g,
    /\bfunction\s+(\w{4,})/g,
    /\binterface\s+(\w{4,})/g,
    /\bconst\s+(\w{4,})\s*=\s*[\(\[]/g,
    /export\s+(?:default\s+)?(?:class|function|const)\s+(\w{4,})/g,
  ];
  const STOP = /^(Test|Mock|Stub|Fake|From|To|String|Int|Bool|True|False|NULL|None|State|Props|Config|Error|Data|Utils|Helper)$/;
  for (const d of candidates) {
    const dir = path.join(ROOT, d);
    if (!fs.existsSync(dir)) continue;
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { continue; }
    for (const f of entries.slice(0, 25)) {
      if (!f.isFile()) continue;
      if (!/\.(dart|ts|tsx|js|jsx|py|java|go)$/.test(f.name)) continue;
      const content = readIfExists(path.join(dir, f.name)) || '';
      if (content.length > 50000) continue;
      for (const re of regexes) {
        const reCopy = new RegExp(re.source, re.flags);
        let m;
        while ((m = reCopy.exec(content)) !== null) {
          const name = m[1];
          if (name && /^[A-Z]/.test(name) && !STOP.test(name)) {
            terms.add(name);
            if (terms.size >= 12) break;
          }
        }
        if (terms.size >= 12) break;
      }
      if (terms.size >= 12) break;
    }
    if (terms.size >= 12) break;
  }
  return [...terms].slice(0, 10);
}

function detect() {
  const isPack = detectOpencodePack();
  const manifest = detectManifest(isPack);

  const data = {
    name: null,
    type: isPack ? 'opencode-pack' : null,
    description: null,
    repo: null,
    primaryLanguage: null,
    stack: { language: null, framework: null, runtime: null, packageManager: null, database: null, deployment: null },
    tooling: { testRunner: null, coverage: null, linter: null, formatter: null, ci: null, container: null, envVars: null },
    buildRun: { install: null, dev: null, test: null, lint: null, build: null, deploy: null },
    conventions: { naming: null, fileStructure: null, errorHandling: null, commits: null, branching: null, prReview: null },
    entryPoints: [],
    directoryLayout: [],
    domainMap: [],
    dataModel: { detected: false, entities: [] },
    apiSurface: { detected: false, http: [], exports: [], cli: [] },
    dependencies: { detected: false, items: [] },
    glossary: [],
    nonNegotiables: [],
    architectureNotes: [],
    openQuestions: [],
    recentActivity: [],
  };

  // ---- package.json path (most common + covers opencode pack) ----
  if (manifest && manifest.type === 'package.json') {
    const p = manifest.data;
    // For opencode packs, prefer the directory name over the .opencode/package.json name
    if (isPack) {
      data.name = path.basename(ROOT);
      data.description = `opencode starter pack — ${p.description || 'agents, skills, commands, CLIs for the opencode harness'}`;
    } else {
      data.name = p.name || path.basename(ROOT);
      data.description = p.description || null;
    }
    data.primaryLanguage = 'JavaScript/TypeScript';
    data.stack.language = p.type === 'module' ? 'JavaScript (ESM)' : 'JavaScript';
    if (p.dependencies && Object.keys(p.dependencies).some(k => k.startsWith('next'))) data.stack.framework = `Next.js ${p.dependencies.next || ''}`.trim();
    else if (p.dependencies && Object.keys(p.dependencies).some(k => k.startsWith('react'))) data.stack.framework = `React ${p.dependencies.react || ''}`.trim();
    else if (p.dependencies && Object.keys(p.dependencies).some(k => k.startsWith('vue'))) data.stack.framework = `Vue ${p.dependencies.vue || ''}`.trim();
    else if (p.dependencies && Object.keys(p.dependencies).some(k => k.startsWith('express'))) data.stack.framework = `Express ${p.dependencies.express || ''}`.trim();
    data.stack.runtime = p.engines?.node ? `node ${p.engines.node.replace(/[^\d.]/g, '')}` : 'node';
    data.stack.packageManager = fs.existsSync(path.join(ROOT, 'pnpm-lock.yaml')) ? 'pnpm'
      : fs.existsSync(path.join(ROOT, 'yarn.lock')) ? 'yarn'
      : fs.existsSync(path.join(ROOT, 'package-lock.json')) ? 'npm' : 'npm';
    // scripts
    const s = p.scripts || {};
    data.buildRun.install = `npm install${data.stack.packageManager !== 'npm' ? ` (or ${data.stack.packageManager})` : ''}`;
    if (s.dev) data.buildRun.dev = `npm run dev`;
    if (s.test) data.buildRun.test = `npm test`;
    if (s.lint) data.buildRun.lint = `npm run lint`;
    if (s.build) data.buildRun.build = `npm run build`;
    // tooling
    if (p.devDependencies?.vitest) data.tooling.testRunner = 'vitest';
    else if (p.devDependencies?.jest) data.tooling.testRunner = 'jest';
    if (p.devDependencies?.['c8'] || p.devDependencies?.['@vitest/coverage-v8']) data.tooling.coverage = 'c8 / v8';
    if (p.devDependencies?.eslint) data.tooling.linter = 'eslint';
    else if (p.devDependencies?.biome) data.tooling.linter = 'biome';
    if (p.devDependencies?.prettier) data.tooling.formatter = 'prettier';
    // CI
    const gh = listDir(path.join(ROOT, '.github', 'workflows'), f => f.endsWith('.yml') || f.endsWith('.yaml'));
    if (gh.length > 0) data.tooling.ci = `GitHub Actions (${gh.length} workflow${gh.length > 1 ? 's' : ''})`;
    if (fs.existsSync(path.join(ROOT, 'Dockerfile'))) data.tooling.container = 'Dockerfile';
    // entry points
    if (p.main) data.entryPoints.push(`${p.main} — package main`);
    if (p.bin) {
      const bin = typeof p.bin === 'string' ? { '': p.bin } : p.bin;
      for (const [name, file] of Object.entries(bin)) data.entryPoints.push(`${file} — CLI binary${name ? ` (${name})` : ''}`);
    }
    if (data.entryPoints.length === 0) {
      ['src/index.ts', 'src/index.js', 'app.ts', 'app.js', 'cmd/main.go', 'src/main.rs', 'main.py'].forEach(c => {
        if (fs.existsSync(path.join(ROOT, c))) data.entryPoints.push(`${c} — main entry`);
      });
    }
    // dependencies
    const all = { ...(p.dependencies || {}), ...(p.devDependencies || {}) };
    data.dependencies.detected = Object.keys(all).length > 0;
    data.dependencies.items = Object.entries(all)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(0, 10)
      .map(([name, ver]) => {
        const clean = String(ver).replace(/[\^~]/g, '').trim();
        return { name, version: clean === '*' || clean === '' ? '(any)' : clean };
      });
    // type
    if (isPack) data.type = 'opencode-pack';
    else if (p.bin) data.type = 'cli';
    else if (data.stack.framework?.includes('Next') || data.stack.framework?.includes('React') || data.stack.framework?.includes('Vue')) data.type = 'web-app';
    else data.type = 'library';
  } else if (isPack) {
    // opencode pack without package.json — fill from pack catalog
    data.name = path.basename(ROOT);
    data.type = 'opencode-pack';
    data.primaryLanguage = 'Markdown + JavaScript';
    data.stack.language = 'JavaScript (CLIs) + Markdown (agents/skills/commands)';
    data.stack.framework = 'opencode';
    data.stack.runtime = 'node 20+ (for CLIs)';
    data.stack.packageManager = 'npm (peer plugins)';
  } else if (manifest && manifest.type === 'pyproject') {
    data.primaryLanguage = 'Python';
    data.type = 'library';
    // minimal pyproject parse
    const py = manifest.data;
    const nameMatch = py.match(/^name\s*=\s*["']([^"']+)["']/m);
    if (nameMatch) data.name = nameMatch[1];
    const descMatch = py.match(/^description\s*=\s*["']([^"']+)["']/m);
    if (descMatch) data.description = descMatch[1];
    data.stack.runtime = 'python';
    data.stack.packageManager = fs.existsSync(path.join(ROOT, 'poetry.lock')) ? 'poetry'
      : fs.existsSync(path.join(ROOT, 'Pipfile.lock')) ? 'pipenv'
      : fs.existsSync(path.join(ROOT, 'uv.lock')) ? 'uv' : 'pip';
  } else if (manifest && manifest.type === 'cargo') {
    data.primaryLanguage = 'Rust';
    data.type = 'cli';
    const ct = manifest.data;
    const nameMatch = ct.match(/^name\s*=\s*"([^"]+)"/m);
    if (nameMatch) data.name = nameMatch[1];
    const descMatch = ct.match(/^description\s*=\s*"([^"]+)"/m);
    if (descMatch) data.description = descMatch[1];
    data.stack.runtime = 'rust';
    data.stack.packageManager = 'cargo';
  } else if (manifest && manifest.type === 'go') {
    data.primaryLanguage = 'Go';
    data.type = 'cli';
    const g = manifest.data;
    const nameMatch = g.match(/^module\s+(\S+)/m);
    if (nameMatch) data.name = nameMatch[1].split('/').pop();
    data.stack.runtime = 'go';
    data.stack.packageManager = 'go mod';
  } else if (manifest && manifest.type === 'pubspec') {
    // Flutter / Dart project (pubspec.yaml is at root, not .opencode/)
    const ps = manifest.data;
    const nameMatch = ps.match(/^name\s*:\s*(\S+)/m);
    if (nameMatch) data.name = nameMatch[1];
    const descMatch = ps.match(/^description\s*:\s*(.+)$/m);
    if (descMatch) data.description = descMatch[1].replace(/^["']|["']$/g, '');
    const hasFlutter = /^\s*flutter\s*:\s*$/m.test(ps) && /sdk:\s*flutter/.test(ps);
    const hasDart = /^\s*dart\s*:/m.test(ps) || /^\s*sdk\s*:\s*["']dart/.test(ps);
    if (hasFlutter) {
      data.primaryLanguage = 'Dart';
      data.type = 'mobile';
      data.stack.language = 'Dart';
      data.stack.framework = 'Flutter';
      data.stack.runtime = 'Dart SDK (managed by flutter)';
      data.stack.packageManager = 'flutter pub';
    } else if (hasDart) {
      data.primaryLanguage = 'Dart';
      data.type = 'cli';
      data.stack.language = 'Dart';
      data.stack.framework = 'Dart';
      data.stack.runtime = 'Dart SDK';
      data.stack.packageManager = 'dart pub';
    }
  }

  // env vars
  const envEx = path.join(ROOT, '.env.example');
  if (fs.existsSync(envEx)) {
    const envContent = readIfExists(envEx) || '';
    const envLines = envContent.split('\n').filter(l => /^[A-Z_][A-Z0-9_]*=/.test(l));
    if (envLines.length > 0) data.tooling.envVars = envLines.length;
  }

  // git remote
  data.repo = safeExec('git config --get remote.origin.url') || 'local only';

  // conventions — read from CONTRIBUTING.md / commit history
  const contributing = readIfExists(path.join(ROOT, 'CONTRIBUTING.md'));
  if (contributing) {
    if (/conventional commit/i.test(contributing)) data.conventions.commits = 'conventional commits';
    if (/git[- ]?flow/i.test(contributing)) data.conventions.branching = 'git-flow';
    else if (/trunk[- ]based/i.test(contributing)) data.conventions.branching = 'trunk-based';
    else if (/GitHub flow/i.test(contributing)) data.conventions.branching = 'GitHub flow';
  }
  // commits from history
  const recentCommits = safeExec('git log --oneline -20 --pretty=format:"%s"');
  if (recentCommits) {
    if (/^(feat|fix|chore|docs|refactor|test|perf|build|ci)(\(.+\))?!?:/.test(recentCommits.split('\n').find(Boolean) || '')) {
      data.conventions.commits = data.conventions.commits || 'conventional commits';
    }
  }

  // ---- generic directory layout (1.2.5: language-agnostic) ----
  const dirs = walkTopDirs(2);
  for (const d of dirs) {
    const purpose = detectDirPurpose(d.name, d.rel);
    if (purpose) {
      data.directoryLayout.push(`\`${d.rel}/\` — ${purpose}${d.files > 0 ? ` (${d.files} file${d.files > 1 ? 's' : ''})` : ''}`);
    }
  }
  // Pack subdirs (only when isPack)
  if (isPack) {
    if (fs.existsSync(AGENTS_DIR)) data.directoryLayout.push(`\`.opencode/agents/\` — sub-agent definitions (${listDir(AGENTS_DIR, f => f.endsWith('.md')).length})`);
    if (fs.existsSync(COMMANDS_DIR)) data.directoryLayout.push(`\`.opencode/commands/\` — slash commands (${listDir(COMMANDS_DIR, f => f.endsWith('.md')).length})`);
    if (fs.existsSync(SKILLS_DIR)) data.directoryLayout.push(`\`.agents/skills/\` — knowledge skills (${listDir(SKILLS_DIR).length})`);
    if (fs.existsSync(BIN_DIR)) data.directoryLayout.push(`\`.opencode/bin/\` — native CLIs (${listDir(BIN_DIR, f => f.endsWith('.js')).length})`);
    if (fs.existsSync(PLUGINS_DIR)) data.directoryLayout.push(`\`.opencode/plugins/\` — local plugins`);
  }

  // ---- entry points (1.2.5: expanded) ----
  if (data.entryPoints.length === 0) {
    data.entryPoints = detectEntryPoints();
  }

  // ---- architecture hints (1.2.5: framework detection from manifest deps) ----
  const archHints = detectArchitecture(manifest);
  if (archHints.length > 0) {
    data.architectureNotes.push(`**Pattern**: ${archHints.join(' + ')} (auto-detected from manifest dependencies)`);
  }

  // ---- license (1.2.5: LICENSE file + manifest field) ----
  const lic = detectLicense(manifest);
  if (lic) {
    data.nonNegotiables.push(`**License**: ${lic.name} (from ${lic.source})`);
  }

  // ---- glossary (1.2.5: auto-extract class names from code) ----
  if (data.glossary.length === 0) {
    data.glossary = extractGlossary();
  }

  // ---- domain map (opencode pack) ----
  if (isPack) {
    data.domainMap = [
      { module: 'agents', desc: `${listDir(AGENTS_DIR, f => f.endsWith('.md')).length} sub-agents (reviewers, resolvers, planners, specialists)` },
      { module: 'commands', desc: `${listDir(COMMANDS_DIR, f => f.endsWith('.md')).length} slash commands (workflows + dispatchers)` },
      { module: 'skills', desc: `${listDir(SKILLS_DIR).length} knowledge skills (patterns, processes, security)` },
      { module: 'bin', desc: `${listDir(BIN_DIR, f => f.endsWith('.js')).length} native CLIs (zero deps, CommonJS, cross-platform)` },
      { module: 'plugins', desc: 'plugins (npm + local hookify.js)' },
    ];
  }

  // ---- docs/ inventory → Recent Activity ----
  if (fs.existsSync(DOCS_DIR)) {
    const recent = [];
    for (const sub of ['prds', 'plans', 'audits', 'reports', 'sessions']) {
      const dir = path.join(DOCS_DIR, sub);
      if (!fs.existsSync(dir)) continue;
      for (const f of listDir(dir, f => f.endsWith('.md'))) {
        const stat = fs.statSync(path.join(dir, f));
        recent.push({
          type: sub.replace(/s$/, ''),  // 'prds' → 'prd'
          file: `${sub}/${f}`,
          title: f.replace(/^\d{4}-\d{2}-\d{2}_\d{4}-/, '').replace(/\.\w+$/, '').replace(/[-_]/g, ' '),
          date: stat.mtime.toISOString().slice(0, 10),
        });
      }
    }
    data.recentActivity = recent.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 15);
  }

  return data;
}

// ---------- template rendering ----------

function statusIndicator(existing) {
  if (!existing) return { emoji: '⚪', label: 'no project context', age: '—' };
  // Look for the Init: / Refresh: line
  const m = existing.match(/\*\*Init\*\*:\s*(\S+).*?\*\*Refresh\*\*:\s*(\S+)/s);
  const ref = m ? m[2] : null;
  if (!ref) return { emoji: '⚪', label: 'no timestamp', age: '—' };
  const d = ageDays(ref);
  let emoji, label;
  if (d <= 3) { emoji = '🟢'; label = 'fresh'; }
  else if (d <= 7) { emoji = '🟡'; label = 'aging'; }
  else { emoji = '🔴'; label = 'stale'; }
  const ageText = d < 1 ? `${Math.round(d * 24)}h ago` : `${Math.round(d)}d ago`;
  return { emoji, label, age: ageText };
}

// Heuristic: count "meaningful" sections vs placeholder/empty sections.
// A section is "placeholder" if its body is dominated by:
//   - dash bullets ("- **Foo**: —")
//   - empty code fences ("```")
//   - explicit TBD / N/A / WIP / ? / TBA tokens
// Returns { total, filled, pct } where pct = filled/total * 100.
function sparseStats(existing) {
  if (!existing) return { total: 0, filled: 0, pct: 0 };
  const sections = existing.split(/^##\s+/m).slice(1); // drop preamble
  const placeholderRe = /—|\?\?\?|TBD|TBA|N\/A|WIP|^```$/i;
  let total = 0, filled = 0;
  for (const sec of sections) {
    // First line is the heading; rest is body
    const body = sec.split('\n').slice(1).join('\n').trim();
    if (!body) continue;
    total++;
    // A section is "filled" if it has at least one non-trivial line
    // (more than just dashes, question marks, or empty code fences).
    const lines = body.split('\n').filter(l => l.trim() && !l.match(/^```$/));
    if (lines.length < 2) continue;
    // Count meaningful lines (not just dash bullets with em-dash)
    const meaningful = lines.filter(l =>
      !l.match(/^-\s+\*\*[^*]+\*\*:\s*—\s*$/) &&   // "- **Foo**: —"
      !l.match(/^-\s+—\s*$/) &&                      // "- —"
      !l.match(/^-\s+\?\s*$/) &&                     // "- ?"
      !l.match(/^[-*]\s*\{\w+\}\s*[:：]/)             // template placeholders "- {term}:"
    );
    if (meaningful.length >= 1) filled++;
  }
  return { total, filled, pct: total ? Math.round(filled / total * 100) : 0 };
}

// Extract manual sections from existing PROJECT.md: content between
// "## Section" heading and the next "## " heading.
function extractManualSections(existing) {
  if (!existing) return {};
  const sections = {};
  // Strip frontmatter/comments to avoid spurious matches
  const lines = existing.split('\n');
  let current = null;
  let buf = [];
  const manualSections = new Set(['Glossary', 'Non-Negotiables', 'Architecture Notes', 'Open Questions']);
  for (const line of lines) {
    const m = line.match(/^##\s+(.+?)\s*$/);
    if (m) {
      if (current && manualSections.has(current)) {
        sections[current] = cleanManualContent(buf);
      }
      current = m[1].trim();
      buf = [];
    } else if (current) {
      buf.push(line);
    }
  }
  if (current && manualSections.has(current)) {
    sections[current] = cleanManualContent(buf);
  }
  return sections;
}

// Strip leading `<!-- manual -->` comments, HTML comment markers, and
// template-placeholder bullets. Returns the trimmed content or '' if
// the content is a placeholder/empty.
function cleanManualContent(buf) {
  let lines = buf.slice();
  // Drop leading `<!-- manual ... -->` comment lines
  while (lines.length > 0 && /^\s*<!--\s*(manual|auto|conditional)/.test(lines[0])) {
    lines.shift();
  }
  // Drop leading/trailing blank lines
  while (lines.length > 0 && lines[0].trim() === '') lines.shift();
  while (lines.length > 0 && lines[lines.length - 1].trim() === '') lines.pop();
  const content = lines.join('\n');
  const isPlaceholder = /^[`'.~\-*\s]*$/.test(content) || /^(tbd|todo|wip|n\/a|placeholder)$/i.test(content);
  return content && !isPlaceholder ? content : '';
}

// Extract override section: content after "<!-- Override -->" comment in
// Build & Run and Conventions sections.
function extractOverrides(existing) {
  if (!existing) return {};
  const out = {};
  const sections = ['Build & Run', 'Conventions'];
  for (const sec of sections) {
    const re = new RegExp(`##\\s+${sec}[\\s\\S]*?(?=\\n##\\s|$)`);
    const m = existing.match(re);
    if (!m) continue;
    const block = m[0];
    const ov = block.indexOf('<!-- Override');
    if (ov >= 0) {
      const after = block.slice(ov).split('\n').slice(1).join('\n').trim();
      if (after.length > 0) out[sec] = after;
    }
  }
  return out;
}

function buildRecentActivityBlock(detected, existing) {
  const lines = [];
  if (existing) {
    // Extract existing Recent Activity entries (lines starting with `- 20` or `- [` or `- YYYY`)
    const re = /##\s+Recent Activity\s+([\s\S]*?)(?=\n##\s|$)/;
    const m = existing.match(re);
    if (m) {
      // Keep only lines that look like entries
      const kept = m[1].split('\n').filter(l => /^-\s/.test(l) || l.trim() === '')
        // Legacy entries were written as docs/<sub>/<file>, but PROJECT.md lives inside
        // docs/, so the correct relative path has no prefix. Normalise so a refresh
        // doesn't duplicate every old entry once the generator stops adding it.
        .map(l => l.replace(/\]\(docs\/(prds|plans|audits|reports|sessions)\//g, ']($1/'));
      // Drop trailing blanks
      while (kept.length > 0 && kept[kept.length - 1].trim() === '') kept.pop();
      if (kept.length > 0) lines.push(kept.join('\n'));
    }
  }
  // Append newly detected events (dedup by file)
  const seen = new Set();
  if (lines.length > 0) {
    for (const l of lines.join('\n').split('\n')) {
      const m = l.match(/\[(\w+)\]\(([^)]+)\)/);
      if (m) seen.add(m[2]);
    }
  }
  for (const ev of detected.recentActivity) {
    if (seen.has(ev.file)) continue;
    lines.push(`- ${ev.date} — [${ev.type}](${ev.file}): "${ev.title}"`);
  }
  return lines.length > 0 ? lines.join('\n') : '<!-- (no activity detected yet) -->';
}

function render(template, detected, manual, overrides, opts) {
  const now = nowISO();
  const initDate = opts.initDate || todayISO();
  const status = statusIndicator(opts.existing);

  let out = template;

  // Header substitutions
  out = out.replace('{NAME}', detected.name || path.basename(ROOT));
  out = out.replace('{STATUS_EMOJI}', status.emoji);
  out = out.replace('{STATUS_LABEL}', status.label);
  out = out.replace('{AGE_TEXT}', status.age);
  out = out.replace('{INIT_DATE}', initDate);
  out = out.replace('{REFRESH_DATE}', todayISO());

  // Identity
  out = out.replace(/- \*\*Name\*\*: \{name\}/, `- **Name**: ${detected.name || path.basename(ROOT)}`);
  out = out.replace(/- \*\*Type\*\*: \{web-app \| api-service \| cli \| library \| monorepo \| opencode-pack \| \.\.\.\}/,
    `- **Type**: ${detected.type || 'not detected'}`);
  out = out.replace(/- \*\*Description\*\*: \{one-line from README or package\.json\}/,
    `- **Description**: ${detected.description || '— (run `--init` after adding description)'}`);
  out = out.replace(/- \*\*Repo\*\*: \{git remote URL or "local only"\}/,
    `- **Repo**: ${detected.repo}`);
  out = out.replace(/- \*\*Primary language\*\*: \{language\}/,
    `- **Primary language**: ${detected.primaryLanguage || '—'}`);

  // Stack
  const s = detected.stack;
  out = out.replace(/- \*\*Language\*\*: \{lang\}/, `- **Language**: ${s.language || '—'}`);
  out = out.replace(/- \*\*Framework\*\*: \{framework \+ version\}/, `- **Framework**: ${s.framework || '—'}`);
  out = out.replace(/- \*\*Runtime \/ Build\*\*: \{node 20, python 3\.12, rust stable, \.\.\.\}/, `- **Runtime / Build**: ${s.runtime || '—'}`);
  out = out.replace(/- \*\*Package manager\*\*: \{npm \| pnpm \| yarn \| poetry \| cargo \| go mod \| pub \| gradle\}/, `- **Package manager**: ${s.packageManager || '—'}`);
  out = out.replace(/- \*\*Database\*\*: \{postgres \| sqlite \| mongodb \| \.\.\. \| none detected\}/, `- **Database**: ${s.database || 'none detected'}`);
  out = out.replace(/- \*\*Deployment\*\*: \{vercel \| aws \| docker \| fly\.io \| \.\.\. \| not detected\}/, `- **Deployment**: ${s.deployment || 'not detected'}`);

  // Tooling
  const t = detected.tooling;
  out = out.replace(/- \*\*Test runner\*\*: \{vitest \| jest \| pytest \| go test \| \.\.\.\}/, `- **Test runner**: ${t.testRunner || '—'}`);
  out = out.replace(/- \*\*Coverage\*\*: \{c8 \| codecov \| \.\.\. \| not detected\}/, `- **Coverage**: ${t.coverage || 'not detected'}`);
  out = out.replace(/- \*\*Linter\*\*: \{eslint \| biome \| ruff \| golangci-lint \| \.\.\.\}/, `- **Linter**: ${t.linter || '—'}`);
  out = out.replace(/- \*\*Formatter\*\*: \{prettier \| biome \| black \| rustfmt \| gofmt\}/, `- **Formatter**: ${t.formatter || '—'}`);
  out = out.replace(/- \*\*CI\*\*: \{GitHub Actions \(3 workflows\) \| GitLab CI \| \.\.\.\}/, `- **CI**: ${t.ci || 'not detected'}`);
  out = out.replace(/- \*\*Container\*\*: \{Dockerfile \| docker-compose \| \.\.\.\}/, `- **Container**: ${t.container || '—'}`);
  out = out.replace(/- \*\*Env vars\*\*: \{12 detected — see \.env\.example\}/,
    `- **Env vars**: ${t.envVars ? `${t.envVars} detected — see .env.example` : 'not detected'}`);

  // Build & Run — apply override if present
  const br = detected.buildRun;
  const brOverride = overrides['Build & Run'];
  const brBlock = brOverride
    ? brOverride
    : [
        `- **Install**: \`${br.install || '—'}\``,
        `- **Dev**: \`${br.dev || '—'}\``,
        `- **Test**: \`${br.test || '—'}\``,
        `- **Lint**: \`${br.lint || '—'}\``,
        `- **Build**: \`${br.build || '—'}\``,
        `- **Deploy**: \`${br.deploy || '—'}\``,
        '',
        '<!-- Override the detected commands above. Refresh keeps your edits. -->',
      ].join('\n');
  out = out.replace(/- \*\*Install\*\*: `npm install`[\s\S]*?(?=\n##\s)/,
    brBlock + '\n');

  // Conventions
  const cv = detected.conventions;
  const cvOverride = overrides['Conventions'];
  const cvBlock = cvOverride
    ? cvOverride
    : [
        `- **Naming**: ${cv.naming || '—'}`,
        `- **File structure**: ${cv.fileStructure || '—'}`,
        `- **Error handling**: ${cv.errorHandling || '—'}`,
        `- **Commits**: ${cv.commits || '—'}`,
        `- **Branching**: ${cv.branching || '—'}`,
        `- **PR review**: ${cv.prReview || '—'}`,
        '',
        '<!-- Override auto-detected values below. Refresh keeps your edits. -->',
      ].join('\n');
  out = out.replace(/- \*\*Naming\*\*: \{[\s\S]*?(?=\n##\s)/,
    cvBlock + '\n');

  // Entry Points
  if (detected.entryPoints.length > 0) {
    out = out.replace(/- `src\/index\.ts` — main entry\s*- `bin\/cli\.js` — CLI binary/,
      detected.entryPoints.map(e => `- \`${e}\``).join('\n'));
  } else {
    out = out.replace(/- `src\/index\.ts` — main entry\s*- `bin\/cli\.js` — CLI binary/,
      '- (no entry points detected)');
  }

  // Directory Layout
  if (detected.directoryLayout.length > 0) {
    out = out.replace(/- `src\/` — application code[\s\S]*?(?=\n##\s)/,
      detected.directoryLayout.join('\n') + '\n');
  }

  // Domain Map
  if (detected.domainMap.length > 0) {
    out = out.replace(/- \*\*\{module\}\*\*: \{one-line purpose\}[\s\S]*?(?=\n##\s|\n<!-- conditional)/,
      detected.domainMap.map(d => `- **${d.module}**: ${d.desc}`).join('\n') + '\n');
  }

  // ---- Conditional sections ----

  // Data Model
  if (!detected.dataModel.detected) {
    // Remove the whole block (markers + heading + body) and any trailing blank lines
    out = out.replace(/<!-- conditional:data-model -->[\s\S]*?<!-- \/conditional -->\n*/g, '');
  }

  // API Surface
  if (!detected.apiSurface.detected) {
    out = out.replace(/<!-- conditional:api-surface -->[\s\S]*?<!-- \/conditional -->\n*/g, '');
  }

  // Dependencies
  if (detected.dependencies.detected && detected.dependencies.items.length > 0) {
    const depLines = detected.dependencies.items.map(d => `- **${d.name}** \`${d.version}\``);
    out = out.replace(/- \*\*\{dep\} \{version\}\*\*: \{why chosen\}[\s\S]*?(?=\n##\s|\n<!-- conditional)/,
      depLines.join('\n') + '\n');
  } else {
    out = out.replace(/<!-- conditional:dependencies -->[\s\S]*?<!-- \/conditional -->\n*/g, '');
  }

  // ---- Manual sections (preserved from existing or auto-filled from detect()) ----
  // Priority: existing manual content > auto-detected data (1.2.5) > template placeholder
  const secDataKey = {
    'Glossary': 'glossary',
    'Non-Negotiables': 'nonNegotiables',
    'Architecture Notes': 'architectureNotes',
    'Open Questions': 'openQuestions',
  };
  for (const sec of ['Glossary', 'Non-Negotiables', 'Architecture Notes', 'Open Questions']) {
    const re = new RegExp(`(##\\s+${sec}\\s+<!-- manual[^>]*-->)\\n[\\s\\S]*?(?=\\n##\\s|$)`);
    if (manual[sec]) {
      out = out.replace(re, `$1\n\n${manual[sec]}\n`);
    } else if (detected[secDataKey[sec]] && detected[secDataKey[sec]].length > 0) {
      // 1.2.5: auto-fill from detected data (License, Architecture, Glossary terms)
      const bullets = detected[secDataKey[sec]]
        .map(item => item.startsWith('-') ? item : `- ${item}`)
        .join('\n');
      out = out.replace(re, `$1\n\n${bullets}\n`);
    }
    // else: keep template placeholders
  }

  // ---- Recent Activity (auto-managed) ----
  const activityBlock = buildRecentActivityBlock(detected, opts.existing);
  out = out.replace(/##\s+Recent Activity\s+<!-- auto-managed[\s\S]*$/m,
    `## Recent Activity\n<!-- auto-managed: appended by project-init.js. Do not edit by hand. -->\n\n${activityBlock}\n`);

  return out;
}

// ---------- main ----------

function main() {
  const args = parseArgs(process.argv);

  if (args.help) {
    process.stdout.write(fs.readFileSync(__filename, 'utf8')
      .split('\n')
      .filter(l => l.startsWith(' *') || l.startsWith('// '))
      .join('\n') + '\n');
    return;
  }

  const template = readIfExists(TEMPLATE);
  if (!template) {
    process.stderr.write(`ERROR: template not found at ${TEMPLATE}\n`);
    process.exit(1);
  }
  const existing = readIfExists(OUT);

  if (args.mode === 'status') {
    const s = statusIndicator(existing);
    process.stdout.write(`Status: ${s.emoji} ${s.label} (${s.age})\n`);
    if (existing) process.stdout.write(`Path:   ${OUT}\n`);
    else process.stdout.write(`Path:   ${OUT} (does not exist — run --init)\n`);
    return;
  }

  if (args.mode === 'check') {
    if (!existing) { process.stderr.write('STALE: PROJECT.md missing\n'); process.exit(1); }
    const s = statusIndicator(existing);
    if (s.label === 'stale') { process.stderr.write(`STALE: ${s.age}\n`); process.exit(1); }
    process.stdout.write(`OK: ${s.emoji} ${s.label} (${s.age})\n`);
    return;
  }

  if (args.mode === 'sparse-check') {
    if (!existing) {
      process.stderr.write('SPARSE: PROJECT.md missing (will trigger code-explorer if --ensure)\n');
      process.exit(0); // 0 = sparse (trigger)
    }
    const stats = sparseStats(existing);
    process.stdout.write(`[sparse-check] ${stats.filled}/${stats.total} sections filled (${stats.pct}% complete)\n`);
    process.exit(stats.pct >= 50 ? 1 : 0); // 0 = sparse, 1 = rich
  }

  if (args.mode === 'ensure') {
    // AGENTS.md behavior #9: check PROJECT.md, bootstrap if missing/stale.
    // All output to stderr so it doesn't pollute agent stdout.
    args.quiet = true;
    const log = (msg) => process.stderr.write(`[project-init --ensure] ${msg}\n`);

    if (!existing) {
      log('PROJECT.md missing → bootstrapping with --init');
      args.mode = 'init';
      args.force = true; // ensure always writes, never refuses
    } else {
      const s = statusIndicator(existing);
      if (s.label === 'stale') {
        log(`PROJECT.md stale (${s.age}) → refreshing with --refresh`);
        args.mode = 'refresh';
      } else {
        log(`PROJECT.md ${s.emoji} ${s.label} (${s.age}) — no action`);
        return;
      }
    }
    // fall through to the init/refresh path below
  }

  if (args.mode === 'append') {
    if (!existing) { process.stderr.write('ERROR: PROJECT.md does not exist; run --init first\n'); process.exit(1); }
    if (!args.appendType || !args.appendName) {
      process.stderr.write('ERROR: --append-event requires TYPE and NAME\n');
      process.exit(1);
    }
    const entry = `- ${todayISO()} — [${args.appendType}](${args.appendName})${args.appendMeta ? ': ' + args.appendMeta : ''}`;
    const re = /(##\s+Recent Activity[\s\S]*?)(?=\n##\s|$)/;
    const m = existing.match(re);
    if (!m) {
      // append at end
      fs.writeFileSync(OUT, existing.trimEnd() + '\n\n' + entry + '\n', 'utf8');
    } else {
      // insert after the comment block, before first entry (or at end)
      const block = m[1];
      const lines = block.split('\n');
      // find first `- ` line
      const idx = lines.findIndex(l => /^-\s/.test(l));
      const newBlock = idx >= 0
        ? [...lines.slice(0, idx), entry, ...lines.slice(idx)].join('\n')
        : block.trimEnd() + '\n' + entry;
      fs.writeFileSync(OUT, existing.replace(re, newBlock), 'utf8');
    }
    process.stdout.write(`Appended: ${entry}\n`);
    return;
  }

  // init or refresh
  const detected = detect();
  const manual = extractManualSections(existing);
  const overrides = extractOverrides(existing);

  // Preserve init date from existing
  let initDate = todayISO();
  if (existing) {
    const m = existing.match(/\*\*Init\*\*:\s*(\S+)/);
    if (m) initDate = m[1];
  }

  const output = render(template, detected, manual, overrides, { existing, initDate });

  if (args.dryRun || (!args.mode && args._.length === 0)) {
    process.stdout.write(output);
    if (!args.dryRun) {
      process.stderr.write('\n(Refusing to write without --init or --refresh. Use --dry-run to preview, --init to overwrite, --refresh to update.)\n');
      process.exit(1);
    }
    return;
  }

  if (args.mode === 'init' && existing && !args.force) {
    process.stderr.write(`PROJECT.md already exists. Use --refresh to update, or pass --force to overwrite.\n`);
    process.exit(1);
  }

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, output, 'utf8');
  if (args.quiet) {
    // --ensure: log to stderr only
    process.stderr.write(`Wrote ${OUT} (${output.length} bytes, ${detected.recentActivity.length} activity entries)\n`);
  } else {
    process.stdout.write(`Wrote ${OUT} (${output.length} bytes, ${detected.recentActivity.length} activity entries)\n`);
  }
}

main();
