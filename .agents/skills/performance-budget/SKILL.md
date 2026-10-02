---
name: performance-budget
description: Use this skill when defining, validating, or monitoring performance budgets for web applications. Covers Core Web Vitals (LCP, FID, CLS), bundle size limits, load time thresholds, and runtime performance metrics. Detects regressions and suggests prioritized optimizations.
triggers: [performance, budget, LCP, FID, CLS, bundle size, load time, Core Web Vitals, threshold, metric, optimization, speed, slow, regresión, rendering, paint, TTI, TBT, FCP,ighthouse]
origin: starter-pack
---

# Performance Budget Skill

Define, validate, and monitor performance budgets for any web project.

## When to Activate

- Before major release (validate against budgets)
- When user reports slowness or performance issues
- After adding heavy dependencies
- When CI/CD includes performance gates
- Periodically as health check

## Default Budgets (Core Web Vitals)

| Metric | Good | Needs Improvement | Poor |
|--------|------|-------------------|------|
| **LCP** (Largest Contentful Paint) | ≤ 2.5s | ≤ 4.0s | > 4.0s |
| **FID** (First Input Delay) | ≤ 100ms | ≤ 300ms | > 300ms |
| **CLS** (Cumulative Layout Shift) | ≤ 0.1 | ≤ 0.25 | > 0.25 |
| **INP** (Interaction to Next Paint) | ≤ 200ms | ≤ 500ms | > 500ms |
| **TTFB** (Time to First Byte) | ≤ 800ms | ≤ 1800ms | > 1800ms |
| **FCP** (First Contentful Paint) | ≤ 1.8s | ≤ 3.0s | > 3.0s |
| **TBT** (Total Blocking Time) | ≤ 200ms | ≤ 600ms | > 600ms |

## Bundle Size Budgets

| Resource | Budget | Warning |
|----------|--------|---------|
| Total JS bundle | ≤ 200KB (gzipped) | > 150KB |
| Total CSS | ≤ 50KB (gzipped) | > 40KB |
| Total images (per page) | ≤ 500KB | > 300KB |
| First load JS (Next.js) | ≤ 100KB | > 80KB |
| Single chunk | ≤ 50KB | > 40KB |

## Diagnostic Commands

### Bundle Analysis

```bash
# Next.js
ANALYZE=true npm run build

# Webpack
npx webpack-bundle-analyzer stats.json

# Vite
npx vite-bundle-visualizer

# General
npx source-map-explorer 'dist/**/*.js' --json > stats.json
```

### Lighthouse

```bash
# CLI
npx lighthouse https://example.com --output=json --output-path=./lighthouse.json

# CI mode
npx lighthouse https://example.com --chrome-flags="--headless" --output=json
```

### Build Size

```bash
# Check dist/build size
du -sh dist/ build/ .next/

# Per-file breakdown
find dist -name "*.js" -exec ls -lh {} \;
find dist -name "*.css" -exec ls -lh {} \;
```

### Runtime Performance

```bash
# Node.js profiling
node --prof app.js
node --prof-process isolate-*.log > processed.txt

# Memory usage
node --max-old-space-size=512 app.js

# Python
python -m cProfile -o profile.stats app.py
```

## Validation Process

### Step 1: Measure Current State

```bash
# Build and measure
npm run build 2>&1 | tail -20
du -sh dist/ .next/ build/

# Bundle breakdown
find dist -name "*.js" -exec ls -lh {} \; 2>/dev/null | sort -k5 -h | tail -10
find dist -name "*.css" -exec ls -lh {} \; 2>/dev/null | sort -k5 -h | tail -10
```

### Step 2: Compare Against Budget

| Metric | Measured | Budget | Status |
|--------|----------|--------|--------|
| [metric] | [value] | [budget] | PASS/FAIL |

### Step 3: Identify Offenders

```bash
# Largest JS files
find dist -name "*.js" -exec ls -lh {} \; | sort -k5 -h | tail -5

# Dependencies contributing to bundle
npx depcheck 2>/dev/null
npm ls --all 2>/dev/null | wc -l
```

### Step 4: Suggest Optimizations

Prioritized by impact:

| Priority | Action | Expected Impact |
|----------|--------|-----------------|
| 1 | [biggest offender] | [estimated savings] |
| 2 | [next offender] | [estimated savings] |
| 3 | [minor optimization] | [estimated savings] |

## Common Optimizations

| Optimization | Impact | Difficulty |
|-------------|--------|------------|
| Tree shaking / dead code elimination | HIGH | LOW |
| Dynamic imports / code splitting | HIGH | MEDIUM |
| Image optimization (WebP, lazy load) | HIGH | LOW |
| Bundle analysis + remove unused deps | MEDIUM | LOW |
| Compression (gzip/brotli) | MEDIUM | LOW |
| Prefetch / preload critical resources | MEDIUM | LOW |
| Service worker caching | MEDIUM | HIGH |
| Server-side rendering | HIGH | HIGH |
| CDN for static assets | MEDIUM | LOW |

## Output Format

```markdown
# Performance Budget Report

**Date:** YYYY-MM-DD
**URL/Project:** [name]

## Core Web Vitals

| Metric | Measured | Budget | Status |
|--------|----------|--------|--------|
| LCP | X.Xs | ≤ 2.5s | ✅/❌ |
| FID | XXms | ≤ 100ms | ✅/❌ |
| CLS | X.XX | ≤ 0.1 | ✅/❌ |

## Bundle Size

| Resource | Measured | Budget | Status |
|----------|----------|--------|--------|
| Total JS | XXXKB | ≤ 200KB | ✅/❌ |
| Total CSS | XXKB | ≤ 50KB | ✅/❌ |

## Verdict: PASS | FAIL

## Top Offenders

1. [file/dep] — [size] — [suggestion]
2. ...

## Recommended Optimizations

[Prioritized list]
```

## When NOT to Use

- For non-web projects (CLI tools, libraries without UI)
- When performance is not a concern
- For simple static sites

## Pair With

- `code-reviewer` (mode: full) — for code-level performance issues
- `performance-optimizer` agent — for deep optimization work
- `verification-loop` — as part of pre-release quality gate
