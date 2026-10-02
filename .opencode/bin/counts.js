#!/usr/bin/env node
/**
 * counts.js - single source of truth for pack surface-area numbers
 *
 * Scans the filesystem to compute exact counts of agents, commands,
 * skills, plugins, MCPs, and CLIs. Output as JSON (--json) or as a
 * markdown "## Counts" block (--update <files...>).
 *
 * Usage:
 *   node .opencode/bin/counts.js --json              # JSON to stdout
 *   node .opencode/bin/counts.js --update <file...>  # inject/replace ## Counts block
 *   node .opencode/bin/counts.js --check             # exit 1 if any tracked file is stale
 *
 * The --update mode replaces a fenced `## Counts` block (auto-managed)
 * between the markers `<!-- COUNTS-START -->` and `<!-- COUNTS-END -->`.
 * Files without those markers are left untouched (use the marker pair
 * to opt in). This is the durable fix for H1 (skill/agent count drift
 * across 4+ README surfaces).
 *
 * Zero deps, CommonJS, Windows + POSIX.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const AGENTS_DIR = path.join(ROOT, '.opencode', 'agents');
const COMMANDS_DIR = path.join(ROOT, '.opencode', 'commands');
const SKILLS_DIR = path.join(ROOT, '.agents', 'skills');
const BIN_DIR = path.join(__dirname); // this script's dir
const PLUGINS_DIR = path.join(ROOT, '.opencode', 'plugins');
const PKG = path.join(__dirname, '..', 'package.json');
const ROOT_OPENCODE = path.join(ROOT, 'opencode.json');
const MCP_OPTIONAL = path.join(__dirname, '..', 'mcp.optional.json');

function countMdFiles(dir) {
  if (!fs.existsSync(dir)) return 0;
  return fs.readdirSync(dir).filter(f => f.endsWith('.md') && f !== 'INDEX.md').length;
}

function countSkillDirs(dir) {
  if (!fs.existsSync(dir)) return 0;
  return fs.readdirSync(dir).filter(f => {
    try { return fs.statSync(path.join(dir, f)).isDirectory(); } catch { return false; }
  }).length;
}

function countJsFiles(dir) {
  if (!fs.existsSync(dir)) return 0;
  return fs.readdirSync(dir).filter(f => f.endsWith('.js')).length;
}

function readJsonSafe(p) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
  catch { return null; }
}

function compute() {
  // CLIs = bin/ .js files MINUS this script (counts.js itself is meta, not a CLI)
  const clis = countJsFiles(BIN_DIR) - 1;

  // NPM plugins = package.json dependencies matching opencode plugin convention
  const pkgJson = readJsonSafe(PKG);
  let npmPlugins = 0;
  if (pkgJson) {
    const all = Object.assign({}, pkgJson.dependencies || {}, pkgJson.devDependencies || {});
    npmPlugins = Object.keys(all).filter(k => /opencode/i.test(k) && k !== '@opencode-ai/plugin').length;
  }

  // Local plugins = .js files in .opencode/plugins/
  const localPlugins = countJsFiles(PLUGINS_DIR);

  // Active MCPs = keys in root opencode.json mcp section
  const oc = readJsonSafe(ROOT_OPENCODE);
  let activeMcps = 0;
  if (oc && oc.mcp && typeof oc.mcp === 'object') activeMcps = Object.keys(oc.mcp).length;

  // Optional MCPs = items in .opencode/mcp.optional.json optional_mcps array
  const mcpOpt = readJsonSafe(MCP_OPTIONAL);
  let optionalMcps = 0;
  if (mcpOpt && Array.isArray(mcpOpt.optional_mcps)) optionalMcps = mcpOpt.optional_mcps.length;

  return {
    agents: countMdFiles(AGENTS_DIR),
    commands: countMdFiles(COMMANDS_DIR),
    skills: countSkillDirs(SKILLS_DIR),
    clis: Math.max(0, clis),
    plugins_npm: npmPlugins,
    plugins_local: localPlugins,
    mcps_active: activeMcps,
    mcps_optional: optionalMcps,
  };
}

function renderMarkdown(c) {
  const lines = [];
  lines.push('<!-- COUNTS-START -->');
  lines.push('## Counts');
  lines.push('');
  lines.push('> Auto-managed by `.opencode/bin/counts.js`. Do not edit by hand.');
  lines.push('> Regenerate: `node .opencode/bin/counts.js --update <files...>`');
  lines.push('');
  lines.push(`- **${c.agents}** agents (.opencode/agents)`);
  lines.push(`- **${c.commands}** commands (.opencode/commands)`);
  lines.push(`- **${c.skills}** skills (.agents/skills)`);
  lines.push(`- **${c.clis}** native CLIs (.opencode/bin)`);
  lines.push(`- **${c.plugins_npm}** npm plugins + **${c.plugins_local}** local plugin(s)`);
  lines.push(`- **${c.mcps_active}** active MCPs + **${c.mcps_optional}** optional MCP(s)`);
  lines.push('<!-- COUNTS-END -->');
  return lines.join('\n');
}

// Los marcadores SOLO cuentan si estan solos en su linea. El CHANGELOG cita
// `<!-- COUNTS-START -->` dentro de una frase: con indexOf() generico,
// --update inyectaba el bloque en mitad del texto y --check lo marcaba
// STALE para siempre. Anclar a la linea elimina ambos falsos positivos.
function findMarkers(text) {
  const startMatch = /^<!-- COUNTS-START -->[ \t]*\r?$/m.exec(text);
  if (!startMatch) return null;
  const startIdx = startMatch.index;
  const endMatch = /^<!-- COUNTS-END -->[ \t]*\r?$/m.exec(text.slice(startIdx));
  if (!endMatch) return null;
  return {
    startIdx,
    endIdx: startIdx + endMatch.index,
    endLen: endMatch[0].length,
  };
}

function updateFile(file, block) {
  const text = fs.readFileSync(file, 'utf8');
  const m = findMarkers(text);
  if (!m) {
    return { ok: false, reason: 'no markers' };
  }
  const before = text.slice(0, m.startIdx);
  const after = text.slice(m.endIdx + m.endLen);
  fs.writeFileSync(file, before + block + after, 'utf8');
  return { ok: true };
}

function findCountFiles(dir, out = []) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === 'node_modules' || e.name === '.git') continue;
      findCountFiles(full, out);
    } else if (e.name.endsWith('.md')) {
      try {
        const t = fs.readFileSync(full, 'utf8');
        if (findMarkers(t)) out.push(full);
      } catch { /* unreadable */ }
    }
  }
  return out;
}

function main() {
  const args = process.argv.slice(2);
  const asJson = args.includes('--json');
  const check = args.includes('--check');
  const updateIdx = args.indexOf('--update');
  const updateFiles = updateIdx >= 0 ? args.slice(updateIdx + 1).filter(a => !a.startsWith('--')) : [];

  const counts = compute();

  if (asJson) {
    process.stdout.write(JSON.stringify(counts, null, 2) + '\n');
    return;
  }

  const block = renderMarkdown(counts);

  if (updateFiles.length > 0) {
    for (const f of updateFiles) {
      const res = updateFile(f, block);
      if (res.ok) {
        process.stdout.write(`Updated ${f}\n`);
      } else {
        process.stdout.write(`Skipped ${f} (${res.reason})\n`);
      }
    }
    return;
  }

  if (check) {
    // Verify each candidate file matches what counts.js would emit.
    // Sin archivos explicitos hay que DESCUBRIRLOS: con `files = []` el
    // `bad = 0` devolvia siempre exit 0, o sea un falso verde que no
    // valido absolutamente nada.
    let files = args.filter(a => !a.startsWith('--') && fs.existsSync(a));
    if (files.length === 0) files = findCountFiles(ROOT);
    let bad = 0;
    // normalize: el bloque se emite con \n, un archivo en CRLF no es "stale"
    const norm = (s) => s.replace(/\r\n/g, '\n');
    for (const f of files) {
      const text = fs.readFileSync(f, 'utf8');
      if (!findMarkers(text)) continue;
      if (!norm(text).includes(norm(block))) {
        process.stdout.write(`STALE: ${f}\n`);
        bad++;
      }
    }
    process.exit(bad > 0 ? 1 : 0);
  }

  // default: print the markdown block
  process.stdout.write(block + '\n');
}

module.exports = { compute, renderMarkdown, updateFile };

if (require.main === module) {
  main();
}
