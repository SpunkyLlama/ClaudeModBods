# Help Desk

A Claude Code mod that shows what Claude is working on, in one row above the prompt:

```
▶ Running tests (3/7)  │  2 running: scan repo 12k, fix tests 4k · 3 done
```

- **To-do list.** The item in progress (its "doing" wording), with how many are done, or the next pending item, or "✓ 7/7 done". It follows both to-do tools Claude Code has (`TodoWrite`, and `TaskCreate` / `TaskUpdate`). Only the main chat's list is shown, not a subagent's own.
- **Subagents.** How many are running, the first two with their tokens, and how many have finished (failures flagged). A card appears when a subagent starts and is marked done when the engine's agent list stops showing it.
- **Read-only.** It watches and draws. It never blocks, rewrites or holds anything, writes no file and makes no network call. If one of its hooks fails, the call it watched goes through untouched.

**This mod reads subagent turns.** Unlike Cache Keeper, which ignores them, Help Desk counts each request a subagent makes toward that subagent's token figure.

## What the numbers mean

"Tokens" is tokens processed: everything a subagent's requests read, wrote or generated, cache reads included. It is a size measure, not a bill, because a cache read costs a fraction of an output token. There is no dollar figure per subagent: the engine reports only a session total, which Cache Keeper shows.

## Limits in 0.1.0

- Draws only where the app shows mod UI (the terminal CLI). A cloud session attaches no display surface, so nothing shows there.
- Finished subagents are noticed by checking the agent list every 1.5 seconds, because the engine has no "subagent finished" event for plugins. A subagent that starts and ends between two checks, before it is ever listed, is marked done after 15 seconds.
- In-progress items are marked, not flashing, and there is no side pane of subagent cards yet.
- Subagents started by another plugin through `$.agent.spawn` are not seen (the engine skips plugin hooks for them).
- Not yet tried in a live chat. The logic has offline tests; the drawing and the events have only been checked against the engine's type file.

## Install

```
/plugin install help-desk --marketplace SpunkyLlama/claudemodbods
```

## Test

From this folder:

```
node --experimental-strip-types tests/desk.test.ts
claude plugin validate --strict .
```
