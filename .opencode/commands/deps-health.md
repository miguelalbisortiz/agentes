---
description: "Audit project dependencies for vulnerabilities, outdated packages, and unused dependencies. Runs npm audit, depcheck, and npm outdated. Use before releases, during security reviews, or for maintenance."
agent: code-explorer
---

# Dependencies Health Audit

Audit project dependencies for security, freshness, and usage: $ARGUMENTS

## Usage

`/deps-health [--fix] [--security-only] [--json]`

- `--fix`: attempt auto-fix for vulnerabilities
- `--security-only`: only check security vulnerabilities
- `--json`: output as JSON for CI integration

## Your Task

1. **Detect package manager**: npm, pnpm, yarn, bun
2. **Run security audit**: `npm audit`, `pnpm audit`
3. **Check outdated**: `npm outdated`, `pnpm outdated`
4. **Find unused**: `depcheck`
5. **Generate report** with severity levels
6. **Provide remediation** recommendations

## Package Manager Detection

```bash
# Check lock files
ls package-lock.json  # npm
ls pnpm-lock.yaml     # pnpm
ls yarn.lock          # yarn
ls bun.lockb          # bun
```

## Security Audit

### npm/pnpm

```bash
# Basic audit
npm audit

# JSON output
npm audit --json

# Fix automatically
npm audit fix

# Fix with breaking changes
npm audit fix --force
```

### yarn

```bash
# yarn v1
yarn audit

# yarn v2+
yarn npm audit
```

## Outdated Packages

```bash
# npm/pnpm
npm outdated
npm outdated --json

# yarn
yarn outdated
```

## Unused Dependencies

```bash
# Install depcheck
npm install -g depcheck

# Run
depcheck

# With options
depcheck --ignores="eslint*,@typescript*,prettier*"
```

## Package.json Analysis

### Scripts Check

```bash
# Check if scripts use dependencies
grep -r "require\|import" package.json

# Check for missing scripts
cat package.json | jq '.scripts'
```

### Dependency Categories

```bash
# Dependencies (production)
cat package.json | jq '.dependencies'

# DevDependencies (development)
cat package.json | jq '.devDependencies'

# PeerDependencies
cat package.json | jq '.peerDependencies'

# OptionalDependencies
cat package.json | jq '.optionalDependencies'
```

## Health Report

### Security Vulnerabilities

```
=== Security Audit ===

 vulnerabilities
├── critical: 0
├── high: 0
├── moderate: 0
├── low: 0
└── info: 0

Status: ✅ No known vulnerabilities
```

### Outdated Packages

```
=== Outdated Packages ===

Package         Current  Wanted  Latest
express         4.18.2   4.18.2  4.19.0
typescript      5.3.3    5.3.3   5.4.0
react           18.2.0   18.2.0  19.0.0

Status: 3 packages outdated
```

### Unused Dependencies

```
=== Unused Dependencies ===

Package         Type         Used
lodash          dependency   No
moment          dependency   No
@types/lodash   devDependency No

Status: 2 unused dependencies
```

## Auto-Fix

### Security Fixes

```bash
# Try automatic fix
npm audit fix

# If that fails, try with breaking changes
npm audit fix --force

# Or update specific package
npm update <package>
```

### Unused Dependencies

```bash
# Remove unused
npm uninstall lodash moment

# Update package.json
npm pkg set dependencies.lodash=""
npm pkg delete dependencies.lodash
```

## CI Integration

### GitHub Actions

```yaml
# .github/workflows/deps-audit.yml
name: Dependencies Audit
on:
  schedule:
    - cron: '0 0 * * 1'  # Weekly
  pull_request:
    branches: [main]

jobs:
  audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: npm audit --audit-level=high
      - run: npx depcheck
```

### Dependabot

```yaml
# .github/dependabot.yml
version: 2
updates:
  - package-ecosystem: npm
    directory: "/"
    schedule:
      interval: weekly
    open-pull-requests-limit: 10
    reviewers:
      - "team:security"
```

## Anti-Patterns

1. **Ignoring vulnerabilities** → Security risk
2. **Not updating regularly** → Dependency drift
3. **Over-relying on devDependencies** → Missing production deps
4. **No lockfile** → Reproducibility issues
5. **Mass updates** → Breaking changes

## Arguments

$ARGUMENTS:
- optional flags (--fix, --security-only, --json)
