# Memory Index: ClaudeModBods (project)

> Project-local memory. Cross-project preferences live in root `~/.claude/`.
> Last consolidated: 2026-11-15 (Brain Dump and Cache Keeper 1.2.0 added).

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
- `hooks/guides.ts` holds hand-distilled prompt-writing notes (2026-11-16). They
  keep only what changes the text of a prompt, not API or harness settings.

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
- Nothing is pushed or merged without the owner's explicit say-so. Stop-hook
  "push" nags are not authorization.
- CI runs the offline tests and the validator. `tsc` stays local (see above).
- Owner works mainly on a Windows machine, and from this cloud environment while
  traveling. Keep project state in the repo and on GitHub, and write scripts a
  travel session needs in Python or Node, not PowerShell.
