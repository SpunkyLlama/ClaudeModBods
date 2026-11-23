# Help Desk

A Claude Code mod that shows what Claude is working on, in one row above the prompt:

```
▶ Running tests (3/7)  │  2 running: scan repo 12k, fix tests 4k · 3 done
```

- **To-do list.** The item in progress (its "doing" wording), with how many are done, or the next pending item, or "✓ 7/7 done". It follows both to-do tools Claude Code has (`TodoWrite`, and `TaskCreate` / `TaskUpdate`). Only the main chat's list is shown, not a subagent's own.
- **Subagents.** How many are running, the first two with their tokens, and how many have finished (failures flagged). A card appears when a subagent starts and is marked done when the engine's agent list stops showing it.
- **Read-only.** It watches and draws. It never blocks, rewrites or holds anything, writes no file in your project and makes no network call. If one of its hooks fails, the call it watched goes through untouched.
- **Keeps your list when you leave a chat.** Coming back to a chat starts a fresh session, so the mod saves each chat's to-do text, subagent labels and counters in its own plugin store (nothing from the conversation, newest 50 chats) and restores them on return. A `TaskUpdate` for a task it never saw is shown as a placeholder (named by its subject if it has one, else "Task 3"), so progress still counts.

**This mod reads subagent turns.** Unlike Cache Keeper, which ignores them, Help Desk counts each request a subagent makes toward that subagent's token figure.

## What the numbers mean

"Tokens" is tokens processed: everything a subagent's requests read, wrote or generated, cache reads included. It is a size measure, not a bill, because a cache read costs a fraction of an output token. There is no dollar figure per subagent: the engine reports only a session total, which Cache Keeper shows.

## The pane (0.2.0): `/helpdesk`

Type `/helpdesk` to open a pane with the whole picture, not the one-line summary:

```
To-do · 3/7 done
  ✓ Read the code
  ▶ Writing tests
  ☐ Ship it

Subagents · 1 running · 2 done
  ▶ scan repo (Explore, haiku) · 12k tokens · 4 steps
  ✓ fix tests (general-purpose, sonnet) · 4k tokens · 2 steps
```

- **It opens only when you ask.** The mod never opens it on its own. An open you ask for is placed at any width; one a mod makes unasked would wait for a very wide terminal.
- **It shares the band's data**, so the pane and the band change together. Both stay.
- **What a card shows:** the subagent's short description, type, model, tokens and steps, and whether it is running, idle, done (dim) or failed. It does not show what the subagent is doing right now: the engine's agent list has no such field, so nothing is invented.
- **Short on room,** the pane hides the oldest finished items first and ends with `… N hidden`. The item in progress is the last thing to go.
- **The desktop app's small "widget" form** gets the band's two-line summary instead, since it has to read at a glance.
- **If it does not draw,** `/helpdesk` says why when the engine gives a reason, and the debug row ends with `pane: drawn`, `pane: not drawn (reason)` or `pane: not opened`.
- If the app refuses the name `/helpdesk` (a user skill of that name would win), a toast says so once.

## Debug row (0.1.1)

If the band stays blank, turn on the **Debug row** setting. The row then always draws, even with nothing to show:

```
Help Desk loaded · to-dos 0 · agents 0 · hooks seen: 0 task calls, 0 spawns, 0 subagent steps
```

- No row at all: the mod is not loaded in this chat, or the app attaches no display surface (`/cache` lists the surfaces).
- The row draws but "hooks seen" stays at 0 after Claude uses a to-do list or starts a subagent: the app is not calling the mod's hooks.
- The counters rise but the normal row stays empty: the mod sees the events and something later in its logic drops them.

The counters count only what happens after the mod loads, so a chat that already has a to-do list shows it only once Claude changes the list.

## Limits

- Draws only where the app attaches a display surface: `/cache` lists the "display surfaces" it sees. The terminal CLI has one, and so did a cloud session in the desktop app (seen 2026-11-22: `desktop`). Where none is attached, nothing shows. This band has not yet been seen drawing.
- Finished subagents are noticed by checking the agent list every 1.5 seconds, because the engine has no "subagent finished" event for plugins. A subagent that starts and ends between two checks, before it is ever listed, is marked done after 15 seconds.
- In-progress items are marked, not flashing. The pane is plain text: no clicking, no per-card dollars.
- Subagents started by another plugin through `$.agent.spawn` are not seen (the engine skips plugin hooks for them).
- The pane has never been seen drawing. The layout has offline tests; whether the desktop app, the terminal or a cloud session seats and draws it as the engine's type file describes has not been checked live.

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
