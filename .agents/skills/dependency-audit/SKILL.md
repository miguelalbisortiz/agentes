---
name: dependency-audit
description: Use this skill when auditing project dependencies for security vulnerabilities, license compliance, supply chain risks, abandoned packages, and duplicate dependencies. Covers npm/yarn/pnpm, pip, cargo, go modules, and Maven/Gradle. Produces a PASS/FAIL report with categorized findings.
triggers: [npm, audit, dependency, dependencies, license, licenses, CVE, supply chain, vulnerable, outdated, abandoned, duplicate deps, package, packages, pip audit, cargo audit, go mod audit]
origin: starter-pack
---

# Dependency Audit Skill

Comprehensive dependency auditing for any project type. Covers security, legal, maintenance, and supply chain risks.

## When to Activate

- Before any major release
- After adding new dependencies
- When `npm audit` / `pip audit` / `cargo audit` reports issues
- When compliance requires license verification (GPL in proprietary = legal risk)
- Periodically (monthly/quarterly) as maintenance
- When investigating supply chain attack vectors

## Audit Dimensions

### 1. Security (CRITICAL)

#### npm / Node.js
```bash
npm audit --audit-level=high 2>&1
npm audit --json 2>&1 | head -100
```

#### Python
```bash
pip-audit 2>&1 || safety check 2>&1
```

#### Rust
```bash
cargo audit 2>&1
```

#### Go
```bash
govulncheck ./... 2>&1
```

#### Java
```bash
# Maven
mvn dependency-check:check 2>&1 | tail -50
# Gradle
gradle dependencyCheckAnalyze 2>&1 | tail -50
```

**What to check:**
- Known CVEs with severity HIGH or CRITICAL
- Dependencies with no available patches
- Transitive dependency vulnerabilities
- Dependencies flagged by OSV.dev or Snyk databases

### 2. License Compliance (HIGH)

#### npm
```bash
npx license-checker --summary 2>&1
npx license-checker --failOn "GPL-3.0;AGPL-3.0" 2>&1
```

#### Python
```bash
pip-licenses --format=table 2>&1
```

#### Rust
```bash
cargo-license 2>&1
```

**License risk matrix:**

| License | Risk | Action |
|---------|------|--------|
| MIT, Apache-2.0, BSD-2/3, ISC, 0BSD | ✅ Safe | Allow |
| MPL-2.0, LGPL-2.1/3.0 | ⚠️ Copyleft (file-level) | Review: can you isolate? |
| GPL-2.0/3.0 | 🔴 Copyleft (project-level) | FAIL for proprietary; ALLOW for open source |
| AGPL-3.0 | 🔴 Network copyleft | FAIL for SaaS/proprietary |
| SSPL | 🔴 Server-side copyleft | FAIL for any distribution |
| Custom / Unknown | ⚠️ Unknown | Manual review required |

**Rules:**
- For **proprietary projects**: GPL/AGPL/SSPL = FAIL (immediate block)
- For **open-source projects**: GPL is acceptable if compatible with project license
- Always flag "UNKNOWN" licenses for manual review
- Check for license changes between versions (dependency updated license = new risk)

### 3. Maintenance Health (MEDIUM)

**Signals of abandoned packages:**
- Last publish > 2 years ago
- Open issues > 50 with no maintainer response
- No commits in last 12 months
- Maintainer left the project (announcement in README/issues)
- Fork exists as active replacement

**Commands:**
```bash
# npm: check last publish date
npm view <package> time --json 2>&1 | tail -5

# Check for outdated
npm outdated 2>&1
pip list --outdated 2>&1
cargo outdated 2>&1
```

**Severity:**
- Last publish > 3 years → HIGH
- Last publish > 2 years → MEDIUM
- Last publish > 1 year → LOW (informational)

### 4. Supply Chain (MEDIUM)

**Check for:**
- Packages with similar names to popular packages (typosquatting)
- Packages with excessive permissions (postinstall scripts)
- Dependencies pulling in unexpected native binaries
- Packages from unknown publishers
- Single-maintainer packages with access to critical infrastructure

**Commands:**
```bash
# npm: check for postinstall scripts
npm view <package> scripts --json 2>&1

# Check package size (large = suspicious?)
npm view <package> dist.unpackedSize 2>&1

# Check download count (very low = suspicious for "popular" package)
npm view <package> --json 2>&1 | grep -i "downloads"
```

### 5. Duplicates (LOW)

**Check for:**
- Same package in both `dependencies` and `devDependencies`
- Multiple packages providing same functionality (e.g., `moment` + `dayjs`)
- Transitive duplicates (A depends on X@1, B depends on X@2)

```bash
npx depcheck 2>&1
npm ls <package-name> 2>&1
```

## Output Format

```markdown
# Dependency Audit Report

**Date:** YYYY-MM-DD
**Project:** [name]
**Package Manager:** npm | pip | cargo | go | maven | gradle

## Summary

| Dimension | Status | Findings |
|-----------|--------|----------|
| Security | PASS/FAIL | X critical, Y high |
| Licenses | PASS/FAIL | X risky licenses |
| Maintenance | PASS/WARN | X abandoned |
| Supply Chain | PASS/WARN | X suspicious |
| Duplicates | PASS/WARN | X duplicates |

## Verdict: PASS | PASS-WITH-WARNINGS | FAIL

## Critical Findings

### [CRITICAL] CVE-XXXX-XXXXX in <package>@<version>
- Severity: CRITICAL
- Package: <name>@<version>
- Fix: Upgrade to <fixed-version> (`npm install <package>@<fixed-version>`)
- Details: <link to CVE>

### [HIGH] GPL-3.0 license in <package>
- License: GPL-3.0
- Package: <name>@<version>
- Risk: Copyleft contamination for proprietary project
- Fix: Find MIT alternative or remove dependency

## Warnings

### [MEDIUM] Abandoned package: <package>
- Last publish: YYYY-MM-DD (>2 years)
- Open issues: X
- Suggested alternative: <alt-package>

## Passed Checks

- [x] No known CVEs with severity HIGH+
- [x] All licenses compatible with project policy
- [x] No typosquatting detected
```

## Severity Rules

| Severity | When |
|----------|------|
| **FAIL (CRITICAL)** | Known CVE with exploit, GPL in proprietary, actively malicious package |
| **FAIL (HIGH)** | CVE without exploit, AGPL in proprietary, license incompatibility |
| **WARN (MEDIUM)** | Abandoned package, excessive permissions, unusual download patterns |
| **INFO (LOW)** | Deprecated API usage, minor version behind, duplicate functionality |

## When NOT to Use

- For a simple `npm install` with no changes
- For projects with no dependencies
- When the user explicitly says "skip dependency check"

## Pair With

- `security-review` — for deeper code-level vulnerability analysis
- `compliance-checker` — for regulatory compliance beyond licensing
- `verification-loop` — as part of pre-release quality gate
