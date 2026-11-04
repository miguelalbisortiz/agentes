// .opencode/plugins/hookify.ts
//
// Hookify — 2 production hooks for the opencode starter pack.
//
//   1. SecretBlocker       (tool.execute.before, edit/write)
//      Blocks the agent from writing to secret/credential files (.env,
//      *.key, *.pem, id_rsa*, .aws/credentials, secrets/, etc.).
//      Strict: throws on match. Use .env.example / .env.sample instead.
//
//   2. DestructiveWarner   (tool.execute.before, bash/shell)
//      Detects destructive bash patterns (rm -rf /, git push --force,
//      git reset --hard, DROP TABLE, TRUNCATE, etc.) and logs them to
//      .opencode/logs/destructive.log. Soft: does NOT block execution.
//      Pairs with the AGENTS.md baseline rule that destructive ops
//      require explicit user consent — this hook is the audit trail.
//
// Both hooks are auto-loaded by opencode from .opencode/plugins/.
// No install step required. Disable a hook by removing its export.
//
// ---------------------------------------------------------------------------
// MIGRATION V1 -> V2 (OpenCode 2.x)
// ---------------------------------------------------------------------------
// The previous hookify.js was V1:
//
//   module.exports = async () => ({
//     "tool.execute.before": async (input, output) => { ... },
//   })
//
// OpenCode 2 does NOT run V1 plugin implementations — the file was being
// loaded and silently doing nothing, so SecretBlocker stopped blocking and
// DestructiveWarner stopped logging. The official migration guide states:
//   "V1 plugin implementations do not run in V2. Moving a file or renaming
//    its config entry is not enough."
//
// The V2 shape registers each hook on the domain that owns it, and the V1
// (input, output) pair collapses into ONE mutable event:
//
//   V1  input.tool          ->  V2  event.tool
//   V1  output.args         ->  V2  event.input
//   V1  directory           ->  V2  ctx.location.directory
//
// Format reference: https://opencode.ai/v2/docs/build/plugins
// Migration reference: https://opencode.ai/v2/docs/build/plugins/migrate-v1

import { Plugin } from "@opencode/plugin"
import { appendFileSync, mkdirSync } from "node:fs"
import { join } from "node:path"

// ────────────────────────────────────────────────────────────────────────────
// Shared event shape
// ────────────────────────────────────────────────────────────────────────────

type ToolEvent = {
  tool: string
  input?: {
    filePath?: string
    file_path?: string
    path?: string
    file?: string
    command?: string
  }
}

// Tool names the pack has actually seen across stacks. V2 may report the
// shell tool as bash/shell/exec depending on platform and config, so match
// the set instead of a single literal — being wrong here means the audit
// trail silently stops working again, which is the bug we are fixing.
const SHELL_TOOLS = new Set(["bash", "shell", "exec"])
const WRITE_TOOLS = new Set(["edit", "write"])

// ────────────────────────────────────────────────────────────────────────────
// Hook 1: SecretBlocker
// ────────────────────────────────────────────────────────────────────────────

const SECRET_PATH_PATTERNS = [
  // .env and variants (but allow .env.example / .env.sample / .env.template)
  /(^|\/)\.env(\.[^/]+)?$/,
  // Private keys
  /(^|\/)[^/]*\.pem$/,
  /(^|\/)[^/]*\.key$/,
  /(^|\/)[^/]*\.pfx$/,
  /(^|\/)[^/]*\.p12$/,
  /(^|\/)id_rsa(\.[^/]+)?$/,
  /(^|\/)id_ed25519(\.[^/]+)?$/,
  /(^|\/)id_dsa(\.[^/]+)?$/,
  /(^|\/)id_ecdsa(\.[^/]+)?$/,
  // Credential stores
  /(^|\/)\.npmrc$/,
  /(^|\/)\.pypirc$/,
  /(^|\/)\.netrc$/,
  /(^|\/)credentials(\.[^/]+)?$/,
  /(^|\/)\.aws\/credentials$/,
  /(^|\/)\.gcloud\/application_default_credentials\.json$/,
  /(^|\/)\.config\/gcloud\/.*\.json$/,
  /(^|\/)\.ssh\/config$/,
  /(^|\/)secrets?\//,
  /(^|\/)\.kube\/config$/,
]

const SECRET_PATH_ALLOWLIST = [
  // Convention: commit .env.example so new contributors know what vars to set
  /(^|\/)\.env\.(example|sample|template|dist)$/,
  /(^|\/)\.env\.local\.example$/,
]

function isSecretPath(filePath: string | undefined): boolean {
  if (!filePath) return false
  // Allowlist first (so .env.example doesn't trip the blocker)
  if (SECRET_PATH_ALLOWLIST.some((re) => re.test(filePath))) return false
  return SECRET_PATH_PATTERNS.some((re) => re.test(filePath))
}

// ────────────────────────────────────────────────────────────────────────────
// Hook 2: DestructiveWarner
// ────────────────────────────────────────────────────────────────────────────

const DESTRUCTIVE_PATTERNS = [
  // Filesystem destruction
  // rm -rf followed by an absolute path (root or anything under /).
  // Catches: rm -rf /, rm -rf /etc, rm -rf /var/log. Does NOT match
  // rm -rf build/ or rm -rf ./build (relative paths are user territory).
  { pattern: /\brm\s+(-\w*r\w*\s+)*-\w*f\w*\s+\/\S*/, label: "rm -rf /<absolute path>" },
  { pattern: /\brm\s+-\w*r\w*f\w*\s+~/, label: "rm -rf ~" },
  { pattern: /\brm\s+-\w*r\w*f\w*\s+\.\.\//, label: "rm -rf ../" },
  { pattern: /:\s*>\s*\/dev\/sd[a-z]/, label: "wipe /dev/sdX" },
  { pattern: /\bmkfs\./, label: "mkfs (format disk)" },
  { pattern: /\bdd\s+if=.*\s+of=\/dev\//, label: "dd to /dev/" },
  // Git destruction
  { pattern: /\bgit\s+push\s+(-\w+\s+)*--force(\s|$)/, label: "git push --force" },
  { pattern: /\bgit\s+push\s+(-\w+\s+)*-f(\s|$)/, label: "git push -f" },
  { pattern: /\bgit\s+reset\s+--hard/, label: "git reset --hard" },
  { pattern: /\bgit\s+clean\s+-\w*f\w*d\w*/, label: "git clean -fd" },
  { pattern: /\bgit\s+branch\s+-\w*D\w*/, label: "git branch -D" },
  { pattern: /\bgit\s+update-ref\s+-d/, label: "git update-ref -d" },
  // Database destruction
  { pattern: /\bDROP\s+(TABLE|DATABASE|SCHEMA)\b/i, label: "DROP TABLE/DATABASE" },
  { pattern: /\bTRUNCATE(\s+TABLE)?\s+\w+/i, label: "TRUNCATE" },
  { pattern: /\bDELETE\s+FROM\s+\w+\s*;/i, label: "DELETE FROM (no WHERE)" },
  // System
  { pattern: /\bshutdown\b/, label: "shutdown" },
  { pattern: /\breboot\b/, label: "reboot" },
  { pattern: /\bhalt\b/, label: "halt" },
]

function findDestructive(command: string | undefined): string | null {
  if (!command || typeof command !== "string") return null
  for (const { pattern, label } of DESTRUCTIVE_PATTERNS) {
    if (pattern.test(command)) return label
  }
  return null
}

// ────────────────────────────────────────────────────────────────────────────
// Secret scrub for the audit log
// ────────────────────────────────────────────────────────────────────────────
// Inline and dependency-free on purpose: this used to call the `redactor`
// plugin via require("./redactor/engine"), which was deleted on 2026-10-29.
// The require sat in a try/catch, so it degraded to a silent no-op and every
// destructive command was written to destructive.log verbatim — secrets
// included. Keep this list self-contained; do not re-introduce a module
// dependency here, or the audit trail loses redaction the day that module moves.

const SCRUB_RULES: Array<[RegExp, string]> = [
  // Provider-prefixed tokens (OpenAI/Anthropic, GitHub, Slack, GitLab, AWS)
  [/\b(?:sk|pk|rk)-[A-Za-z0-9_-]{16,}/g, "***"],
  [/\bgh[pousr]_[A-Za-z0-9]{20,}/g, "***"],
  [/\bgithub_pat_[A-Za-z0-9_]{20,}/g, "***"],
  [/\bxox[baprs]-[A-Za-z0-9-]{10,}/g, "***"],
  [/\bglpat-[A-Za-z0-9_-]{16,}/g, "***"],
  [/\bAKIA[0-9A-Z]{16}\b/g, "***"],
  // key=value / key: value assignments (env vars, connection strings)
  [
    /\b(password|passwd|pwd|secret|token|api[_-]?key|access[_-]?key|client[_-]?secret|auth[_-]?token)(\s*[=:]\s*)(["']?)[^\s"']{4,}\3/gi,
    "$1$2$3***$3",
  ],
  // Authorization headers
  [/\b(Bearer|Basic)\s+[A-Za-z0-9._/+-]{8,}/gi, "$1 ***"],
  // URLs with inline credentials: scheme://user:pass@host
  [/([a-z][a-z0-9+.-]*:\/\/[^:/\s@]+):[^@\s/]+@/gi, "$1:***@"],
]

function scrubSecrets(text: string): string {
  let out = text
  for (const [pattern, replacement] of SCRUB_RULES) {
    out = out.replace(pattern, replacement)
  }
  return out
}

/** Log under the PROJECT directory (ctx.location.directory), not process.cwd().
 *  cwd can be a sandbox or a worktree; the audit trail belongs with the repo. */
function logDestructive(
  projectDir: string | undefined,
  tool: string,
  command: string,
  label: string,
): void {
  try {
    const root = projectDir || process.cwd()
    const logsDir = join(root, ".opencode", "logs")
    mkdirSync(logsDir, { recursive: true })
    const logPath = join(logsDir, "destructive.log")
    const ts = new Date().toISOString()
    let cmd = scrubSecrets(command || "")
    const truncated =
      cmd.length > 500 ? cmd.slice(0, 500) + "...[truncated]" : cmd
    appendFileSync(
      logPath,
      "[" + ts + "] [" + label + "] [" + tool + "] " + truncated + "\n",
      "utf8",
    )
  } catch {
    // Never crash the session over a log failure
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Plugin
// ────────────────────────────────────────────────────────────────────────────

export default Plugin.define({
  id: "hookify",

  async setup(ctx) {
    // Every V2 plugin needs a stable id — it scopes storage and identifies
    // the plugin in status/diagnostics.
    await ctx.tool.hook("execute.before", (event: ToolEvent) => {
      const input = event.input || {}

      // --- Hook 1: SecretBlocker (strict) -----------------------------------
      if (WRITE_TOOLS.has(event.tool)) {
        const filePath =
          input.filePath || input.file_path || input.path || input.file
        if (isSecretPath(filePath)) {
          throw new Error(
            "[hookify:SecretBlocker] blocked write to '" + filePath + "'. " +
              "Refusing to write to secret/credential files from inside a session. " +
              "If this is intentional, edit the file directly outside opencode " +
              "or rename the target (e.g. '.env' -> '.env.example').",
          )
        }
      }

      // --- Hook 2: DestructiveWarner (soft, audit only) ---------------------
      if (SHELL_TOOLS.has(event.tool)) {
        const command = input.command
        const label = findDestructive(command)
        if (!label) return
        logDestructive(ctx.location?.directory, event.tool, command || "", label)
        // Soft warn via stderr (visible in TUI). Does NOT block — the user
        // still gets to confirm the command through opencode's normal flow.
        console.warn(
          "[hookify:DestructiveWarner] detected '" + label + "' — " +
            "logged to .opencode/logs/destructive.log. " +
            "If you didn't explicitly approve this, abort.",
        )
      }
    })
  },
})
