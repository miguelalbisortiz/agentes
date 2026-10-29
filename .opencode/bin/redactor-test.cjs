// .opencode/plugins/redactor/engine.ts
var import_crypto = require("crypto");

// .opencode/plugins/redactor/rules.ts
var RULES = [
  // Secrets
  { id: "aws-access-key", type: "secret", re: /\bAKIA[0-9A-Z]{16,}\b/g, desc: "AWS access key" },
  { id: "aws-secret-key", type: "secret", re: /\b[0-9a-zA-Z/+]{40}\b/g, desc: "AWS secret-like key (heuristic)" },
  { id: "openai-key", type: "secret", re: /\bsk-[A-Za-z0-9]{20,}\b/g, desc: "OpenAI/modern API key" },
  { id: "anthropic-key", type: "secret", re: /\bsk-ant-[A-Za-z0-9\-_]{20,}\b/g, desc: "Anthropic API key" },
  { id: "github-token", type: "secret", re: /\bgh[pousr]_[A-Za-z0-9]{36,}\b/g, desc: "GitHub token" },
  { id: "gitlab-token", type: "secret", re: /\bglpat-[A-Za-z0-9\-_]{20,}\b/g, desc: "GitLab PAT" },
  { id: "stripe-key", type: "secret", re: /\b(sk|pk)_(live|test)_[A-Za-z0-9]{24,}\b/g, desc: "Stripe key" },
  { id: "npm-token", type: "secret", re: /\bnpm_[A-Za-z0-9]{36,}\b/g, desc: "npm token" },
  { id: "pypi-token", type: "secret", re: /\bpypi-AgEIcHlwaS5vcmc[A-Za-z0-9\-_]{50,}\b/g, desc: "PyPI token" },
  { id: "slack-token", type: "secret", re: /\bxox[baprs]-[A-Za-z0-9\-]{10,}\b/g, desc: "Slack token" },
  { id: "jwt", type: "secret", re: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g, desc: "JWT" },
  { id: "private-key", type: "secret", re: /-----BEGIN (RSA|EC|DSA|OPENSSH|PRIVATE) KEY-----[\s\S]+?-----END (RSA|EC|DSA|OPENSSH|PRIVATE) KEY-----/g, desc: "Private key block" },
  { id: "password-assignment", type: "secret", re: /(password|passwd|pwd|secret|token|api[_-]?key)\s*[:=]\s*([^\s"'`]{6,})/gi, desc: "password/secret assignment" },
  // PII (UUID included)
  { id: "uuid", type: "pii", re: /\b[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\b/g, desc: "UUID" },
  { id: "email", type: "pii", re: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, desc: "Email" },
  { id: "ipv4", type: "pii", re: /\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b/g, desc: "IPv4" },
  { id: "mac", type: "pii", re: /\b([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})\b/g, desc: "MAC address" }
];
var DEFAULT_EXCLUSIONS = [
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "example.com"
];

// .opencode/plugins/redactor/config.ts
var import_fs2 = require("fs");
var import_path2 = require("path");

// .opencode/plugins/redactor/log.ts
var import_fs = require("fs");
var import_path = require("path");
function getLogPath() {
  const dir = (0, import_path.join)(process.cwd(), ".opencode", "logs");
  try {
    if (!(0, import_fs.existsSync)(dir)) (0, import_fs.mkdirSync)(dir, { recursive: true });
  } catch {
  }
  return (0, import_path.join)(dir, "redact.log");
}
function logRedact(event, meta) {
  try {
    const line = JSON.stringify({ ts: (/* @__PURE__ */ new Date()).toISOString(), event, ...meta || {} }) + "\n";
    (0, import_fs.appendFileSync)(getLogPath(), line, "utf8");
  } catch {
  }
}

// .opencode/plugins/redactor/config.ts
var DEFAULT_EXCLUSIONS2 = ["localhost", "127.0.0.1", "0.0.0.0", "example.com"];
function loadConfig() {
  const candidates = [
    (0, import_path2.join)(process.cwd(), "redactor.config.json"),
    (0, import_path2.join)(process.cwd(), ".opencode", "redactor.config.json"),
    (0, import_path2.join)(process.env.LOCALAPPDATA || "", "opencode", "redactor.config.json")
  ];
  for (const p of candidates) {
    if (!(0, import_fs2.existsSync)(p)) continue;
    try {
      const raw = (0, import_fs2.readFileSync)(p, "utf8");
      const cfg2 = JSON.parse(raw);
      const exclusions = Array.isArray(cfg2.exclusions) ? cfg2.exclusions : DEFAULT_EXCLUSIONS2;
      return {
        enabled: cfg2.enabled !== false,
        rules: Array.isArray(cfg2.rules) ? cfg2.rules : void 0,
        exclusions
      };
    } catch (e) {
      try {
        logRedact("config.load_failed", { path: p, err: String(e) });
      } catch {
      }
    }
  }
  return { enabled: true, exclusions: DEFAULT_EXCLUSIONS2 };
}

// .opencode/plugins/redactor/engine.ts
var MAX = 4096;
var map = /* @__PURE__ */ new Map();
var cfg = loadConfig();
function isExcluded(s) {
  const ex = cfg.exclusions || DEFAULT_EXCLUSIONS;
  const lower = s.toLowerCase();
  for (const e of ex) {
    const el = e.toLowerCase();
    if (!el) continue;
    if (lower === el) return true;
    if (el === "example.com") {
      if (lower.endsWith("@" + el)) return true;
      if (lower === el) return true;
    }
    if (lower.endsWith("@" + el)) return true;
    if (el === "localhost" || el === "127.0.0.1" || el === "0.0.0.0") {
      if (lower.includes(el)) return true;
    }
  }
  return false;
}
function stableId(ruleId, value) {
  const h = (0, import_crypto.createHash)("sha256").update(value).digest("hex").slice(0, 12);
  return `[REDACTED:${ruleId.toUpperCase()}:${h}]`;
}
function ensureSize() {
  if (map.size <= MAX) return;
  let oldestKey = null;
  let oldestTs = Infinity;
  for (const [k, v] of map.entries()) {
    if (v.ts < oldestTs) {
      oldestTs = v.ts;
      oldestKey = k;
      if (oldestTs === 0) break;
    }
  }
  if (oldestKey) map.delete(oldestKey);
  if (map.size > MAX) {
    const first = map.keys().next().value;
    if (first) map.delete(first);
  }
}
function redact(text) {
  if (!cfg.enabled) return text;
  if (typeof text !== "string" || text.length === 0) return text;
  let out = text;
  for (const rule of RULES) {
    rule.re.lastIndex = 0;
    out = out.replace(rule.re, (match) => {
      if (match.includes("[REDACTED:")) return match;
      if (isExcluded(match)) return match;
      const marker = stableId(rule.id, match);
      map.set(marker, { value: match, ts: Date.now() });
      ensureSize();
      logRedact("redact", { rule: rule.id, marker });
      return marker;
    });
  }
  return out;
}
function rehydrate(text) {
  if (typeof text !== "string" || text.length === 0) return text;
  if (!text.includes("[REDACTED:")) return text;
  const re = /\[REDACTED:([A-Z0-9_-]+):([0-9a-f]+)\]/g;
  re.lastIndex = 0;
  let out = text;
  const misses = [];
  out = out.replace(re, (m) => {
    const e = map.get(m);
    if (!e) {
      misses.push(m);
      return m;
    }
    return e.value;
  });
  if (misses.length > 0) {
    logRedact("rehydrate.missing", { count: misses.length });
    const err = new Error(`REDACT_MAP_MISSING:${misses.length}`);
    err.code = "REDACT_MAP_MISSING";
    throw err;
  }
  return out;
}
function clearMap() {
  map.clear();
}

// .opencode/bin/redactor-test.ts
var passed = 0;
var failed = 0;
function ok(name, cond) {
  if (cond) {
    passed++;
    console.log("OK  " + name);
  } else {
    failed++;
    console.log("FAIL " + name);
  }
}
clearMap();
ok("aws-key", redact("AKIAIOSFODNN7EXAMPLE1234") !== "AKIAIOSFODNN7EXAMPLE1234");
ok("github", redact("ghp_123456789012345678901234567890123456") !== "ghp_123456789012345678901234567890123456");
ok("jwt", redact("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U") !== "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0In0.SIG123456789012345678901234567890");
ok("uuid", redact("e7a62f43-9b82-4c01-8ab2-2e7fd0c3a914") !== "e7a62f43-9b82-4c01-8ab2-2e7fd0c3a914");
ok("email", redact("user@gmail.com").includes("[REDACTED:EMAIL"));
ok("ipv4", redact("192.168.1.50") !== "192.168.1.50");
ok("mac", redact("AA:BB:CC:DD:EE:FF") !== "AA:BB:CC:DD:EE:FF");
ok("no-localhost", redact("http://localhost:3000") === "http://localhost:3000");
ok("no-127.0.0.1", redact("http://127.0.0.1:8080") === "http://127.0.0.1:8080");
ok("no-0.0.0.0", redact("bind 0.0.0.0") === "bind 0.0.0.0");
ok("no-example.com", redact("contact@example.com") === "contact@example.com");
clearMap();
var secret = "sk-1234567890abcdefghijklmnopqrstuvwxyz";
var r1 = redact(secret);
var r2 = rehydrate(r1);
ok("roundtrip", r2 === secret);
clearMap();
var s1 = redact("AKIAIOSFODNN7EXAMPLE1234");
var s2 = redact("AKIAIOSFODNN7EXAMPLE1234");
ok("stable-same", s1 === s2);
clearMap();
for (let i = 0; i < 4100; i++) {
  redact("AKIAIOSFODNN7EXAMPLE" + String(i).padStart(4, "0"));
}
ok("fifo-no-crash", true);
console.log(`
TOTAL: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
