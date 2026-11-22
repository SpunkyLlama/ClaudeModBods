# ClaudeModBods

A collection of Claude Code mods in one repo. A mod is a small plugin that
changes how Claude Code looks and behaves, for any project.

## Mods

| Mod | What it does | Status |
| --- | --- | --- |
| [Cache Keeper](cache-keeper/README.md) | Warm/cold prompt-cache status, tokens and cost, a nudge to start a new chat, and `/handoff`. | Shipped, version 1.2.0 |
| [Brain Dump](brain-dump/README.md) | `/dump` a thought into a file without leaving the chat; `/triage` sorts the pile one entry at a time; `/rewrite` turns an entry into a prompt for a Claude model (written by Haiku), and `/answer` feeds its open questions back for a better second pass. | Shipped, version 0.2.0 (not yet checked in a live chat) |
| [Help Desk](help-desk/README.md) | A band above the prompt with Claude's to-do list and the subagents running, with tokens per subagent. Read-only. | Shipped, version 0.1.0 (not yet checked in a live chat) |

## Install a mod

Install a mod straight from this repo (works in one step on Claude Code
2.1.275 or later):

```
/plugin install cache-keeper --marketplace SpunkyLlama/claudemodbods
```

Each mod's own README lists its settings.

## Adding a mod

One folder per mod, listed in `.claude-plugin/marketplace.json`. See
[CLAUDE.md](CLAUDE.md) for the conventions and [PLAN.md](PLAN.md) for what is
being built.
