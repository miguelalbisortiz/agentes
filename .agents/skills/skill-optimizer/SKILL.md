---
name: skill-optimizer
description: Use when auditing, optimizing, or maintaining agent skills in a pack. Covers skill lifecycle management: mining repeated workflows, auditing skill quality, detecting orphan skills, optimizing token usage, and preparing skills for public release.
---

# Skill Optimizer

Lifecycle toolkit for agent skills: mine, audit, optimize, release.

## Core Principles

1. **Usage-driven** — skills should be used, not just exist
2. **Token-efficient** — every token must earn its place
3. **Quality over quantity** — fewer good skills beat many mediocre ones
4. **Discoverable** — clear triggers and descriptions
5. **Maintainable** — regular audits keep skills fresh

## Skill Lifecycle

```text
1. Mine      — identify repeated workflows worth automating
2. Draft     — create SKILL.md with triggers and content
3. Test      — verify skill loads and produces expected output
4. Optimize  — trim tokens, improve triggers, remove redundancy
5. Monitor   — track usage and effectiveness
6. Retire    — remove skills that are unused or obsolete
```

## Step 1 — Mine Workflows

Look for repeated patterns in your workflow:

```bash
# Find repeated commands
cat ~/.opencode/logs/*.log 2>/dev/null | grep "Dispatching" | sort | uniq -c | sort -rn

# Find patterns in session history
ls -la docs/sessions/*.md | head -5
# Read recent sessions for repeated actions
```

### Mining Signals

- Same task done 3+ times → candidate for skill
- Complex multi-step workflow → candidate for skill
- Frequently asked question → candidate for skill
- Error that keeps appearing → candidate for skill

## Step 2 — Audit Existing Skills

### Audit Checklist

- [ ] Has `name` in frontmatter (kebab-case)
- [ ] Has `description` starting with "Use when..."
- [ ] Description is 1-1024 characters
- [ ] Triggers are relevant and specific
- [ ] Content is actionable (not just theory)
- [ ] References to other skills/agents are valid
- [ ] Token count is reasonable (< 5KB ideal)

### Audit Command

```bash
# Check all skills
node .opencode/bin/validate-frontmatter.js 2>&1 | grep "skill/"

# Count tokens per skill
wc -c .opencode/skill/*/SKILL.md | sort -rn

# Find skills without triggers
grep -L "triggers" .opencode/skill/*/SKILL.md
```

## Step 3 — Optimize Token Usage

### Token Reduction Strategies

| Strategy | Savings | Risk |
|----------|---------|------|
| Remove examples → bullet points | 30-50% | Low |
| Remove redundant explanations | 20-30% | Low |
| Consolidate similar sections | 15-25% | Medium |
| Use tables instead of prose | 20-40% | Low |
| Remove "what is X" definitions | 10-20% | Low |

### Token Budget

| Skill Size | Tokens | When OK |
|-----------|--------|---------|
| < 2KB | < 500 | Simple reference |
| 2-5KB | 500-1250 | Standard skill |
| 5-10KB | 1250-2500 | Complex skill (review needed) |
| > 10KB | > 2500 | Split or consolidate |

## Step 4 — Detect Orphan Skills

Skills that exist but are never referenced:

```bash
# Find skills not referenced by any agent or command
for skill in .opencode/skill/*/; do
  name=$(basename "$skill")
  if ! grep -rq "$name" .opencode/agents/ .opencode/commands/ .opencode/AGENTS.md; then
    echo "ORPHAN: $name"
  fi
done
```

### Orphan Actions

| Status | Action |
|--------|--------|
| Never referenced | Consider removing or adding references |
| Referenced but outdated | Update content |
| Referenced but rarely used | Keep if high-value when needed |

## Step 5 — Quality Metrics

### Skill Quality Score

```
Quality = (Usage × Relevance × Completeness) / Token_Cost

Where:
- Usage: how often the skill is loaded (0-10)
- Relevance: how well triggers match real requests (0-10)
- Completeness: does it answer all related questions (0-10)
- Token_Cost: tokens consumed (lower = better)
```

### Red Flags

- Description doesn't start with "Use when..."
- Token count > 10KB without justification
- No triggers defined
- References to deleted agents/skills
- Content is mostly theory, no actionable steps

## Step 6 — Prepare for Release

### Public Release Checklist

- [ ] All internal references updated
- [ ] No hardcoded paths or project-specific content
- [ ] Description is clear and actionable
- [ ] Examples are generic (not project-specific)
- [ ] Token count is reasonable
- [ ] Triggers cover common use cases
- [ ] No secrets or sensitive information

## When to Use

- **Monthly** — audit skill health and usage
- **After major changes** — ensure skills still work
- **Before releasing pack** — optimize for token efficiency
- **When adding new skills** — follow quality guidelines
- **When skills feel bloated** — trim and consolidate

## See Also

- `skill: pack-reference` — pack structure and conventions
- `agent: harness-optimizer` — agent optimization
- `command: /pack-doctor` — pack health check
