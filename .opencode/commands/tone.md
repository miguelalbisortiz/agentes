---
description: "Switch communication density of the primary agent (caveman mode). `/tone lite` = professional but tight (default), `/tone full` = ultra-compressed caveman. Shorthand for `/caveman lite|full`, which also covers ultra and the wenyan levels."
agent: build
---

# Tone Command

Set the primary agent's communication level for the rest of the session.

## Usage

- `/tone lite` — professional but tight: no filler/hedging, full sentences, articles kept. **Default.**
- `/tone full` — classic caveman: drop articles, fragments OK, short synonyms. ~75% fewer tokens.

Both write the same session state as `/caveman`. For `ultra` or the wenyan levels, use `/caveman <level>`.

## Behavior

1. Read `$ARGUMENTS`. If empty, report current tone and the two options.
2. Apply the requested level to your responses from now on (persist for the session).
3. Keep `lite` unless the user explicitly asks for `full` — do not auto-escalate on this command.

## Auto-detection (built-in)

Even at `lite`, auto-escalate to `full` for a single response when the user's request contains multi-step keywords: `planificar|implementar|refactorizar|desplegar|auditar|migrar` (or EN: `plan|implement|refactor|deploy|audit|migrate`) AND is longer than 120 chars. Resume `lite` after.

## Notes

- Security warnings, irreversible-action confirmations, and ambiguous multi-step instructions always switch to normal clarity (caveman skill: auto-clarity), regardless of tone.
- User can say "stop caveman" / "normal mode" to disable compression entirely for the session.
