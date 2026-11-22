# Memory Index: ClaudeModBods (project)

> Project-local memory. Cross-project preferences live in root `~/.claude/`.
> Last consolidated: 2026-11-22 (Brain Dump 0.2.1, display-surface and command-registration findings added).

## Active Files

- [PLAN.md](../../PLAN.md): active work and the projects list
- [GLOSSARY.md](../../GLOSSARY.md): canonical terms for the mods
- [CLAUDE.md](../../CLAUDE.md): rules, layout, how "Green" is defined

## Cache Keeper: how it works (facts that are not obvious from the code)

- Everything runs from `turn.step`. `turn.complete` never fires in cloud sessions.
- State lives in one atom, `snap`, versioned (`snap-3`).
- The cache lifetime is learned: a warm reply after a gap of 330 seconds or more
  means the 1-hour cache; two colds in a row means the 5-minute cache.
- `turn.step` ignores subagent turns (`e.agentId`). The reply right after
  `/handoff` learns nothing, because the fork touches the cache unseen.
- The running total (Σ) means tokens processed, and includes the fork's tokens.
- `/handoff` writes `HANDOFF.md` in the session's working directory, replacing the
  whole file, from a fork under 400 words. Never keep a list in it. Since 1.2.0 it
  appends the `## Projects` section of `PLAN.md` verbatim (settings `pinnedFile`,
  `pinnedHeading`); a missing file or heading is skipped.
- The engine writes `.claude-plugin/types/` whenever a mod loads. It is not
  tracked, and `tsc -p . --noEmit` only works once the app has loaded the mod.

## Brain Dump: how it works

- One file, `.claude/memory/BRAIN-DUMP.md` under the session's working folder, one
  entry per line: `- [ ] YYYY-MM-DD HH:MM text` (UTC), marked `- [x] ... -> verdict`.
- It only marks entries. It never deletes one, files an issue or edits another
  file. Helpers are in `hooks/dump.ts` so tests run offline.
- The validator follows `$` only into top-level functions, so helpers that take
  `$` are declared at the top of `register.tsx`, not inside `register`.
- `/rewrite` saves a block of `  > ` lines directly under an entry (prompt, then
  `Open questions:`, then `Your answers:`). `parse()` ignores those lines, so
  `/triage` and entry line numbers are unaffected. Saves re-read the file and
  skip an entry that changed while Haiku was writing.
- The writer is `$.model.complete` with `model: 'haiku'`: no tools, no history.
  The model the prompt is FOR is a separate choice (`targetModel`, default opus).
- Imports between hook files need a `.ts` extension for the Node test runner, so
  `rewrite.ts` imports `./guides.ts` behind a `// @ts-ignore`. `register.tsx`
  imports without extensions.
- Commands belong to a session (`$.command.register` declares `/<name>` for this
  session, listed in the typeahead). 0.2.0 registered only in `session.start`; a
  session that loads the mod later got the band but no commands. 0.2.1 registers
  from `session.start`, `session.attach` and `prompt.submit` (`hooks/commands.ts`,
  engine-free so tests can fake `$.command`). Registering a name again replaces it.
- The validator rejects `$.command` used as a value: spell `$.command.register(...)`
  at its call site (`c => $.command.register(c)` is fine). It also type-compiles
  `tests/*.ts`, so a type error in a test fails `--strict`.
- `hooks/guides.ts` holds hand-distilled prompt-writing notes (2026-11-16). They
  keep only what changes the text of a prompt, not API or harness settings.

## Engine facts for display mods (found 2026-11-21 in the type file, build 2.1.325)

- To-do list: `tool.call` for `TodoWrite` (input is the whole new list) and for
  `TaskCreate` / `TaskUpdate` (incremental; `TaskCreate`'s result holds
  `task.id`). Both tool sets exist; which one a chat uses depends on the app.
  `tool.call` carries `agentId` (absent on the main loop).
- Subagent start: `agent.spawn`; `await next(e)` resolves to `{ model, agentId }`.
  Subagent tokens: `turn.step` with `agentId`, and `usage` on `next(e)`'s result.
  Subagent finish: no plugin event; poll `$.agent.list()` (`status`, entries are
  dropped seconds after ending). Subagents a mod starts itself step past plugin
  hooks.
- Cache Keeper has no price table. Its dollars are `$.session.usage().cost.usd`,
  the engine's session total. The engine gives no per-subagent cost.
- Whether a surface is attached depends on the app, not on cloud vs local:
  `/cache` printed "none attached" in one cloud session and `desktop` in a cloud
  session in the desktop app (2026-11-22), where Brain Dump's band drew. Always
  read `/cache`'s "display surfaces" line before concluding a band cannot draw.

## Decisions

- 2026-11-15: all mods live in this one repo, a marketplace with one folder per
  mod. Not a design flaw; plugins are isolated copies, so shared code is
  duplicated or generated.
- 2026-11-15: memory tier is standard, from `benjamininja/project-memory-template`
  (the owner's brother, a trusted source). Every file must hold real content: the
  template's hygiene hook blocks unfilled placeholders.
- The owner has no root `~/.claude/memory/preferences.md` (confirmed 2026-11-15),
  so `CLAUDE.md` carries the working-style rules itself.
- Types must be self-contained: the validator rejects `import`.
- The nudge and `/handoff` say "start a new chat" first, since `/clear` is not
  in every app.
- 2026-11-22: Brain Dump 0.2.1 (see above). A claude.ai skill named `dump` exists
  in the owner's account and shows in the picker as `anthropic-skills:dump`; the
  mod's `/dump` is a different thing. Rename the mod's command if the two keep
  getting confused (not done).
- Nothing is pushed or merged without the owner's explicit say-so. Stop-hook
  "push" nags are not authorization.
- CI runs the offline tests and the validator. `tsc` stays local (see above).
- Owner works mainly on a Windows machine, and from this cloud environment while
  traveling. Keep project state in the repo and on GitHub, and write scripts a
  travel session needs in Python or Node, not PowerShell.
