---
name: debugging-patterns
description: Use this skill when investigating bugs, performance issues, or production incidents. Covers the diagnostic workflow (reproduce, bisect, hypothesize, eliminate), logging strategies (correlation IDs, structured logs, strategic placement), interactive debugging (breakpoints, watch expressions, conditional breakpoints, logpoints), profiling (CPU via perf/py-spy/pprof/clinic.js, memory via heap snapshots, I/O and lock profiling), postmortem templates (5 Whys, timeline reconstruction), and common bug categories (off-by-one, race conditions, null/undefined, timezones, encoding). Pair with incident-responder for production issues and observability for logging patterns.
triggers: [debug, debugging, bug, bugfix, reproduce, bisect, git bisect, log, console.log, print, print debug, breakpoint, debugger, watch, profile, profiler, perf, py-spy, pprof, clinic.js, flamegraph, heap snapshot, memory leak, race condition, deadlock, off-by-one, null pointer, NPE, undefined, timezone, encoding, postmortem, 5 whys, root cause, flaky test, flake, intermittent, stack trace, stacktrace, coredump, minidump]
origin: starter-pack
---

# Debugging Patterns

The discipline of finding and fixing the cause of a problem, not just the symptom. Most debugging failures are process failures — jumping to "fix" before understanding, fixing the wrong thing, fixing the symptom not the cause.

This skill is the **workflow and techniques**. For *tooling* (specific debugger commands, profiler flags), see your stack's documentation. For *production incident response* (live systems, on-call), see `incident-responder`.

## When to Activate

- A bug report comes in (with or without repro)
- A test is flaky / intermittent
- Performance regression (latency, throughput, memory)
- A coredump or stacktrace needs interpretation
- A service is misbehaving in production but logs show nothing useful
- A user says "it works on my machine" or "it only fails sometimes"
- Reviewing someone else's debugging approach (PR or chat)
- Writing a postmortem after a resolved incident

## Do Not Activate For

- Pure TDD on greenfield code (no bug to find)
- Code review on non-bug code (use `code-reviewer` or stack reviewer)
- Performance optimization without first identifying the bottleneck (use `performance-optimizer` for that)

## Core Principles

1. **Reproduce first, fix second.** A bug you can't reproduce is a bug you can't verify is fixed. Spend the time to make it deterministic.
2. **Hypothesize before you change.** State your current best guess: "I think the bug is in X because Y." If your fix doesn't address the hypothesis, you're guessing.
3. **Change one thing at a time.** A "fix" that changes five things teaches you nothing when it works. Bisect, isolate, fix, verify.
4. **The cause is rarely where the symptom appears.** The user reports a UI error; the bug is in the API; the API bug is in the DB query; the DB query bug is in the migration. Trace up the stack.
5. **Trust nothing you haven't verified.** "It can't be X" is a hypothesis to test, not a fact. Especially true for "it can't be a race condition" (it can) and "the data must be valid" (it might not be).
6. **Document your investigation as you go.** Comments in the test that reproduces. Notes in the PR description. The next person debugging will thank you. Future you will too.
7. **The fix is for the root cause, not the symptom.** Adding `try/catch` around the crash makes the symptom go away. Understanding *why* it crashed prevents the next instance.

## The Diagnostic Workflow

Five phases, in order. Skipping phases wastes more time than following them.

### Phase 1: Reproduce

Goal: get the failure to happen on demand, ideally with a test or script.

- **Get the exact conditions**: which input, which user, which environment, which time.
- **Minimize the repro**: strip the input to the smallest case that still fails. This often reveals the cause.
- **Automate the repro**: a failing test, a script, a curl command. If the repro is "click this button after this dance", it's not stable enough.
- **Distinguish always-fails vs. sometimes-fails**: different bugs, different techniques. Always-fails is logic. Sometimes-fails is concurrency, state, or environment.

```bash
# Save the curl that reproduces
curl -X POST https://api.example.com/checkout \
  -H "Content-Type: application/json" \
  -d '{"cart": "abc123", "coupon": "EXPIRED"}' \
  | jq
```

```typescript
// Failing test that reproduces
test("checkout with expired coupon returns 400", async () => {
  const res = await checkout({ cart: "abc123", coupon: "EXPIRED" })
  expect(res.status).toBe(400) // currently returns 500
})
```

### Phase 2: Localize

Goal: narrow down the location (file, function, line) of the bug.

- **Read the stack trace from bottom to top**: the root cause is usually in the lowest frame, not the top.
- **Add strategic logging**: log entry to each suspect function with input + state. Run. See where reality diverges from expectation.
- **Bisect**: when the bug appeared in a regression, use `git bisect` to find the commit that introduced it.
- **Trace the data**: print the value of the suspect variable at each transformation. Where did it go wrong?

```bash
# Git bisect for "when did this start failing?"
git bisect start
git bisect bad                    # current commit is broken
git bisect good <commit-hash>     # this commit worked
# then for each commit git picks, mark good/bad
# when done: git bisect reset
```

For automated bisect (faster):

```bash
git bisect start HEAD <good-commit>
git bisect run npm test
```

Git runs the test on each commit, marks good/bad, finds the culprit.

### Phase 3: Hypothesize

Goal: have a *testable* explanation of *why* it fails.

- State the hypothesis explicitly: "I think `parseDate` returns null when the input is missing, because the regex doesn't match the empty string."
- Make it falsifiable: "If I add a console.log in `parseDate` with the empty input, I should see null returned. If I see undefined, my hypothesis is wrong."
- Multiple hypotheses: rank them by likelihood. Test the most likely first.

### Phase 4: Verify (the hypothesis is wrong, often)

Goal: confirm or kill the hypothesis.

- Add the observation (log, breakpoint, assertion) that would distinguish your hypothesis from alternatives.
- If the observation matches: hypothesis is likely correct. Move to fix.
- If it doesn't: kill the hypothesis, form a new one. Don't add a "fix" that papers over the gap.

**Common failure mode**: the first hypothesis feels right, so the engineer "fixes" without verifying. The fix doesn't actually address the cause, and the bug returns in a slightly different form.

### Phase 5: Fix at the root

Goal: change the *cause*, not the symptom.

- Apply the smallest change that addresses the cause.
- Add a regression test (this is non-negotiable — see `testing-patterns`).
- Run the full test suite to confirm no other paths broke.
- Commit with a message that explains the cause: `fix: handle null parseDate return in checkout validator (regression from #1234)`, not `fix: bug`.

## Logging Strategies

### What to log, where

| Layer | What to log | Why |
|-------|-------------|-----|
| Entry/exit of public API | Input params, return value, duration | Trace request flow |
| Inside loops | Iteration count, current item | Detect infinite loops, wrong data |
| Around I/O | Before and after, with size | Network/disk is usually where things break |
| On error | Full error + context that produced it | Reproducibility |
| State transitions | "old_state → new_state, reason" | Audit, debugging state machines |

What **not** to log:
- Passwords, tokens, session IDs (see `security-review` for PII patterns)
- Full request bodies in production (often contains PII; log specific fields)
- Inside tight loops (use sampling or "every Nth")

### Strategic placement

```typescript
// Bad: log at the top of every function, no signal
function processOrder(order) {
  console.log("processing order") // always
  // ... 50 lines ...
}

// Good: log at decision points
function processOrder(order) {
  logger.info("order received", { orderId: order.id, items: order.items.length })
  if (!validateInventory(order)) {
    logger.warn("inventory check failed", { orderId: order.id, missing: getMissingItems(order) })
    return { error: "OUT_OF_STOCK" }
  }
  // ...
  logger.info("order completed", { orderId: order.id, total: order.total, durationMs })
}
```

### Correlation IDs

For multi-service or multi-request flows, propagate a correlation ID through every log call. The `observability` skill covers the implementation; here, the debugging pattern:

```typescript
// Every log line in a request should include the correlationId
// Then to debug: filter logs by correlationId, see the entire flow
const correlationId = req.headers["x-correlation-id"] ?? crypto.randomUUID()
req.log = req.log.child({ correlationId })

// Or via async context (Node 16+ AsyncLocalStorage)
const als = new AsyncLocalStorage()
als.run({ correlationId }, () => next())
// logger picks up correlationId from als automatically
```

To debug a reported issue: get the correlationId from the user (or from a related record), filter all logs by it, replay the entire request.

## Interactive Debugging

### Breakpoint types

| Type | When to use | Example |
|------|-------------|---------|
| **Line breakpoint** | Pause at a specific line | "What is `x` here?" |
| **Conditional breakpoint** | Pause only when condition is true | "Pause when `userId === 12345`" |
| **Logpoint** | Log a value without pausing | "Print `x` for every iteration without breaking" |
| **Data breakpoint** | Pause when a variable is written | "Who is setting `state.user = null`?" |
| **Exception breakpoint** | Pause on any thrown exception | "What threw?" |

### Watch expressions vs. hover

- **Hover**: quick value check, single point in time
- **Watch**: expression re-evaluated on every step, see how it changes
- **Conditional breakpoint**: pause only when watch matches, fewer stops

### Common debugger workflows

```typescript
// Node.js / VS Code launch.json
{
  "type": "node",
  "request": "launch",
  "name": "Debug Tests",
  "program": "${workspaceFolder}/node_modules/.bin/vitest",
  "args": ["run", "--reporter=verbose"],
  "skipFiles": ["<node_internals>/**"]
}
```

```python
# Python: pdb or ipdb
import pdb; pdb.set_trace()  # or breakpoint() in 3.7+

# In the trace:
# n = next line
# s = step into
# c = continue
# p x = print x
# pp x = pretty print
# l = list source around current line
# w = where (stack)
# u = up the stack
# d = down the stack
# q = quit
```

```go
// Go: delve (dlv)
dlv debug ./cmd/api --breakpoint=main.go:42 -- print-vars
// or in code: panic("inspect") at the point of interest
```

## Profiling

Profile before optimizing. Optimizing without profiling optimizes the wrong thing.

### CPU profiling

What takes time, in what proportion.

```bash
# Python: py-spy (no code changes, low overhead)
py-spy top --pid 12345           # live top-like view
py-spy record -o profile.svg -- python main.py  # flamegraph
py-spy dump --pid 12345          # textual stack samples

# Node.js: clinic.js
clinic doctor -- node server.js
clinic flame -- node server.js   # flamegraph
clinic bubbleprof -- node server.js  # I/O and async visualization

# Go: pprof
go tool pprof http://localhost:6060/debug/pprof/profile?seconds=30
# In pprof: top, list functionName, web (visualize), peek, focus=regex

# Rust: cargo flamegraph
cargo install flamegraph
cargo flamegraph --bin myapp
# or with perf directly
perf record -F 99 -p $(pgrep myapp) -g -- sleep 30
perf script | stackcollapse-perf.pl | flamegraph.pl > flame.svg

# Generic Linux: perf + FlameGraph
perf record -F 99 -ag -- <command>
```

How to read a flamegraph:
- **Width** = CPU time. Wide plateau = hotspot.
- **Y axis** = stack depth. Bottom = entry, top = leaf.
- **Color** = arbitrary (often by module). Look for wide plateaus at the top.
- **Don't optimize deep narrow stacks** — those aren't the bottleneck.

### Memory profiling

Find leaks (memory grows unbounded) and bloat (single allocations are huge).

```bash
# Node.js: heap snapshots
node --inspect-brk server.js
# In Chrome DevTools: Memory tab → Take heap snapshot
# Or programmatically:
const v8 = require("v8")
v8.writeHeapSnapshot(`/tmp/heap-${Date.now()}.heapsnapshot`)

# Python: memray
memray run -o output.bin python main.py
memray flamegraph output.bin
memray stats output.bin

# Go: pprof heap
go tool pprof http://localhost:6060/debug/pprof/heap
# In pprof: top, list, alloc_space vs inuse_space

# Rust: heaptrack or dhat
heaptrack ./myapp
heaptrack_gui heaptrack.myapp.*.gz
# or use dhat via cargo-dhat for ad-hoc analysis
```

### I/O and lock profiling

For "feels slow but CPU is idle" problems.

```bash
# Linux: iostat, iotop, fatrace
iostat -xz 1        # per-disk utilization
iotop -o             # which processes are doing I/O
fatrace              # filesystem operation trace

# strace: trace syscalls
strace -p $(pgrep myapp) -e trace=network,read,write -c
strace -e trace=openat -p $(pgrep myapp)  # which files are being opened

# Application-level: log every DB query, every HTTP call
# Then: which query is called 1000 times? Which HTTP call to a slow service is sequential?
```

## Postmortem Patterns

After a resolved incident, document it. The postmortem is not blame; it's learning.

### Template (lightweight)

```markdown
# Postmortem: <title>

**Date**: YYYY-MM-DD
**Duration**: HH:MM (detection → resolution)
**Severity**: SEV-1 / SEV-2 / SEV-3
**Author**: <name>
**Status**: draft / reviewed

## Summary
One paragraph: what happened, who was affected, what the impact was.

## Timeline (UTC)
- HH:MM — <event>
- HH:MM — <event>
- HH:MM — <event>

## Root Cause
The actual technical cause. Not "human error" — dig deeper. What decision or condition led to the failure?

## Contributing Factors
What made the failure worse or harder to detect. Multiple usually.

## What Went Well
What worked during the incident (good detection, good runbook, good comms).

## What Went Poorly
What didn't work (slow detection, unclear runbook, no comms).

## Action Items
- [ ] <action> — owner, due date, type (prevent / detect / respond)
- [ ] <action> — owner, due date, type
```

### 5 Whys

Iteratively ask "why" until you reach a systemic cause, not a proximate one.

```
Problem: Service returned 500 to all requests for 12 minutes.
Why? The service couldn't connect to the database.
Why? The connection pool was exhausted.
Why? A new feature held connections open for the duration of a long operation.
Why? The long operation didn't have a timeout.
Why? The standard pattern for this operation (used elsewhere) didn't include a timeout, and code review didn't catch the new call.
→ Systemic cause: missing timeout pattern + insufficient code review of new DB call sites.
→ Action: add timeout middleware (prevent), add linter rule (detect), add runbook step (respond).
```

## Common Bug Categories

Quick reference for "what kind of bug is this" — directs your diagnostic approach.

| Category | Typical symptom | First place to look |
|----------|-----------------|---------------------|
| **Off-by-one** | Loop misses first/last item, fence-post error | Loop bounds, `<` vs `<=`, slice ranges |
| **Null/undefined** | "Cannot read property of null" | Where the value is set, where it's assumed to exist |
| **Race condition** | Sometimes fails, more under load | Shared mutable state, no lock, async without await |
| **Deadlock** | Hang, threads/processes stuck | Lock order, lock-with-callback, missing release |
| **Integer overflow** | Negative where positive expected, wraparound | Math, especially in typed languages with fixed widths |
| **Timezone** | "It works in dev (UTC), fails in prod (EST)" | Date construction, ISO parsing, `new Date("2026-01-01")` is UTC, `new Date(2026, 0, 1)` is local |
| **Encoding** | Mojibake, `Ã©` instead of `é` | UTF-8 vs Latin-1, byte/string confusion, `b` vs `str` |
| **Floating point** | 0.1 + 0.2 !== 0.3, money calculations off | Use Decimal/BigInt for money, never float for currency |
| **Async / Promise** | Order of operations wrong, missing await | Promise chain, `forEach` vs `for...of` (latter awaits) |
| **Resource leak** | Memory grows, FDs exhaust over time | File handles, DB connections, listeners without removal |
| **Caching** | Stale data, weird "it works after refresh" | Cache invalidation, TTLs, write-through vs cache-aside |
| **Configuration** | Works in one env, fails in another | Env vars, feature flags, config files — diff them |
| **Migration** | Old data has unexpected shape, new code assumes new shape | Backfill, dual-write, expand-contract pattern |

## Quick-Reference Checklist

When investigating a bug:

- [ ] Can I reproduce it on demand? (failing test, script, or reliable manual repro)
- [ ] Have I narrowed it to a file/function? (logs, breakpoints, bisect)
- [ ] Have I stated a hypothesis explicitly? ("I think X because Y")
- [ ] Have I verified the hypothesis? (added observation that confirms or kills it)
- [ ] Am I fixing the root cause, not the symptom?
- [ ] Did I add a regression test that fails without the fix and passes with it?
- [ ] Did I run the full test suite after the fix?
- [ ] Did I document the investigation (commit message, PR description, comment)?
- [ ] (For production incidents) Is a postmortem filed with action items?

## Pair With

- `incident-responder` — production incidents, on-call, live systems
- `observability` — logging/tracing/metrics patterns (the *what* of observability)
- `testing-patterns` — regression tests, repro tests
- `performance-optimizer` — when the "bug" is a performance regression
- `code-reviewer` — review a bugfix PR for "is the fix actually at the root?"
- `code-quality-analyzer` (mode: silent-failures) — hunt for swallowed errors that masked the original bug
- `tdd-workflow` — red-green for the regression test
