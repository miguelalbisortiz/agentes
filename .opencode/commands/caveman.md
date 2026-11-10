---
description: "Set the caveman compression level for the session: `/caveman lite|full|ultra|wenyan-lite|wenyan-full|wenyan-ultra|off`. `/tone` is a shorthand for the lite/full pair. Use when the user wants to control response density or token spend."
agent: build
---

# Caveman Command

Set the primary agent's compression level for the rest of the session.

## Usage

| Argument | Level |
|---|---|
| `/caveman` | report the current level and the options; change nothing |
| `/caveman lite` | no filler or hedging, full sentences, articles kept. **Default** |
| `/caveman full` | classic caveman: drop articles, fragments OK, short synonyms. ~75% fewer tokens |
| `/caveman ultra` | bare fragments, abbreviations (DB/auth/fn), arrows for causality |
| `/caveman wenyan-lite` | semi-classical register, light compression |
| `/caveman wenyan-full` | maximum 文言文, 80-90% character reduction |
| `/caveman wenyan-ultra` | extreme classical compression |
| `/caveman off` | back to normal prose for the session |

`/tone lite` and `/tone full` are the same two levels under an older name; both commands write the same session state.

## Behavior

1. Read `$ARGUMENTS`. Empty → report the current level and the table above; do not change anything.
2. Load the `caveman` skill (`.agents/skills/caveman/SKILL.md`) and apply the requested level from now on, including the intensity rules and the auto-clarity exceptions defined there.
3. Persist for the session. The level survives turns and context changes until the user changes it, says "stop caveman" / "normal mode", or the session ends.
4. Default stays `lite`: do not escalate on your own initiative, except for the single-response auto-escalation below.
5. `ultra`, `wenyan-lite`, `wenyan-full` and `wenyan-ultra` are only set when the user asks for them by name.

## Auto-escalation (single response)

At `lite`, escalate to `full` for one response when the request has multi-step keywords (`planificar|implementar|refactorizar|desplegar|auditar|migrar`, or EN `plan|implement|refactor|deploy|audit|migrate`) **and** is longer than 120 characters. Resume `lite` after that response.

## Non-negotiables

- Security warnings, irreversible-action confirmations, and ambiguous multi-step instructions always use normal clarity, at any level.
- Never announce the style or narrate the switch; the only exception is when the user asks what the current level is.
- Code, commits, PR bodies and error strings are written normally, never compressed.
- Keep the user's language: compress the style, not the language.

## Post-compaction

If the instructions were compacted away, re-load the skill and keep the current level: it is session state, not a per-turn choice.
