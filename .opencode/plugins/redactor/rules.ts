// rules.ts - regex rules for secrets and PII
// UUID included per spec. Exclusions are applied by caller (config or engine).

export type Rule = {
  id: string
  type: 'secret' | 'pii'
  re: RegExp
  desc: string
}

// Order doesn't strictly matter; we test all rules
export const RULES: Rule[] = [
  // Secrets
  { id: 'aws-access-key', type: 'secret', re: /\bAKIA[0-9A-Z]{16,}\b/g, desc: 'AWS access key' },
  { id: 'aws-secret-key', type: 'secret', re: /\b[0-9a-zA-Z/+]{40}\b/g, desc: 'AWS secret-like key (heuristic)' },
  { id: 'openai-key', type: 'secret', re: /\bsk-[A-Za-z0-9]{20,}\b/g, desc: 'OpenAI/modern API key' },
  { id: 'anthropic-key', type: 'secret', re: /\bsk-ant-[A-Za-z0-9\-_]{20,}\b/g, desc: 'Anthropic API key' },
  { id: 'github-token', type: 'secret', re: /\bgh[pousr]_[A-Za-z0-9]{36,}\b/g, desc: 'GitHub token' },
  { id: 'gitlab-token', type: 'secret', re: /\bglpat-[A-Za-z0-9\-_]{20,}\b/g, desc: 'GitLab PAT' },
  { id: 'stripe-key', type: 'secret', re: /\b(sk|pk)_(live|test)_[A-Za-z0-9]{24,}\b/g, desc: 'Stripe key' },
  { id: 'npm-token', type: 'secret', re: /\bnpm_[A-Za-z0-9]{36,}\b/g, desc: 'npm token' },
  { id: 'pypi-token', type: 'secret', re: /\bpypi-AgEIcHlwaS5vcmc[A-Za-z0-9\-_]{50,}\b/g, desc: 'PyPI token' },
  { id: 'slack-token', type: 'secret', re: /\bxox[baprs]-[A-Za-z0-9\-]{10,}\b/g, desc: 'Slack token' },
  { id: 'jwt', type: 'secret', re: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g, desc: 'JWT' },
  { id: 'private-key', type: 'secret', re: /-----BEGIN (RSA|EC|DSA|OPENSSH|PRIVATE) KEY-----[\s\S]+?-----END (RSA|EC|DSA|OPENSSH|PRIVATE) KEY-----/g, desc: 'Private key block' },
  { id: 'password-assignment', type: 'secret', re: /(password|passwd|pwd|secret|token|api[_-]?key)\s*[:=]\s*([^\s"'`]{6,})/gi, desc: 'password/secret assignment' },

  // PII (UUID included)
  { id: 'uuid', type: 'pii', re: /\b[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\b/g, desc: 'UUID' },
  { id: 'email', type: 'pii', re: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, desc: 'Email' },
  { id: 'ipv4', type: 'pii', re: /\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b/g, desc: 'IPv4' },
  { id: 'mac', type: 'pii', re: /\b([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})\b/g, desc: 'MAC address' },
]

// Default dev exclusions
export const DEFAULT_EXCLUSIONS = [
  'localhost',
  '127.0.0.1',
  '0.0.0.0',
  'example.com',
]
