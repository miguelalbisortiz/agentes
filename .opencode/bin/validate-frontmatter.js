#!/usr/bin/env node
/**
 * validate-frontmatter.js - validate frontmatter on all agents/skills/commands
 *
 * Checks (zero deps, Node stdlib only):
 *   - agents: description required, mode present, permission recommended
 *   - skills: name + description required, description 1-1024 chars
 *   - commands: description required
 *   - cross-references: skill files referenced in code must exist
 *
 * Usage:
 *   node .opencode/bin/validate-frontmatter.js          # full check
 *   node .opencode/bin/validate-frontmatter.js --quiet  # only show failures
 *
 * Exit codes:
 *   0 = all passed (warnings allowed)
 *   1 = at least one FAIL
 *
 * Status levels:
 *   ok    = passes
 *   warn  = soft issue (does not fail the run)
 *   fail  = hard issue (fails the run)
 */

const fs = require('fs');
const path = require('path');

const CWD = process.cwd();
const QUIET = process.argv.includes('--quiet');

const AGENTS_DIR = path.join(CWD, '.opencode', 'agents');
const SKILLS_DIR = path.join(CWD, '.agents', 'skills');
const COMMANDS_DIR = path.join(CWD, '.opencode', 'commands');
const MANUAL_DIR = path.join(CWD, '.opencode', 'manual');

let passed = 0, failed = 0, warnings = 0;

function log(level, name, msg) {
  if (QUIET && level === 'ok') return;
  const tag = level === 'fail' ? 'FAIL' : level === 'warn' ? 'WARN' : 'ok  ';
  const extra = msg ? `: ${msg}` : '';
  console.log(`  ${tag}  ${name}${extra}`);
  if (level === 'fail') failed++;
  else if (level === 'warn') warnings++;
  else passed++;
}

function readFile(p) {
  try { return fs.readFileSync(p, 'utf8'); } catch { return null; }
}

function listFiles(dir, ext) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter(f => f.endsWith(ext))
    .map(f => path.join(dir, f));
}

function listDirs(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter(f => fs.statSync(path.join(dir, f)).isDirectory())
    .map(f => path.join(dir, f));
}

function parseFrontmatter(content) {
  if (!content) return null;
  // Strip leading HTML comments and blank lines (Prompt Defense reference)
  const stripped = content.replace(/^(?:<!--[^-]*(?:-[^-]+)*-->\s*\n)+\s*/, '');
  if (!stripped.startsWith('---')) return null;
  const end = stripped.indexOf('\n---', 3);
  if (end === -1) return null;
  const block = stripped.substring(3, end);
  // CRLF: la ultima linea del bloque conserva el \r final. Como el regex de
  // key/value usa `.` (que NO matchea \r) y `$` sin flag `m`, esa linea se
  // descartaba en silencio y se perdia el ULTIMO campo del frontmatter
  // (normalmente `agent:`). Se normaliza el fin de linea antes de parsear.
  const lines = block.split(/\r?\n/).map((l) => l.replace(/\r+$/, ''));
  const fm = {};
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const m = line.match(/^([a-zA-Z_][\w-]*)\s*:\s*(.*)$/);
    if (!m) continue;
    const key = m[1];
    let val = m[2].trim();
    // YAML folded scalar (`>` or `>-` or `>+`): collect indented lines, join with space
    if (/^>-?\+?$/.test(val)) {
      const parts = [];
      while (i + 1 < lines.length) {
        const next = lines[i + 1];
        if (!next.startsWith(' ') && !next.startsWith('\t')) break;
        parts.push(next.trim());
        i++;
      }
      fm[key] = parts.join(' ');
      continue;
    }
    // Inline value present
    if (val.length > 0) {
      if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
      if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1);
      fm[key] = val;
      continue;
    }
    // Empty value: collect indented sub-lines (YAML block scalar / nested mapping)
    const sub = {};
    let hasSub = false;
    while (i + 1 < lines.length) {
      const next = lines[i + 1];
      if (!next.startsWith(' ') && !next.startsWith('\t')) break;
      const sm = next.match(/^\s+([a-zA-Z_][\w-]*)\s*:\s*(.*)$/);
      if (!sm) break;
      hasSub = true;
      let sval = sm[2].trim();
      if (sval.startsWith('"') && sval.endsWith('"')) sval = sval.slice(1, -1);
      if (sval.startsWith("'") && sval.endsWith("'")) sval = sval.slice(1, -1);
      sub[sm[1]] = sval;
      i++;
    }
    fm[key] = hasSub ? sub : '';
  }
  return fm;
}

function validateAgent(file) {
  const base = path.basename(file, '.md');
  if (base === 'INDEX') return; // auto-generated index, skip
  const content = readFile(file);
  if (!content) return log('fail', `agent/${base}`, 'cannot read file');

  // Allow leading HTML comments (Prompt Defense reference) before ---
  const stripped = content.replace(/^(?:<!--[^-]*(?:-[^-]+)*-->\s*\n)+\s*/, '');
  if (!stripped.startsWith('---')) {
    return log('fail', `agent/${base}`, 'no frontmatter (no leading ---)');
  }

  const fm = parseFrontmatter(content);
  if (!fm) {
    return log('fail', `agent/${base}`, 'malformed frontmatter (no closing ---)');
  }

  if (!fm.description || fm.description.trim().length === 0) {
    log('fail', `agent/${base}`, 'missing required field: description');
  } else if (fm.description.length < 20) {
    log('warn', `agent/${base}`, `description too short (${fm.description.length} chars, min 20)`);
  } else {
    log('ok', `agent/${base} description (${fm.description.length} chars)`);
  }

  if (!fm.mode) {
    log('fail', `agent/${base}`, 'missing required field: mode (per AGENTS.md: use `subagent`)');
  } else if (fm.mode === 'all') {
    log('warn', `agent/${base}`, "mode is `all` — AGENTS.md standard is `subagent` (more restrictive)");
  } else if (fm.mode === 'subagent' || fm.mode === 'primary') {
    log('ok', `agent/${base} mode (${fm.mode})`);
  } else {
    log('warn', `agent/${base}`, `unknown mode "${fm.mode}" (expected: subagent | primary | all)`);
  }

  if (!fm.permission) {
    log('warn', `agent/${base}`, 'no permission block (recommended: at minimum `edit: deny` for reviewers)');
  } else {
    log('ok', `agent/${base} permission block present`);
  }
}

function validateSkillFile(file) {
  const base = path.basename(path.dirname(file));
  const content = readFile(file);
  if (!content) return log('fail', `skill/${base}/SKILL.md`, 'cannot read file');

  if (!content.startsWith('---')) {
    return log('fail', `skill/${base}/SKILL.md`, 'no frontmatter');
  }

  const fm = parseFrontmatter(content);
  if (!fm) {
    return log('fail', `skill/${base}/SKILL.md`, 'malformed frontmatter');
  }

  if (!fm.name) {
    log('fail', `skill/${base}/SKILL.md`, 'missing required field: name');
  } else if (fm.name !== base) {
    log('fail', `skill/${base}/SKILL.md`, `name "${fm.name}" must match directory "${base}"`);
  } else {
    log('ok', `skill/${base} name`);
  }

  if (!fm.description || fm.description.trim().length === 0) {
    log('fail', `skill/${base}/SKILL.md`, 'missing required field: description');
  } else if (fm.description.length > 1024) {
    log('fail', `skill/${base}/SKILL.md`, `description too long (${fm.description.length} chars, max 1024)`);
  } else if (fm.description.length < 20) {
    log('warn', `skill/${base}/SKILL.md`, `description too short (${fm.description.length} chars, min 20)`);
  } else if (!/^Use (this skill )?when\b/i.test(fm.description)) {
    log('warn', `skill/${base}/SKILL.md`, 'description does not start with "Use when..." (AGENTS.md convention)');
  } else {
    log('ok', `skill/${base} description (${fm.description.length} chars)`);
  }
}

function validateCommand(file) {
  const base = path.basename(file, '.md');
  const content = readFile(file);
  if (!content) return log('fail', `command/${base}`, 'cannot read file');

  if (!content.startsWith('---')) {
    return log('fail', `command/${base}`, 'no frontmatter');
  }

  const fm = parseFrontmatter(content);
  if (!fm) {
    return log('fail', `command/${base}`, 'malformed frontmatter');
  }

  if (!fm.description || fm.description.trim().length === 0) {
    log('fail', `command/${base}`, 'missing required field: description');
  } else if (fm.description.length < 10) {
    log('warn', `command/${base}`, `description too short (${fm.description.length} chars)`);
  } else {
    log('ok', `command/${base} description (${fm.description.length} chars)`);
  }

  if (fm.agent) {
    const a = String(fm.agent).trim();
    // `build`, `plan`, `explore`... son built-ins de OpenCode: no son archivos .md
    const BUILTIN = ['build', 'plan', 'general', 'explore', 'compaction', 'title', 'task', 'session'];
    const isBuiltin = BUILTIN.includes(a);
    const exists = fs.existsSync(path.join(CWD, '.opencode', 'agents', `${a}.md`));
    if (isBuiltin || exists) {
      log('ok', `command/${base} agent: ${a}${isBuiltin ? ' (builtin)' : ''}`);
    } else {
      log('fail', `command/${base}`, `agent: "${a}" not found in .opencode/agents/ -> orphan command`);
    }
  } else {
    log('warn', `command/${base}`, 'no `agent:` in frontmatter (will run in primary agent context)');
  }
}

function validateCrossRefs() {
  const refPattern = /\.opencode\/(skills|agents|commands)\/([a-z0-9-]+)/g;
  // Also check relative markdown links to other docs in .opencode/manual/
  // and to the root README/AGENTS (e.g. `[x](./foo.md)`, `[x](.opencode/manual/foo.md)`).
  const docLinkPattern = /\[([^\]]+)\]\((?:\.{1,2}\/|\.opencode\/docs\/|#?[\w./-]+\.md)\)/g;
  const checkDirs = [
    path.join(CWD, '.opencode', 'agents'),
    path.join(CWD, '.opencode', 'commands'),
    MANUAL_DIR,
    path.join(CWD, 'INSTRUCTIONS.md'.replace(/^/, CWD)),
    path.join(CWD, 'AGENTS.md'),
    path.join(CWD, 'README.md'),
  ].filter(p => fs.existsSync(p));

  // Strip fenced code blocks before matching — avoid false positives
  // when a file embeds an example like `.opencode/agents/foo.md` inside
  // a code block.
  function stripCodeBlocks(s) {
    return s.replace(/```[\s\S]*?```/g, '').replace(/`[^`\n]+`/g, '');
  }

  let checked = 0;
  for (const dir of checkDirs) {
    const stat = fs.statSync(dir);
    if (stat.isFile()) {
      const content = readFile(dir);
      if (!content) continue;
      const scan = stripCodeBlocks(content);
      const isInManual = dir.includes(`${path.sep}manual${path.sep}`) || dir.endsWith(`${path.sep}manual`);
      const isInManualRoot = path.basename(dir) === 'manual' && stat.isDirectory();

      if (isInManualRoot) continue; // handled below by directory walk

      // Pattern 1: .opencode/{skills,agents,commands}/<name>
      let m;
      refPattern.lastIndex = 0;
      while ((m = refPattern.exec(scan)) !== null) {
        const [, kind, name] = m;
        let target;
        if (kind === 'skills') target = path.join(CWD, '.opencode', 'skills', name, 'SKILL.md');
        else if (kind === 'agents') target = path.join(CWD, '.opencode', 'agents', `${name}.md`);
        else if (kind === 'commands') target = path.join(CWD, '.opencode', 'commands', `${name}.md`);
        if (target && !fs.existsSync(target)) {
          log('fail', `cross-ref`, `${path.basename(dir)} references missing ${kind}/${name}`);
        }
        checked++;
      }

      // Pattern 2: markdown links to local .md files (only when in .opencode/manual/)
      if (isInManual) {
        const baseDir = path.dirname(dir);
        docLinkPattern.lastIndex = 0;
        while ((m = docLinkPattern.exec(scan)) !== null) {
          const link = m[1];
          // skip anchors (#...) and http(s)://
          if (link.startsWith('#') || link.startsWith('http')) continue;
          const resolved = path.resolve(baseDir, link);
          if (link.endsWith('.md') && !fs.existsSync(resolved)) {
            log('fail', `cross-ref`, `${path.basename(dir)} links to missing ${link}`);
          }
          checked++;
        }
      }
    } else if (stat.isDirectory()) {
      // Walk .opencode/manual/ — each .md inside may link to siblings
      const mdFiles = fs.readdirSync(dir).filter(f => f.endsWith('.md')).map(f => path.join(dir, f));
      for (const f of mdFiles) {
        const content = readFile(f);
        if (!content) continue;
        const scan = stripCodeBlocks(content);
        const baseDir = path.dirname(f);
        let m;
        docLinkPattern.lastIndex = 0;
        while ((m = docLinkPattern.exec(scan)) !== null) {
          const link = m[1];
          if (link.startsWith('#') || link.startsWith('http')) continue;
          const resolved = path.resolve(baseDir, link);
          if (link.endsWith('.md') && !fs.existsSync(resolved)) {
            log('fail', `cross-ref`, `${path.basename(f)} links to missing ${link}`);
          }
          checked++;
        }
      }
    }
  }
  if (checked > 0) log('ok', `cross-refs (${checked} checked)`);
}

function validateBodySkillRefs() {
  // Build the catalog of known skill names from .agents/skills/
  const skillNames = listDirs(SKILLS_DIR).map(d => path.basename(d));
  const skillSet = new Set(skillNames);
  // Find positions of "skill:" / "skills:" (with optional preceding word
  // like "Reference", "see", "See also", "Use"). Then within the rest of
  // the line, extract any backticked lowercase-hyphenated names and check
  // each against the skill catalog. Handles comma-separated lists AND
  // "X and Y" / "X or Y" patterns.
  const skillKeywordPattern = /\b(?:[A-Za-z]+\s+)?[Ss]kills?\s*:/g;
  const nameInBackticks = /`([a-z][a-z0-9-]+)`/g;
  let checked = 0, valid = 0;
  const agentFiles = listFiles(AGENTS_DIR, '.md');
  for (const file of agentFiles) {
    const base = path.basename(file, '.md');
    if (base === 'INDEX') continue;
    const content = readFile(file);
    if (!content) continue;
    // Extract body (after frontmatter close `---` on its own line)
    const stripped = content.replace(/^(?:<!--[^-]*(?:-[^-]+)*-->\s*\n)+\s*/, '');
    const fmEnd = stripped.indexOf('\n---', 3);
    if (fmEnd === -1) continue;
    let body = stripped.substring(fmEnd + 4);
    // Strip only fenced code blocks (keep inline backticks — our regex needs them)
    body = body.replace(/```[\s\S]*?```/g, '');
    let m;
    skillKeywordPattern.lastIndex = 0;
    const seen = new Set();
    while ((m = skillKeywordPattern.exec(body)) !== null) {
      // After "skill(s):", look at the rest of the line
      const after = m.index + m[0].length;
      const lineEnd = body.indexOf('\n', after);
      const slice = body.substring(after, lineEnd === -1 ? after + 500 : lineEnd);
      let nm;
      nameInBackticks.lastIndex = 0;
      while ((nm = nameInBackticks.exec(slice)) !== null) {
        const name = nm[1];
        if (seen.has(name)) continue;
        seen.add(name);
        checked++;
        if (skillSet.has(name)) {
          valid++;
        } else {
          log('warn', `body-ref/${base}`, `references missing skill \`${name}\``);
        }
      }
    }
  }
  if (checked > 0) {
    log('ok', `body-refs`, `(${checked} skill refs checked, ${valid} valid, ${checked - valid} missing)`);
  }
}

function main() {
  console.log('Frontmatter Validation');
  console.log('======================\n');

  console.log('[Agents]');
  const agents = listFiles(AGENTS_DIR, '.md');
  for (const f of agents) validateAgent(f);
  console.log(`  ${agents.length} agents checked\n`);

  console.log('[Skills]');
  const skillDirs = listDirs(SKILLS_DIR);
  for (const d of skillDirs) {
    const f = path.join(d, 'SKILL.md');
    if (fs.existsSync(f)) validateSkillFile(f);
    else log('fail', `skill/${path.basename(d)}`, 'missing SKILL.md');
  }
  console.log(`  ${skillDirs.length} skills checked\n`);

  console.log('[Commands]');
  const commands = listFiles(COMMANDS_DIR, '.md');
  for (const f of commands) validateCommand(f);
  console.log(`  ${commands.length} commands checked\n`);

  console.log('[Cross-references]');
  validateCrossRefs();
  console.log('');

  console.log('[Body skill refs]');
  validateBodySkillRefs();
  console.log('');

  console.log('Summary');
  console.log('=======');
  console.log(`  PASSED:   ${passed}`);
  console.log(`  WARNINGS: ${warnings}`);
  console.log(`  FAILED:   ${failed}`);

  if (failed > 0) {
    console.log('\nFAILED — fix the hard issues above before committing.');
    process.exit(1);
  } else if (warnings > 0) {
    console.log('\nPASSED with warnings — non-blocking, but review recommended.');
    process.exit(0);
  } else {
    console.log('\nPASSED — all frontmatter clean.');
    process.exit(0);
  }
}

main();
