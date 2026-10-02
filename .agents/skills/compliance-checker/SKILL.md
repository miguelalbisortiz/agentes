---
name: compliance-checker
description: Use this skill when validating code against regulatory compliance frameworks (GDPR, SOC2, HIPAA, PCI-DSS, CCPA). Covers data handling, consent management, audit logging, encryption, access controls, and privacy requirements. Produces a compliance gap analysis with remediation steps.
triggers: [compliance, GDPR, SOC2, HIPAA, PCI-DSS, CCPA, regulation, regulación, privacy, privacidad, data protection, audit log, consent, PII, PHI, personal data, encrypted, retention, right to deletion, data subject]
origin: starter-pack
---

# Compliance Checker Skill

Validate code and configuration against regulatory compliance frameworks.

## When to Activate

- Before any release involving user data
- When handling PII (Personally Identifiable Information) or PHI (Protected Health Information)
- When integrating payment processing (PCI-DSS)
- When building healthcare applications (HIPAA)
- When operating in EU/California (GDPR/CCPA)
- When SOC2 certification is required
- Periodically as compliance audit

## Supported Frameworks

| Framework | Scope | Key Focus |
|-----------|-------|-----------|
| **GDPR** | EU data protection | Consent, right to deletion, data minimization, portability |
| **SOC2** | SaaS trust | Security, availability, processing integrity, confidentiality, privacy |
| **HIPAA** | US healthcare | PHI protection, audit controls, access management, encryption |
| **PCI-DSS** | Payment cards | Card data handling, encryption, network security, access control |
| **CCPA** | California privacy | Right to know, right to delete, opt-out of sale |

## GDPR Checklist

### Data Collection & Consent

| Check | Status | Evidence |
|-------|--------|----------|
| Consent obtained before data collection | PASS/FAIL | [file:line] |
| Consent is freely given, specific, informed | PASS/FAIL | [file:line] |
| Consent can be withdrawn easily | PASS/FAIL | [file:line] |
| Children's data has parental consent | PASS/FAIL | [file:line] |
| Cookie consent banner implemented | PASS/FAIL | [file:line] |

### Data Processing

| Check | Status | Evidence |
|-------|--------|----------|
| Data minimization (only collect what's needed) | PASS/FAIL | [file:line] |
| Purpose limitation (used only for stated purpose) | PASS/FAIL | [file:line] |
| Data not shared without consent | PASS/FAIL | [file:line] |
| Third-party processors have DPA | PASS/FAIL | [config] |

### Data Subject Rights

| Check | Status | Evidence |
|-------|--------|----------|
| Right to access (data export endpoint) | PASS/FAIL | [file:line] |
| Right to deletion (account deletion) | PASS/FAIL | [file:line] |
| Right to rectification (profile edit) | PASS/FAIL | [file:line] |
| Right to portability (JSON/CSV export) | PASS/FAIL | [file:line] |
| Right to object (opt-out mechanism) | PASS/FAIL | [file:line] |

### Data Protection

| Check | Status | Evidence |
|-------|--------|----------|
| Encryption at rest | PASS/FAIL | [file:line] |
| Encryption in transit (TLS) | PASS/FAIL | [config] |
| Data retention policy defined | PASS/FAIL | [file:line] |
| Automated data deletion after retention | PASS/FAIL | [file:line] |
| PII not logged | PASS/FAIL | [file:line] |

```bash
# Detect PII in logs
grep -rn "console.log\|logger\.\|print(" --include="*.ts" --include="*.js" --include="*.py" . | grep -i "email\|password\|phone\|address\|ssn\|credit" | head -20

# Detect PII in code comments
grep -rn "//.*email\|//.*password\|#.*email\|#.*password" --include="*.ts" --include="*.js" --include="*.py" . | head -20
```

## SOC2 Checklist

### Security

| Check | Status | Evidence |
|-------|--------|----------|
| Authentication on all sensitive endpoints | PASS/FAIL | [file:line] |
| Authorization checks (RBAC) | PASS/FAIL | [file:line] |
| Input validation on all endpoints | PASS/FAIL | [file:line] |
| Secrets in environment variables, not code | PASS/FAIL | [file:line] |
| Dependency vulnerability scanning | PASS/FAIL | [config] |

### Availability

| Check | Status | Evidence |
|-------|--------|----------|
| Health check endpoint exists | PASS/FAIL | [file:line] |
| Graceful error handling | PASS/FAIL | [file:line] |
| Rate limiting on public endpoints | PASS/FAIL | [file:line] |
| Timeout on external calls | PASS/FAIL | [file:line] |

### Processing Integrity

| Check | Status | Evidence |
|-------|--------|----------|
| Input validation (schema + business rules) | PASS/FAIL | [file:line] |
| Transaction integrity (atomicity) | PASS/FAIL | [file:line] |
| Error handling doesn't leave inconsistent state | PASS/FAIL | [file:line] |

### Confidentiality

| Check | Status | Evidence |
|-------|--------|----------|
| Sensitive data encrypted at rest | PASS/FAIL | [file:line] |
| Access controls on sensitive data | PASS/FAIL | [file:line] |
| No sensitive data in logs | PASS/FAIL | [file:line] |

### Audit Logging

| Check | Status | Evidence |
|-------|--------|----------|
| Authentication events logged | PASS/FAIL | [file:line] |
| Authorization failures logged | PASS/FAIL | [file:line] |
| Data access logged | PASS/FAIL | [file:line] |
| Logs tamper-proof (append-only) | PASS/FAIL | [config] |
| Log retention meets requirements | PASS/FAIL | [config] |

```bash
# Find audit logging
grep -rn "audit\|log.*auth\|log.*access\|log.*login\|log.*permission" --include="*.ts" --include="*.js" --include="*.py" . | head -20

# Check for missing logging on sensitive operations
grep -rn "delete\|remove\|update.*password\|change.*role" --include="*.ts" --include="*.js" --include="*.py" . | grep -v "test\|spec" | head -20
```

## HIPAA Checklist

| Check | Status | Evidence |
|-------|--------|----------|
| PHI encrypted at rest (AES-256) | PASS/FAIL | [file:line] |
| PHI encrypted in transit (TLS 1.2+) | PASS/FAIL | [config] |
| Access controls (minimum necessary) | PASS/FAIL | [file:line] |
| Audit trail for all PHI access | PASS/FAIL | [file:line] |
| Automatic session timeout | PASS/FAIL | [config] |
| BAA (Business Associate Agreement) with vendors | PASS/FAIL | [docs] |
| De-identification / anonymization for analytics | PASS/FAIL | [file:line] |
| Emergency access procedure documented | PASS/FAIL | [docs] |

## PCI-DSS Checklist

| Check | Status | Evidence |
|-------|--------|----------|
| Card data NEVER stored in code/database | PASS/FAIL | [file:line] |
| Use payment processor (Stripe, etc.) | PASS/FAIL | [config] |
| Card data not in logs | PASS/FAIL | [file:line] |
| HTTPS for all payment endpoints | PASS/FAIL | [config] |
| Input validation on payment forms | PASS/FAIL | [file:line] |

```bash
# Detect card data in code (NEVER should exist)
grep -rn "credit\|card.*number\|cvv\|exp_date\|card_number" --include="*.ts" --include="*.js" --include="*.py" . | grep -v "test\|mock\|type\|interface" | head -10

# Detect card data in logs (NEVER should exist)
grep -rn "card\|payment" --include="*.log" . 2>/dev/null | head -10
```

## CCPA Checklist

| Check | Status | Evidence |
|-------|--------|----------|
| "Do Not Sell My Data" link | PASS/FAIL | [file:line] |
| Right to know (data collection disclosure) | PASS/FAIL | [file:line] |
| Right to delete | PASS/FAIL | [file:line] |
| Financial incentive disclosure | PASS/FAIL | [docs] |
| Opt-out mechanism | PASS/FAIL | [file:line] |

## Output Format

```markdown
# Compliance Report

**Date:** YYYY-MM-DD
**Framework:** GDPR | SOC2 | HIPAA | PCI-DSS | CCPA
**Project:** [name]

## Summary

| Category | PASS | FAIL | N/A |
|----------|------|------|-----|
| Data Collection | X | Y | Z |
| Data Processing | X | Y | Z |
| Security Controls | X | Y | Z |
| Audit Logging | X | Y | Z |
| Data Subject Rights | X | Y | Z |

## Verdict: COMPLIANT | NON-COMPLIANT | PARTIAL

## Critical Failures

### [FAIL] No audit logging on data access
- Framework: SOC2, HIPAA
- File: src/services/user.ts:45
- Risk: Cannot prove who accessed PHI/PII
- Fix: Add audit log before data access:
  ```typescript
  auditLogger.log({ userId, action: 'read', resource: 'user', id: userId });
  ```

## Recommendations

### [HIGH] Add data retention policy
- Framework: GDPR, CCPA
- Currently: No automated deletion
- Suggested: Implement cron job to delete data older than [policy]

## Passed Checks

- [x] Authentication on all sensitive endpoints
- [x] Secrets in environment variables
- [x] TLS for all connections
```

## Severity Rules

| Severity | When |
|----------|------|
| **CRITICAL** | Active data breach vector, card data in code, PHI exposed |
| **HIGH** | Missing required controls (auth, encryption, audit) |
| **MEDIUM** | Missing recommended controls (retention, portability) |
| **LOW** | Documentation gaps, minor policy deviations |

## When NOT to Use

- For projects with no user data
- For internal tools with no regulatory requirements
- When compliance is already certified and this is just a re-check

## Pair With

- `security-review` — for technical security vulnerability analysis
- `dependency-audit` — for license compliance (related but different)
- `observability` — for audit logging implementation
- `api-design` — for consent/opt-out endpoint design
