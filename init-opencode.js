#!/usr/bin/env node
/**
 * init-opencode.js - cross-platform installer for the opencode pack
 *
 * WHY THIS EXISTS
 *   init-opencode.ps1 only runs on Windows PowerShell: backslash path
 *   fragments, PS-only cmdlets (Select-String, ConvertTo-Json,
 *   Get-ChildItem -Directory) and `New-Item -ItemType Junction`. Anyone on
 *   Linux/macOS could not install the pack at all. This file is a faithful
 *   port of that script: the same 7 phases, the same stack filters, the
 *   same conservative merges, the same messages - zero dependencies, Node
 *   stdlib only, path.join everywhere (never backslash fragments).
 *
 *   The NTFS junctions of the PowerShell version become junctions on
 *   Windows and symlinks elsewhere (fs.symlinkSync type 'junction'/'dir').
 *   They stay gitignored: indexing them makes `git add -A` traverse the
 *   link and duplicate the whole agents/skills tree.
 *
 * Usage:
 *   node init-opencode.js [--project-path <dir>] [--pack-path <dir>]
 *                         [--stack <name>] [--all-agents]
 *                         [--skip-install] [--skip-docs] [--force]
 *
 *   --project-path  target project            (default: process.cwd())
 *   --pack-path     pack origin               (default: directory of this script)
 *   --stack         flutter|node|python|rust|go|java|csharp|cpp|php|swift|kotlin
 *                   (default: auto-detect from config files, as the .ps1 does)
 *   --all-agents    copy every agent, no stack filter (biblioteca completa)
 *   --skip-install  skip the `npm install` of plugins
 *   --skip-docs     skip the docs/ skeleton
 *   --force         accepted for compatibility: the installer never prompts
 *
 * Exit codes:
 *   0 = installed (possibly with warnings)
 *   1 = bad arguments, or the pack path does not exist / is not a pack
 */

const fs = require('fs');
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');

// ---------------------------------------------------------------------------
// Pack data - ported verbatim from init-opencode.ps1. Do not fork these
// lists: the PowerShell installer and every verifier read the same shape.
// ---------------------------------------------------------------------------

const VALID_STACKS = ['flutter', 'node', 'python', 'rust', 'go', 'java', 'csharp', 'cpp', 'php', 'swift', 'kotlin'];

// Pool of agents tied to a language (the rest are multi-stack or process
// agents and are always copied: prd-agent, planner, report-auditor,
// security-reviewer, code-reviewer, tdd-guide, doc-updater, etc.)
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

// Which language agents are KEPT per stack
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

// Skills filtered by stack: only 3 of 40 are strictly JS/TS ecosystem. The
// rest are copied ALWAYS (multi-stack or referenced by agents). Discarding a
// skill also requires pruning its row in router/SKILL.md, or the router
// would dispatch to something that no longer exists - done below, after
// .agents/ has been copied.
const JS_ONLY_SKILLS = ['drizzle-patterns', 'turso-libsql', 'clerk-auth'];
const STACK_SKILLS = {
  flutter: JS_ONLY_SKILLS,
  python: JS_ONLY_SKILLS,
  rust: JS_ONLY_SKILLS,
  go: JS_ONLY_SKILLS,
  java: JS_ONLY_SKILLS,
  kotlin: JS_ONLY_SKILLS,
  csharp: JS_ONLY_SKILLS,
  cpp: JS_ONLY_SKILLS,
  php: JS_ONLY_SKILLS,
  swift: JS_ONLY_SKILLS,
  node: [], // the JS ecosystem is exactly where they fit
};

const SEP = '='.repeat(52);
const DASH = '-'.repeat(52);

// Contadores (mirrorean $script:copied / skipped / errors del .ps1)
let copied = 0;
let skipped = 0;
let errors = 0;

// ---------------------------------------------------------------------------
// Small utilities
// ---------------------------------------------------------------------------

function firstLine(msg) {
  return String(msg).split('\n')[0].replace(/\r$/, '');
}

function escRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Read a text file; null when unreadable. Strips a UTF-8 BOM so that
 *  line comparisons behave like PowerShell's Get-Content. */
function readText(p) {
  let t;
  try { t = fs.readFileSync(p, 'utf8'); } catch { return null; }
  if (t.charCodeAt(0) === 0xFEFF) t = t.slice(1);
  return t;
}

/** Get-Content line semantics: split on any newline, drop the trailing
 *  empty element a final newline produces. */
function textLines(t) {
  const lines = t.split(/\r?\n/);
  if (lines.length && lines[lines.length - 1] === '') lines.pop();
  return lines;
}

/** `Get-ChildItem <dir>\*.md` - top-level .md files. */
function countMd(dir) {
  try { return fs.readdirSync(dir).filter(f => f.endsWith('.md')).length; } catch { return 0; }
}

/** `Get-ChildItem <dir> -Directory` - direct child directories. */
function countDirs(dir) {
  try { return fs.readdirSync(dir, { withFileTypes: true }).filter(e => e.isDirectory()).length; } catch { return 0; }
}

/** `Get-ChildItem <dir> -Recurse -File` - every file below dir. Symlinks
 *  are not traversed (there are none under the checked paths, and this
 *  keeps a stray link from inflating the count). */
function countFilesDeep(dir) {
  let n = 0;
  const walk = (d) => {
    let entries;
    try { entries = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      const full = path.join(d, e.name);
      if (e.isSymbolicLink()) continue;
      if (e.isDirectory()) walk(full);
      else n++;
    }
  };
  walk(dir);
  return n;
}

function usage() {
  console.log('Uso: node init-opencode.js [--project-path <dir>] [--pack-path <dir>]');
  console.log('                           [--stack <name>] [--all-agents]');
  console.log('                           [--skip-install] [--skip-docs] [--force]');
}

// ---------------------------------------------------------------------------
// CLI parsing (kebab-case Node conventions; the .ps1 used -ProjectPath etc.)
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const opts = { projectPath: '', packPath: '', stack: '', allAgents: false, skipInstall: false, skipDocs: false };
  const valueFlags = { '--project-path': 'projectPath', '--pack-path': 'packPath', '--stack': 'stack' };
  const boolFlags = { '--all-agents': 'allAgents', '--skip-install': 'skipInstall', '--skip-docs': 'skipDocs', '--force': true };

  for (let i = 0; i < argv.length; i++) {
    let arg = argv[i];
    let inline = null;
    const eq = arg.indexOf('=');
    if (arg.startsWith('--') && eq > 0) {
      inline = arg.slice(eq + 1);
      arg = arg.slice(0, eq);
    }
    if (arg === '--help' || arg === '-h') {
      usage();
      process.exit(0);
    }
    if (valueFlags[arg]) {
      const v = inline !== null ? inline : argv[++i];
      if (v === undefined) {
        console.log('[ERROR] Falta el valor de ' + arg);
        usage();
        process.exit(1);
      }
      opts[valueFlags[arg]] = v;
      continue;
    }
    if (boolFlags[arg]) {
      if (boolFlags[arg] === true) continue; // --force: no-op kept for compatibility
      opts[boolFlags[arg]] = true;
      continue;
    }
    console.log('[ERROR] Argumento no reconocido: ' + arg);
    usage();
    process.exit(1);
  }
  return opts;
}

/** ValidateSet del .ps1: solo esos 11 stacks, case-insensitive como en PS. */
function validateStack(stack) {
  if (!stack) return '';
  const lower = stack.toLowerCase();
  if (VALID_STACKS.indexOf(lower) === -1) {
    console.log("[ERROR] Stack invalido: '" + stack + "' - valores permitidos: " + VALID_STACKS.join(', '));
    usage();
    process.exit(1);
  }
  return lower;
}

// ---------------------------------------------------------------------------
// DETECCION DE STACK - mismo orden de ficheros que Detect-Stack en el .ps1
// ---------------------------------------------------------------------------

function detectStack(p) {
  const has = (f) => fs.existsSync(path.join(p, f));
  if (has('pubspec.yaml')) return 'flutter';
  if (has('pyproject.toml')) return 'python';
  if (has('requirements.txt')) return 'python';
  if (has('setup.py')) return 'python';
  if (has('Cargo.toml')) return 'rust';
  if (has('go.mod')) return 'go';
  try {
    // `Test-Path <dir>\*.csproj`
    if (fs.readdirSync(p).some(f => f.toLowerCase().endsWith('.csproj'))) return 'csharp';
  } catch { /* dir ilegible -> seguimos */ }
  if (has('pom.xml')) return 'java';
  if (has('build.gradle')) return 'kotlin';
  if (has('composer.json')) return 'php';
  if (has('Package.swift')) return 'swift';
  if (has('package.json')) return 'node';
  return '';
}

// ---------------------------------------------------------------------------
// Copy primitives
// ---------------------------------------------------------------------------

/**
 * Copy a directory's CHILDREN into dest (creating dest when missing).
 *
 * NUNCA se copia la carpeta completa contra un destino ya existente:
 *   copy(pack/.opencode, proj/.opencode) crea proj/.opencode/.opencode
 *   (y .agents/.agents/) - el bug que el .ps1 corrigio copiando HIJOS
 *   contra el padre. El destino existe siempre en una actualizacion.
 *
 * Extra guards (equivalentes al resultado final del .ps1):
 *   - symlink/junction children are skipped: they are re-created by
 *     ensureLink() below, and copying them verbatim would make the project
 *     link point back into the PACK;
 *   - src === dest (installer run against the pack itself) is a no-op
 *     instead of a "same file" error per file.
 */
function copyDirChildren(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    let st = null;
    try { st = fs.lstatSync(s); } catch { continue; }
    if (st.isSymbolicLink()) continue;
    if (path.resolve(s) === path.resolve(d)) continue;
    if (st.isDirectory()) copyDirChildren(s, d);
    else if (st.isFile()) fs.copyFileSync(s, d);
  }
}

function copyFileSafe(src, dest) {
  if (path.resolve(src) === path.resolve(dest)) return; // self-install
  fs.copyFileSync(src, dest);
}

/** Copy-ItemSafe del .ps1: copia con conteo y mensajes. */
function copyItemSafe(src, dest, description, isFile) {
  if (!fs.existsSync(src)) {
    console.log('  [SKIP] ' + description);
    skipped++;
    return;
  }
  try {
    if (isFile) {
      const destDir = path.dirname(dest);
      if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
      copyFileSafe(src, dest);
    } else {
      if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
      copyDirChildren(src, dest);
    }
    console.log('  [OK] ' + description);
    copied++;
  } catch (e) {
    console.log('  [ERROR] ' + description + ' - ' + firstLine(e.message));
    errors++;
  }
}

// ---------------------------------------------------------------------------
// Fusion conservadora de archivos raiz - el proyecto MANDA. Solo se anaden
// del pack las entradas que faltan; nunca se pisa lo que el proyecto tenia.
// ---------------------------------------------------------------------------

function mergeGitignore(src, dest) {
  if (!fs.existsSync(src)) { skipped++; return; }
  if (!fs.existsSync(dest)) {
    copyItemSafe(src, dest, '.gitignore', true);
    return;
  }
  try {
    const destText = readText(dest);
    const packText = readText(src);
    if (destText === null || packText === null) throw new Error('no se pudo leer el fichero');
    const destLines = textLines(destText);
    const missing = textLines(packText).filter(l => l.trim().length > 0 && destLines.indexOf(l) === -1);
    if (missing.length === 0) {
      console.log('  [OK] .gitignore (sin cambios: ' + destLines.length + ' entradas propias ya cubren el pack)');
      copied++;
      return;
    }
    let out = destText;
    if (out.length > 0 && !/\r?\n$/.test(out)) out += '\n';
    out += '\n'; // Add-Content -Value "" (linea en blanco separadora)
    for (const l of missing) out += l + '\n';
    fs.writeFileSync(dest, out, 'utf8');
    console.log('  [OK] .gitignore (fusionado: +' + missing.length + ' del pack, ' + destLines.length + ' propias conservadas)');
    copied++;
  } catch (e) {
    console.log('  [ERROR] .gitignore - ' + firstLine(e.message));
    errors++;
  }
}

function mergeJsonConservative(src, dest, description) {
  if (!fs.existsSync(src)) { skipped++; return; }
  if (!fs.existsSync(dest)) {
    copyItemSafe(src, dest, description, true);
    return;
  }
  try {
    const dstText = readText(dest);
    const srcText = readText(src);
    if (dstText === null || srcText === null) throw new Error('no se pudo leer el fichero');
    const dst = JSON.parse(dstText);
    const srcObj = JSON.parse(srcText);
    let changed = false;
    const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
    for (const key of Object.keys(srcObj)) {
      if (!(key in dst)) {
        dst[key] = srcObj[key];
        changed = true;
        continue;
      }
      // Objetos anidados que crecen por claves: mcp / skills / plugin
      if (isObj(srcObj[key]) && isObj(dst[key])) {
        for (const k of Object.keys(srcObj[key])) {
          if (!(k in dst[key])) {
            dst[key][k] = srcObj[key][k];
            changed = true;
          }
        }
      }
    }
    if (!changed) {
      console.log('  [OK] ' + description + ' (sin cambios: lo del proyecto ya lo cubre)');
      copied++;
      return;
    }
    const newJson = JSON.stringify(dst, null, 2);
    JSON.parse(newJson); // comprobacion de integridad antes de escribir
    fs.writeFileSync(dest, newJson + '\n', 'utf8');
    console.log('  [OK] ' + description + ' (fusionado conservador: solo claves nuevas del pack)');
    copied++;
  } catch (e) {
    // Si algo no parsea, no toco el archivo del proyecto
    console.log('  [WARN] ' + description + ' ilegible -> se conserva el del proyecto (no se sobreescribe)');
    skipped++;
  }
}

// ---------------------------------------------------------------------------
// Junctions de compatibilidad (opencode 1.17.x)
// .opencode/agent -> .opencode/agents   y   .opencode/skill -> .agents/skills
// Windows: NTFS junction. resto: symlink de directorio. No se trackean en git.
// ---------------------------------------------------------------------------

function readLinkNormalized(link) {
  try {
    let t = fs.readlinkSync(link);
    if (process.platform === 'win32') {
      if (t.startsWith('\\\\?\\')) t = t.slice(4);
      return path.resolve(t.replace(/\//g, '\\')).toLowerCase();
    }
    return path.resolve(path.dirname(link), t);
  } catch { return null; }
}

function ensureLink(linkPath, targetPath) {
  if (!fs.existsSync(targetPath)) return false;
  let st = null;
  try { st = fs.lstatSync(linkPath); } catch { /* no existe */ }

  const want = process.platform === 'win32'
    ? path.resolve(targetPath).toLowerCase()
    : path.resolve(targetPath);

  if (st) {
    if (st.isSymbolicLink() && readLinkNormalized(linkPath) === want) return true; // ya apunta bien
    // o es un directorio de verdad, o apunta a otra cosa: se recrea
    try { fs.rmSync(linkPath, { recursive: true, force: true }); } catch { /* best effort */ }
  }
  try {
    fs.symlinkSync(targetPath, linkPath, process.platform === 'win32' ? 'junction' : 'dir');
    return true;
  } catch (e) {
    console.log('  [WARN] No pude crear junction ' + linkPath + ' -> ' + firstLine(e.message));
    return false;
  }
}

/** Lanza node en silencio. Devuelve el Error SOLO si no pudo arrancar:
 *  el .ps1 trata cualquier exit code del comando nativo como exito de
 *  arranque (`& node ... | Out-Null` no lanza), asi que aqui un exit != 0
 *  tambien cuenta como "se ejecuto". */
function spawnNodeQuiet(args, cwd) {
  try {
    execFileSync(process.execPath, args, { cwd, stdio: 'ignore' });
    return null;
  } catch (e) {
    if (e.status === null || e.status === undefined) return e;
    return null;
  }
}

function mcpNamesOf(file) {
  try {
    const cfg = JSON.parse(readText(file) || '');
    if (cfg && cfg.mcp && typeof cfg.mcp === 'object' && !Array.isArray(cfg.mcp)) return Object.keys(cfg.mcp);
  } catch { /* sin config o JSON roto */ }
  return [];
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------

function main() {
  const opts = parseArgs(process.argv.slice(2));
  opts.stack = validateStack(opts.stack);

  // Si no se especifica ruta, usar directorio actual; el pack por defecto es
  // la carpeta del propio script (en el .ps1 estaba hardcodeado a D:\open).
  const projectPath = path.resolve(opts.projectPath || process.cwd());
  const packPath = path.resolve(opts.packPath || __dirname);

  // Verificar que el pack existe
  if (!fs.existsSync(packPath)) {
    console.log('[ERROR] No se encontro el pack en: ' + packPath);
    process.exit(1);
  }
  // Verificar que lo que hay en esa ruta es realmente el pack
  if (!fs.existsSync(path.join(packPath, '.opencode'))) {
    console.log('[ERROR] No se encontro el pack en: ' + packPath);
    console.log('        (la ruta existe pero no contiene .opencode/)');
    console.log('        Indica el origen con: --pack-path <ruta del pack>');
    process.exit(1);
  }
  // Verificar que el proyecto destino existe
  if (!fs.existsSync(projectPath)) {
    console.log('[INFO] Creando directorio del proyecto: ' + projectPath);
    fs.mkdirSync(projectPath, { recursive: true });
  }

  // ============================================================
  // DETECCION DE STACK + FILTRO DE AGENTES
  // ============================================================
  // El pack maestro conserva TODOS los agentes. Aqui se decide con cuantos
  // arranca el proyecto: el nucleo spec-driven es identico para todos,
  // solo se descartan reviewers/resolvers de otros lenguajes.
  let agentsToDrop = [];
  let skillsToDrop = [];
  let detectedStack = '';

  if (opts.allAgents) {
    detectedStack = 'all';
    console.log('[INFO] --all-agents: se copian todos los agentes (sin filtro de stack).');
  } else {
    if (!opts.stack) opts.stack = detectStack(projectPath);
    detectedStack = opts.stack || 'unknown';

    if (opts.stack && STACK_KEEP[opts.stack]) {
      const keep = STACK_KEEP[opts.stack];
      agentsToDrop = STACK_AGENTS.filter(a => keep.indexOf(a) === -1);
    } else {
      // Stack desconocido -> conservar todo antes que filtrar de mas
      agentsToDrop = [];
    }

    // Skills: mismo criterio conservador. Stack desconocido o node -> todo.
    if (opts.stack && STACK_SKILLS[opts.stack]) {
      skillsToDrop = STACK_SKILLS[opts.stack].slice();
    } else {
      skillsToDrop = [];
    }

    if (agentsToDrop.length > 0) {
      console.log('[STACK] Detectado: ' + detectedStack + '  |  agentes de lenguaje que NO aplican: ' + agentsToDrop.length);
      console.log('        (nucleo spec-driven completo: prd, plan, tasks, verify, audit, trace, security, testing)');
    } else if (detectedStack === 'unknown') {
      console.log('[STACK] No detecte stack en el proyecto -> copio todos los agentes.');
      console.log('        Usa --stack flutter para filtrar, o --all-agents para forzar la biblioteca completa.');
    }
  }

  console.log('');
  console.log(SEP);
  console.log('   PACK OPENCODE COMPLETO - INSTALADOR');
  console.log(SEP);
  console.log('');
  console.log('Pack origen:      ' + packPath);
  console.log('Proyecto destino: ' + projectPath);
  console.log('');
  console.log('Contenido del pack:');
  const pkAgents = countMd(path.join(packPath, '.opencode', 'agents'));
  const pkCommands = countMd(path.join(packPath, '.opencode', 'commands'));
  const pkSkills = countDirs(path.join(packPath, '.agents', 'skills'));
  const pkMcpNames = mcpNamesOf(path.join(packPath, 'opencode.json'));
  console.log('  - ' + pkAgents + ' agents especializados');
  console.log('  - ' + pkCommands + ' slash commands');
  console.log('  - ' + pkSkills + ' skills');
  console.log('  - ' + (pkMcpNames.length ? pkMcpNames.length + ' MCPs (' + pkMcpNames.join(', ') + ')' : 'MCPs: sin configurar'));
  console.log('  - 16+ CLI scripts');
  console.log('  - Plugins (vibeguard, pty, dcp)');
  console.log('  - Manual completo');
  if (agentsToDrop.length > 0) {
    console.log("  - Filtro de stack '" + detectedStack + "': " + agentsToDrop.length + ' agentes de lenguaje NO se copian');
  } else if (opts.allAgents) {
    console.log('  - Sin filtro: se copian todos los agentes (--all-agents)');
  }
  console.log('');

  // ============================================================
  // FASE 1: ARCHIVOS RAIZ
  // ============================================================
  console.log(DASH);
  console.log('[1/7] Archivos raiz...');
  console.log(DASH);

  mergeJsonConservative(path.join(packPath, 'opencode.json'), path.join(projectPath, 'opencode.json'),
    'opencode.json (MCP activo: context7; el resto, opt-in)');
  mergeJsonConservative(path.join(packPath, 'skills-lock.json'), path.join(projectPath, 'skills-lock.json'),
    'skills-lock.json');
  mergeGitignore(path.join(packPath, '.gitignore'), path.join(projectPath, '.gitignore'));

  // ============================================================
  // FASE 2: .opencode/ COMPLETO
  // ============================================================
  console.log('');
  console.log(DASH);
  console.log('[2/7] Carpeta .opencode/ completa...');
  console.log(DASH);

  copyItemSafe(path.join(packPath, '.opencode'), path.join(projectPath, '.opencode'),
    '.opencode/ (agents, commands, plugins, bin, manual, templates, etc.)');

  // --- Filtro de agentes por stack (solo si corresponde) ---
  const agentsDir = path.join(projectPath, '.opencode', 'agents');
  if (agentsToDrop.length > 0) {
    let dropped = 0;
    for (const name of agentsToDrop) {
      const f = path.join(agentsDir, name + '.md');
      if (fs.existsSync(f)) {
        try { fs.rmSync(f, { force: true }); } catch { /* SilentlyContinue */ }
        if (!fs.existsSync(f)) dropped++;
      }
    }
    const remaining = countMd(agentsDir);
    console.log('  [OK] Agentes: ' + remaining + ' en el proyecto (' + dropped + " descartados por stack '" + detectedStack + "')");
  } else {
    console.log('  [OK] Agentes: ' + countMd(agentsDir) + ' en el proyecto (sin filtro)');
  }

  // --- Marcador de stack instalado ---
  // Lo lee smoke-test.js para exigir el umbral de agents correcto:
  // filtrado por stack (~50) vs pack maestro (~85).
  const stackMarkerFile = path.join(projectPath, '.opencode', '.stack');
  if (agentsToDrop.length > 0) {
    try {
      fs.mkdirSync(path.dirname(stackMarkerFile), { recursive: true });
      fs.writeFileSync(stackMarkerFile, detectedStack, 'ascii'); // -NoNewline -Encoding ascii
    } catch (e) {
      console.log('  [WARN] No pude escribir .stack: ' + firstLine(e.message));
    }
  } else if (fs.existsSync(stackMarkerFile)) {
    try { fs.rmSync(stackMarkerFile, { force: true }); } catch { /* best effort */ }
  }

  // --- Poda de comandos huerfanos ---
  // Un comando cuyo frontmatter `agent:` apunta a un agente que se filtro por
  // stack quedaria roto: OpenCode no encontraria el agente. Se descarta junto
  // con el. `build` es un agente built-in de OpenCode (no es un archivo .md):
  // no aplica. Select-String es line-a-linea: el regex ancla por linea.
  if (agentsToDrop.length > 0) {
    const cmdsDir = path.join(projectPath, '.opencode', 'commands');
    let cmdFiles = [];
    try { cmdFiles = fs.readdirSync(cmdsDir).filter(f => f.endsWith('.md')); } catch { /* sin commands */ }
    let droppedCmds = 0;
    for (const name of cmdFiles) {
      const f = path.join(cmdsDir, name);
      let raw = null;
      try { raw = fs.readFileSync(f, 'utf8'); } catch { continue; }
      const hit = /^[ \t]*agent:[ \t]*(\S+)/m.exec(raw);
      if (!hit) continue;
      const cmdAgent = hit[1];
      if (cmdAgent === 'build') continue;
      if (agentsToDrop.indexOf(cmdAgent) !== -1) {
        try { fs.rmSync(f, { force: true }); } catch { /* SilentlyContinue */ }
        if (!fs.existsSync(f)) droppedCmds++;
      }
    }
    if (droppedCmds > 0) {
      console.log('  [OK] Commands: ' + droppedCmds + ' descartados (su agent se filtro por stack)');
    }
  }

  // ============================================================
  // FASE 3: .agents/ (SKILLS)
  // ============================================================
  console.log('');
  console.log(DASH);
  console.log('[3/7] Carpeta .agents/ (40 skills)...');
  console.log(DASH);

  copyItemSafe(path.join(packPath, '.agents'), path.join(projectPath, '.agents'),
    '.agents/ (40 skills incluyendo: stripe, clerk, supabase, firebase, docker, github-actions, vercel, railway, turso, drizzle)');

  // --- Poda de skills que no aplican al stack ---
  // 1) se borra la carpeta del skill
  // 2) se borra su fila en router/SKILL.md (si no, el router despacharia a
  //    algo inexistente). Se reescriben bytes para respetar el BOM del
  //    original: meter/quitar el BOM haria fallar el parser de frontmatter.
  if (skillsToDrop.length > 0) {
    const skillsDir = path.join(projectPath, '.agents', 'skills');
    let droppedSkills = 0;
    for (const s of skillsToDrop) {
      const dir = path.join(skillsDir, s);
      if (fs.existsSync(dir)) {
        try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* SilentlyContinue */ }
        if (!fs.existsSync(dir)) droppedSkills++;
      }
    }

    if (droppedSkills > 0) {
      const routerSkill = path.join(skillsDir, 'router', 'SKILL.md');
      if (fs.existsSync(routerSkill)) {
        const buf = fs.readFileSync(routerSkill);
        const hadBom = buf.length >= 3 && buf[0] === 0xEF && buf[1] === 0xBB && buf[2] === 0xBF;
        let raw = buf.toString('utf8');
        if (raw.charCodeAt(0) === 0xFEFF) raw = raw.slice(1); // = Substring(1) del .ps1
        for (const s of skillsToDrop) {
          // solo filas cuyo destino es ese skill (entre backticks)
          const re = new RegExp('^[^\\r\\n]*`' + escRe(s) + '`[^\\r\\n]*(\\r?\\n|$)', 'gm');
          raw = raw.replace(re, '');
        }
        fs.writeFileSync(routerSkill, (hadBom ? '\uFEFF' : '') + raw, 'utf8');
      }
      console.log('  [OK] Skills: ' + droppedSkills + ' descartados por stack (JS/TS): ' + skillsToDrop.join(', '));
    }
  }

  // --- Auto-limpieza de anidados ---
  // El bug del .ps1 (`Copy-Item <dir> -Dest <dir existente> -Recurse`) dejo
  // `.opencode/.opencode/` y `.agents/.agents/` en proyectos ya instalados.
  // El pack nunca contiene esas rutas, asi que siempre son restos.
  for (const nested of ['.opencode/.opencode', '.agents/.agents']) {
    const junk = path.join(projectPath, nested);
    if (fs.existsSync(junk)) {
      const n = countFilesDeep(junk);
      try { fs.rmSync(junk, { recursive: true, force: true }); } catch { /* SilentlyContinue */ }
      if (!fs.existsSync(junk)) {
        console.log('  [OK] Limpieza: ' + nested + ' eliminado (' + n + ' archivos residuales del bug de copia)');
      }
    }
  }

  // --- Refresca los bloques ## Counts del proyecto instalado ---
  // Los README se copian del pack ya con los numeros del MAESTRO. Sin
  // regenerarlos, un proyecto filtrado diria "85 agents" cuando tiene 59.
  // counts.js --update solo toca los archivos que traen marcadores en su
  // propia linea, asi que un README sin bloque queda intacto.
  const countsScript = path.join(projectPath, '.opencode', 'bin', 'counts.js');
  const countTargets = [
    path.join(projectPath, '.opencode', 'README.md'),
    path.join(projectPath, '.opencode', 'manual', 'README.md'),
  ].filter(f => fs.existsSync(f));
  if (fs.existsSync(countsScript) && countTargets.length > 0) {
    const err = spawnNodeQuiet([countsScript, '--update', ...countTargets], projectPath);
    if (err) {
      console.log('  [WARN] No pude regenerar los conteos: ' + firstLine(err.message));
    } else {
      console.log('  [OK] Conteos (## Counts) regenerados para este proyecto');
      copied++;
    }
  }

  // --- Regenera los indices generados ---
  // AGENTS_INDEX.md y .agents/skills/INDEX.md los escanean en disco: su pie
  // `**Total**: N agents` es un numero real, no una cita. Copiados desde el
  // pack traerian el total del MAESTRO y mentirian en un proyecto filtrado.
  const indexBuilders = [
    path.join(projectPath, '.opencode', 'bin', 'build-agents-index.js'),
    path.join(projectPath, '.opencode', 'bin', 'build-skills-index.js'),
  ].filter(f => fs.existsSync(f));
  if (indexBuilders.length > 0) {
    let err = null;
    for (const b of indexBuilders) {
      err = spawnNodeQuiet([b], projectPath);
      if (err) break;
    }
    if (err) {
      console.log('  [WARN] No pude regenerar los indices: ' + firstLine(err.message));
    } else {
      console.log('  [OK] Indices regenerados (AGENTS_INDEX, skills/INDEX)');
      copied++;
    }
  }

  // --- Junctions de compatibilidad (opencode 1.17.x) ---
  // Se crean DESPUES de copiar .agents/ porque .opencode/skill apunta ahi.
  const okAgent = ensureLink(path.join(projectPath, '.opencode', 'agent'), path.join(projectPath, '.opencode', 'agents'));
  const okSkill = ensureLink(path.join(projectPath, '.opencode', 'skill'), path.join(projectPath, '.agents', 'skills'));
  const bothOk = okAgent && okSkill;
  console.log('  [' + (bothOk ? 'OK' : 'WARN') + '] Junctions compat 1.17.x: agent=' +
    (okAgent ? 'ok' : 'no') + ' skill=' + (okSkill ? 'ok' : 'no'));

  // ============================================================
  // FASE 4: ESTRUCTURA DOCS
  // ============================================================
  if (!opts.skipDocs) {
    console.log('');
    console.log(DASH);
    console.log('[4/7] Estructura docs/...');
    console.log(DASH);

    const docFolders = [
      'docs',
      'docs/audits',
      'docs/instincts',
      'docs/plans',
      'docs/prds',
      'docs/reports',
      'docs/sessions',
      'docs/state',
    ];

    for (const folder of docFolders) {
      const dest = path.join(projectPath, folder);
      if (!fs.existsSync(dest)) {
        try {
          fs.mkdirSync(dest, { recursive: true });
          console.log('  [OK] ' + folder + '/');
          copied++;
        } catch (e) {
          console.log('  [ERROR] ' + folder + '/ - ' + firstLine(e.message));
          errors++;
        }
      } else {
        console.log('  [SKIP] ' + folder + '/ (ya existe)');
        skipped++;
      }
    }

    // Copiar archivos .gitkeep si existen
    const gitkeepSource = path.join(packPath, 'docs');
    const gitkeeps = [];
    const walkGitkeep = (d) => {
      let entries;
      try { entries = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
      for (const e of entries) {
        const full = path.join(d, e.name);
        if (e.isSymbolicLink()) continue;
        if (e.isDirectory()) walkGitkeep(full);
        else if (e.name === '.gitkeep') gitkeeps.push(full);
      }
    };
    walkGitkeep(gitkeepSource);
    for (const gk of gitkeeps) {
      const relativePath = path.relative(gitkeepSource, gk);
      const destGk = path.join(projectPath, 'docs', relativePath);
      const destDir = path.dirname(destGk);
      if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
      if (!fs.existsSync(destGk)) fs.copyFileSync(gk, destGk);
    }
  } else {
    console.log('');
    console.log(DASH);
    console.log('[4/7] Estructura docs/ (OMITIDO)');
    console.log(DASH);
  }

  // ============================================================
  // FASE 5: DOCUMENTACION DEL PACK
  // ============================================================
  console.log('');
  console.log(DASH);
  console.log('[5/7] Documentacion del pack...');
  console.log(DASH);

  // Copiar README.md del pack si el destino no tiene uno
  const readmeDest = path.join(projectPath, 'README.md');
  if (!fs.existsSync(readmeDest)) {
    copyItemSafe(path.join(packPath, 'docs', 'README.md'), readmeDest, 'README.md', true);
  } else {
    console.log('  [SKIP] README.md (ya existe en destino)');
    skipped++;
  }

  // Copiar PROJECT.md si existe.
  // Se copia SIN el bloque "## Recent Activity": ese historial es del pack,
  // no del proyecto de destino, y sus enlaces apuntan a docs/plans|audits|
  // sessions, que no se instalan. project-init --refresh lo rellena despues
  // con los ficheros reales del proyecto.
  const projectSrc = path.join(packPath, 'docs', 'PROJECT.md');
  const projectDest = path.join(projectPath, 'docs', 'PROJECT.md');
  copyItemSafe(projectSrc, projectDest, 'docs/PROJECT.md', true);
  if (fs.existsSync(projectDest)) {
    try {
      let raw = readText(projectDest);
      if (raw === null) raw = '';
      const marker = '## Recent Activity';
      const idx = raw.toLowerCase().indexOf(marker.toLowerCase());
      if (idx >= 0) {
        const head = raw.slice(0, idx).replace(/[ \r\n]+$/, '');
        const clean = head + '\r\n\r\n' + marker + '\r\n' +
          '<!-- auto-managed: appended by project-init.js. Do not edit by hand. -->\r\n\r\n' +
          '<!-- (no activity detected yet) -->\r\n';
        // UTF-8 SIN BOM: equivalente al UTF8Encoding($false) del .ps1
        fs.writeFileSync(projectDest, clean, 'utf8');
      }
    } catch (e) {
      console.log('  [WARN] no se pudo recortar PROJECT.md: ' + firstLine(e.message));
    }
  }

  // ============================================================
  // FASE 6: INSTALAR DEPENDENCIAS NPM
  // ============================================================
  if (!opts.skipInstall) {
    console.log('');
    console.log(DASH);
    console.log('[6/7] Instalando plugins npm...');
    console.log(DASH);

    const opencodeDir = path.join(projectPath, '.opencode');
    const packageJson = path.join(opencodeDir, 'package.json');

    if (fs.existsSync(packageJson)) {
      console.log('  Ejecutando npm install...');
      const r = spawnSync('npm', ['install', '--silent'], {
        cwd: opencodeDir,
        stdio: 'ignore',
        shell: process.platform === 'win32',
      });
      if (r.error) {
        console.log('  [ERROR] Fallo npm install: ' + firstLine(r.error.message));
        errors++;
      } else if (r.status === 0) {
        console.log('  [OK] Plugins instalados correctamente');
        copied++;
      } else {
        console.log('  [WARN] npm termino con codigo: ' + r.status);
      }
    } else {
      console.log('  [SKIP] package.json no encontrado');
      skipped++;
    }
  } else {
    console.log('');
    console.log(DASH);
    console.log('[6/7] Instalacion npm (OMITIDA)');
    console.log(DASH);
  }

  // ============================================================
  // FASE 7: VERIFICACION FINAL
  // ============================================================
  console.log('');
  console.log(DASH);
  console.log('[7/7] Verificacion final...');
  console.log(DASH);

  // El minimo de agentes depende de si se filtro por stack:
  //  - sin filtro  -> se esperan los ~84 del pack maestro
  //  - con filtro  -> se esperan los del nucleo + el stack detectado (~56-75)
  const agentsMin = agentsToDrop.length > 0 ? 50 : 80;

  const checks = [
    { rel: '.opencode/agents', name: 'Agents', min: agentsMin },
    { rel: '.opencode/commands', name: 'Commands', min: 60 },
    { rel: '.agents/skills', name: 'Skills', min: 35, dirs: true },
    { rel: '.opencode/plugins', name: 'Plugins', min: 1 },
    { rel: '.opencode/bin', name: 'CLI Scripts', min: 10 },
    { rel: '.opencode/manual', name: 'Manual', min: 5 },
    { rel: '.opencode/templates', name: 'Templates', min: 1 },
    { rel: 'opencode.json', name: 'Config (MCPs)', min: 1 },
  ];

  let allGood = true;
  for (const check of checks) {
    const fullPath = path.join(projectPath, check.rel);
    if (fs.existsSync(fullPath)) {
      // Skills se cuentan por carpeta: contar ficheros incluiria los assets
      // de cada skill y pintaria un numero mayor que el de skills reales.
      const isDir = fs.statSync(fullPath).isDirectory();
      const count = !isDir ? 1 : (check.dirs ? countDirs(fullPath) : countFilesDeep(fullPath));
      const good = count >= check.min;
      console.log('  ' + (good ? '[OK]' : '[WARN]') + ' ' + check.name + ': ' + count + ' archivos (min: ' + check.min + ')');
      if (!good) allGood = false;
    } else {
      console.log('  [FAIL] ' + check.name + ': No encontrado');
      allGood = false;
    }
  }

  // Verificar MCPs en opencode.json
  const mcpConfig = path.join(projectPath, 'opencode.json');
  if (fs.existsSync(mcpConfig)) {
    const mcpNames = mcpNamesOf(mcpConfig);
    console.log('  [OK] MCPs configurados: ' + mcpNames.length + ' (' + mcpNames.join(', ') + ')');
  }

  console.log('');
  console.log(SEP);
  console.log('   RESUMEN');
  console.log(SEP);
  console.log('');
  console.log('  Copiados:  ' + copied + ' elementos');
  console.log('  Omitidos:  ' + skipped + ' elementos');
  console.log('  Errores:   ' + errors + ' elementos');
  console.log('');

  if (allGood && errors === 0) {
    const finAgents = countMd(path.join(projectPath, '.opencode', 'agents'));
    const finCommands = countMd(path.join(projectPath, '.opencode', 'commands'));
    const finSkills = countDirs(path.join(projectPath, '.agents', 'skills'));
    const finMcpNames = mcpNamesOf(mcpConfig);
    const filterText = agentsToDrop.length > 0
      ? "(filtrados por stack '" + detectedStack + "'; " + agentsToDrop.length + ' de lenguaje descartados)'
      : '(biblioteca completa)';

    console.log('  [EXITO] Pack instalado correctamente!');
    console.log('');
    console.log('  Contenido instalado:');
    console.log('    - ' + finAgents + ' agents ' + filterText);
    console.log('    - ' + finCommands + ' slash commands');
    console.log('    - ' + finSkills + ' skills (stripe, clerk, supabase, docker, vercel, etc.)');
    console.log('    - ' + finMcpNames.length + ' MCPs' + (finMcpNames.length ? ' (' + finMcpNames.join(', ') + ')' : ''));
    console.log('    - CLI scripts de validacion y utilidades');
    console.log('    - Plugins (vibeguard, pty, dcp)');
    console.log('    - Manual completo');
    console.log('    - Templates y estructura docs');
    console.log('');
    console.log('  Ciclo Spec-Driven disponible desde el minuto 1:');
    console.log('    /prd -> /spec-lint -> /plan -> /tasks -> /verify -> /audit-report -> /trace');
    console.log('    (+ /change-request cuando el requisito cambie a mitad de ciclo)');
    console.log('');
    console.log('  Siguiente paso:');
    console.log('    cd ' + projectPath);
    console.log('    opencode .');
    console.log('');
    console.log('  Ejemplos de uso:');
    console.log('    "Crea una app SaaS con login y pagos"');
    console.log('    "Deploy a Vercel"');
    console.log('    "Crea app movil con React Native"');
  } else {
    console.log('  [AVISO] Instalacion completada con advertencias');
    console.log('  Revisa los errores arriba');
  }

  console.log('');
  console.log(SEP);
}

try {
  main();
} catch (e) {
  console.log('[ERROR] ' + firstLine(e && e.message ? e.message : e));
  process.exit(1);
}
