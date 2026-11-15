# ClaudeModBods

A collection of Claude Code mods in one repo. A mod is a small plugin that
changes how Claude Code looks and behaves, for any project.

## Mods

| Mod | What it does | Status |
| --- | --- | --- |
| [Cache Keeper](cache-keeper/README.md) | Warm/cold prompt-cache status, tokens and cost, a nudge to start a new chat, and `/handoff`. | Shipped, version 1.1.0 |
| Brain Dump | Quick capture of loose ideas into a file, then triage into tickets or notes. | Planned |
| Help Desk | Claude's to-do list and a live card per subagent, with tokens and cost. | Planned |

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
