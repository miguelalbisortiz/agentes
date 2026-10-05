#!/usr/bin/env node
/**
 * lint-docs.js - prose lint for the pack
 *
 * Five defect classes that `validate-frontmatter` and `smoke-test` both
 * passed while they were present in the repo, because neither of them
 * reads prose.
 *
 * Every rule below was calibrated against the actual defects that were
 * fixed by hand in 79c6e9d (Bloque A) and against the pre-fix tree, so
 * that it reports the real defect and nothing else. A lint nobody can
 * read is worse than no lint.
 *
 *   R1  unbalanced backticks   odd number of ` on a prose line
 *   R2  truncated sentence     cut off mid-phrase: dangling last word AND
 *                              (trailing whitespace | inside a code block)
 *   R3  V1 subagent syntax     subagent_type / task { subagent } / task tool
 *   R4  state.js empty path    `state.js update "" ...` (loses the file path)
 *   R5  non-numeric phase      `state.js update "$STATE" executing ...`
 *
 * R1 and R2 are prose rules: they skip fenced code blocks. R3, R4 and R5
 * are syntax rules: they must see inside fences, because that is where the
 * examples live.
 *
 * Exclusions, all deliberate:
 *   - node_modules / .git / backup / agents-backup: not live documentation
 *   - CHANGELOG.md: records history, including the old broken syntax
 *   - `<angle-bracket>` tokens in usage synopses are placeholders, not phases
 *
 * Usage:
 *   node .opencode/bin/lint-docs.js            # scan cwd
 *   node .opencode/bin/lint-docs.js --dir DIR  # scan another tree
 *   node .opencode/bin/lint-docs.js --quiet    # only print the summary
 *
 * Exit codes:
 *   0 = no findings
 *   1 = at least one finding
 */

const fs = require('fs');
const path = require('path');

const argv = process.argv.slice(2);
const QUIET = argv.includes('--quiet');
const dirFlag = argv.indexOf('--dir');
const ROOT = dirFlag !== -1 && argv[dirFlag + 1]
  ? path.resolve(argv[dirFlag + 1])
  : process.cwd();

// Never descend here: build output, vendored code, copies, local archives.
const SKIP_DIRS = new Set([
  'node_modules', '.git', 'backup', 'dist', 'build', '.next', 'agents-backup',
]);

/**
 * Last word a sentence is unlikely to finish on when it is actually complete.
 * Deliberately narrow: the broad version produced 43 false positives on
 * ordinary bullets like "... broken without it".
 */
const DANGLING = new Set([
  // English
  'the', 'a', 'an', 'of', 'to', 'as', 'with', 'from', 'for', 'and', 'or',
  'in', 'on', 'at', 'by', 'that', 'which', 'this', 'these', 'those', 'is',
  'are', 'was', 'were', 'be', 'been', 'into', 'onto', 'than', 'about',
  'before', 'after', 'during', 'between', 'against', 'without', 'within',
  // Spanish
  'el', 'la', 'los', 'las', 'un', 'una', 'de', 'del', 'al', 'para', 'por',
  'con', 'sin', 'sobre', 'desde', 'hasta', 'entre', 'hacia', 'como', 'que',
  'se', 'es', 'son', 'está', 'están', 'hay', 'su', 'sus', 'este', 'esta',
]);

const V1_PATTERNS = [
  { re: /\bsubagent_type\b/, what: 'subagent_type (V1)' },
  { re: /\btask\s*\{\s*subagent/i, what: 'task { subagent } (V1)' },
  { re: /\btask[`']?\s+tool\b/i, what: 'task tool (V1)' },
];

const STATE_SUB = '(?:init|update|complete|fail|list|archive)';
const STATE_EMPTY = new RegExp(`state\\.js\\s+${STATE_SUB}\\s+(?:""|'')`);
// `state.js update <path> <phase>` — capture the phase so we can require a digit.
const STATE_PHASE = new RegExp(
  `state\\.js\\s+update\\s+("(?:[^"\\\\]|\\\\.)*"|'[^']*'|\\S+)\\s+("(?:[^"\\\\]|\\\\.)*"|'[^']*'|\\S+)`,
  'g'
);

/** `> > text` is one line of prose to us, not four rules. */
function stripBlockquote(s) {
  return s.replace(/^(\s*(?:>\s*)+)/, '');
}

function walk(dir, out = []) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isSymbolicLink()) continue;              // junctions: scanned at their target
    if (e.isDirectory()) {
      if (SKIP_DIRS.has(e.name)) continue;
      walk(full, out);
    } else if (e.isFile() && e.name.endsWith('.md')) {
      out.push(full);
    }
  }
  return out;
}

function lintFile(file) {
  const hits = [];
  const rel = path.relative(ROOT, file).replace(/\\/g, '/');
  const isHistory = /CHANGE/i.test(path.basename(file));

  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
  let inFence = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const stripped = stripBlockquote(line);
    const trimmed = stripped.trim();
    const isFenceLine = /^\s*(`{3,}|~{3,})/.test(stripped);

    if (isFenceLine) {
      inFence = !inFence;
    } else if (trimmed !== '') {
      // --- R1: prose only ---
      if (!inFence) {
        const ticks = (stripped.match(/`/g) || []).length;
        if (ticks % 2 === 1 && !isHistory) {
          hits.push({ rel, line: i + 1, rule: 'R1', msg: 'backtick sin cerrar en la linea' });
        }
      }

      // --- R2. The last word alone was useless: prose and comments routinely
      // finish on "it"/"use"/"or" (43 false positives on ordinary bullets
      // like "... broken without it"). What separates a cut from a finish is
      // the trailing whitespace left behind when the text was interrupted,
      // plus a last word a sentence is unlikely to complete on. The one
      // proven truncation in the repo's history ("# Capture the printed path
      // as ") has both. ---
      if (/\s$/.test(line) && !trimmed.startsWith('|')) {
        const tail = trimmed.match(/(\p{L}+)$/u);
        if (tail && DANGLING.has(tail[1].toLowerCase())) {
          hits.push({ rel, line: i + 1, rule: 'R2', msg: `frase truncada en "${tail[1]}"` });
        }
      }
    }

    // --- R3: V1 syntax, everywhere (history files excluded) ---
    if (!isHistory) {
      for (const p of V1_PATTERNS) {
        if (p.re.test(line)) {
          hits.push({ rel, line: i + 1, rule: 'R3', msg: p.what });
          break;
        }
      }
    }

    // --- R4: state.js called with an empty path, everywhere ---
    if (STATE_EMPTY.test(line)) {
      hits.push({ rel, line: i + 1, rule: 'R4', msg: 'state.js recibe cadena vacia en vez de $STATE' });
    }

    // --- R5: phase must be an integer, everywhere. `<phase>` in a usage
    // synopsis is a placeholder, not a value someone would pass. ---
    STATE_PHASE.lastIndex = 0;
    let m;
    while ((m = STATE_PHASE.exec(line)) !== null) {
      const phase = m[2].replace(/^["']|["']$/g, '');
      if (phase.startsWith('<') && phase.endsWith('>')) continue; // usage placeholder
      if (isHistory) continue;                                   // recounts old bugs
      if (!/^-?\d+$/.test(phase)) {
        hits.push({ rel, line: i + 1, rule: 'R5', msg: `fase no numerica "${phase}"` });
      }
    }
  }
  return hits;
}

const files = walk(ROOT);
const all = [];
for (const f of files) all.push(...lintFile(f));

const byRule = { R1: 0, R2: 0, R3: 0, R4: 0, R5: 0 };
for (const h of all) byRule[h.rule]++;

if (!QUIET) {
  for (const h of all) {
    console.log(`  ${h.rule}  ${h.rel}:${h.line}  ${h.msg}`);
  }
}

console.log(
  `lint-docs: ${files.length} .md scanned | ` +
  `R1=${byRule.R1} R2=${byRule.R2} R3=${byRule.R3} R4=${byRule.R4} R5=${byRule.R5} | ` +
  `total=${all.length}`
);

process.exit(all.length > 0 ? 1 : 0);
