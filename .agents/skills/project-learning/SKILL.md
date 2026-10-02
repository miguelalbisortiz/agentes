---
name: project-learning
description: Use when user wants to extract, maintain, or review project-specific learnings from session history. Keeps docs/LEARNING.md updated with patterns, bugs, solutions, and user preferences.
---

# Project Learning Skill

Extract and maintain project-specific learnings from session history.

## Triggers
- "aprende", "learn", "learning", "patrones", "patterns"
- Al finalizar cada sesión (auto)

## Workflow
1. Read docs/sessions/*.md (últimas 5 sesiones)
2. Extract:
   - Code patterns used (naming, architecture, libraries)
   - Bugs found and solutions
   - Performance optimizations applied
   - Security issues detected
   - User preferences discovered
3. Write to docs/LEARNING.md with timestamp
4. On session start, read docs/LEARNING.md first

## Output Format
# Project Learnings
Last updated: {timestamp}

## Code Patterns
- Pattern: {description} | Used in: {files} | Date: {date}

## Bugs & Solutions  
- Bug: {description} | Solution: {fix} | Files: {files} | Date: {date}

## Performance
- Optimization: {description} | Impact: {metric} | Files: {files} | Date: {date}

## Security
- Issue: {description} | Fix: {solution} | Files: {files} | Date: {date}

## User Preferences
- Preference: {description} | Context: {when} | Date: {date}
