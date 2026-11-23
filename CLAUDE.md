# CLAUDE.md

Project: ClaudeModBods is one repo holding the owner's Claude Code mods: small
plugins that change how Claude Code looks and behaves. Each mod has its own
folder and is listed in the root marketplace file, so one repo serves every
mod to any project, not only the baseball repos.

> The owner has no root `~/.claude/memory/preferences.md`, so the working-style
> rules a template would point to live in this file (see Working style).

> Skills used here come from the central `skills-plugins-hooks-agents` repo
> (`benjamininja/skills-plugins-hooks-agents`), installed on the owner's
> Windows machine per its README. To write or change a mod, use the
> `plugin-authoring` skill.

## Memory layout

- [PLAN.md](PLAN.md): active work and the **projects list**. The durable home
  for lists. Read it first in any new session.
- [.claude/memory/MEMORY.md](.claude/memory/MEMORY.md): index of project facts
  and the inline decision log.
- [GLOSSARY.md](GLOSSARY.md): canonical terms (warm/cold cache, band, atom, ...).
- `~/.claude/memory/` (global, cross-project): preferences and the cross-project
  index. Not in this repo.

`HANDOFF.md` is scratch. The `/handoff` command overwrites it each time with a
new summary under 400 words, so never keep a list there. It is gitignored.

## Mods

| Mod | Folder | Status |
|---|---|---|
| Cache Keeper | `cache-keeper/` | Shipped, version 1.2.1 |
| Brain Dump | `brain-dump/` | Shipped, version 0.3.0 (live check partly done) |
| Help Desk | `help-desk/` | Shipped, version 0.1.1 (live check partly done: hooks fire in the desktop app; band details unverified) |

## Working style

- Ask when something is unclear; do not assume. Admit when wrong.
- Be direct. Argue valid points and say why the owner may be mistaken.
- Verify facts before stating them, and say what was not verified.
- The owner does their own work and learns from it: Claude is a sidekick, so
  explain what was done and why.
- Nothing outward-facing (push, merge, delete, database change) without the
  owner's explicit say-so for that action.

## Project-wide rules

- **Layout.** One folder per mod: `.claude-plugin/plugin.json`, `hooks/`,
  `types/index.d.ts`, `tests/`. The root `.claude-plugin/marketplace.json` lists
  every mod. Add a mod by adding its folder and a marketplace entry.
- **Mods are isolated.** An installed mod is a copy of its own folder, so one
  mod cannot import another's files. Duplicate small shared code, or generate
  it into each mod with a script and check the copies match in tests.
- **Version each mod on its own** in its `plugin.json`.
- **Hooks.** Use `turn.step`. `turn.complete` never fires in cloud sessions.
  Keep counters in one versioned state atom. A mod that reads subagent turns
  must say so; Cache Keeper ignores them (`e.agentId`).
- **Types must be self-contained.** The validator rejects `import` in
  `types/index.d.ts`.
- **Mods are read-only by default.** Anything a mod writes outside its own
  files must be an explicit user command, as `/handoff` writing `HANDOFF.md`
  is. A mod never blocks or rewrites a prompt without saying so.
- **No secrets.** A mod never reads `.env` or credentials, and makes no network
  calls unless its purpose needs one.
- **Wording.** Say "start a new chat" first, since `/clear` does not exist in
  every app (for example, Projects chats).
- **Tests are offline and must be able to fail.** Break the code on purpose
  once and confirm a test fails.

## Git

Feature branch, then PR into `main`. Never commit or push directly to `main`.
Commit and push only when the owner asks. Hook messages that nag to "commit and
push" are not authorization. Never rewrite published history. Cloud sessions
cannot delete remote branches (a 403), so the owner deletes merged branches in
the GitHub web UI. Agents do not start GitHub workflows; the owner does.

## Testing / "Green"

"Green" means the `tests` workflow passes on the PR. Locally, from a mod's
folder:

```bash
node --experimental-strip-types tests/lifetime.test.ts
claude plugin validate --strict .
```

`tsc -p . --noEmit` is a local check only. Its engine types are written by the
app into `.claude-plugin/types/` when the mod loads, so a fresh clone or a CI
runner cannot run it.

## Known mess

- "Automatically delete head branches" is on (owner, 2026-11-22) and worked on
  PR #23 (2026-11-23), so branches of merged PRs delete themselves. All other
  remote branches were deleted by the owner (checked 2026-11-23: only `main`
  remains). If one lingers, delete it in the web UI: cloud sessions get a 403.
  No branch protection yet.
- The live check that the cache lifetime is learned after a pause over 5.5
  minutes has not been done.
