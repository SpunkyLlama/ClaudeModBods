# PLAN.md

Scratchpad for active and upcoming work, and the **projects list**. Completed
items collapse to one-liners once their durable signal lands in `MEMORY.md` or
`GLOSSARY.md`. This file is tracked in git on purpose: `HANDOFF.md` is
overwritten by every `/handoff`, and lists kept only in chat or in that file
have been lost before.

## Working state (2026-11-15)
- This branch (`chore/housekeeping`) adds `CLAUDE.md`, `PLAN.md`, `MEMORY.md`,
  `GLOSSARY.md`, `.gitignore`, a `tests` workflow, and fixed README install lines.
- Cache Keeper 1.1.0 is on `main` (PR #2). 42 offline tests pass and
  `claude plugin validate --strict` passes.

## ➡ NEXT
- Owner reviews and merges the housekeeping PR, then sets branch protection
  (require the `tests` check) and turns on auto-delete of merged branches.
- Then Brain Dump (project 2 below).

## Projects (the list; keep it current)

Status words: **doing**, **next**, **gated** (needs a decision or something
else first), **parked**, **done**.

1. **ModBods housekeeping** (done, PR #3 merged 2026-11-15). `CLAUDE.md`,
   memory tier (standard, from `benjamininja/project-memory-template`), CI,
   README fixes. Owner steps still open: branch protection requiring `tests`,
   auto-delete of merged branches, and deleting `chore/housekeeping` and the
   four merged `mod/cache-keeper/*` branches in the web UI.
2. **Brain Dump mod** (next). `/dump <text>` appends a timestamped line to
   `.claude/memory/BRAIN-DUMP.md`. `/dump` alone shows the count and last five.
   `/triage` goes entry by entry: ticket, memory note, or discard. Anything
   that creates a GitHub issue is outward-facing, so it confirms each one. A
   band shows the unsorted count. Open: where the file lives for non-repo use.
3. **Help Desk mod** (gated). Modeled on the "Helper Desk" in Stephen Smith's
   article (October 2026): Claude's to-do list above the prompt with in-progress
   items flashing, plus a side pane with a live card per subagent showing what
   it is doing, its tokens and its cost. Build our own; do not copy the Ben AI
   pack. Gated on: which events expose the to-do list and the subagent
   start and finish (check the `plugin-authoring` skill), and how to share
   Cache Keeper's price table across mods (they cannot import each other).
   Read-only: it displays, it never blocks or rewrites.
4. **Project Planner and Manager** (gated, owner decision). Adopt
   benjamininja's planner / builder-manager / owner-queue setup on the owner's
   Windows machine (his handoff doc: `docs/handoff/baseball-session-dispatch.md`).
   Do not rebuild it. Later, optionally, a thin read-only mod showing open items
   from `MEMORY.md`, GitHub issue and PR state, and the queue file.
5. **Cache Keeper upkeep** (next, small).
   - Live check that the cache lifetime is learned: send a message, wait more
     than 5.5 minutes, send another, run `/cache`, read the learned evidence.
   - Make `/handoff` keep a pinned projects list. Today it overwrites
     `HANDOFF.md` with a fresh summary under 400 words, which is how lists
     vanished. Idea: have it append this file's "Projects" section verbatim.
   - The in-chat status line is untested and off by default.
6. **Fantrax** (gated, owner decision). Fantrax's Terms ban automated scraping
   and non-published access, so the weekly Selenium job probably conflicts.
   Decide what to do with that job. Ask Fantrax in writing about the stat
   tables and transaction history the API does not document. Build any new
   league work on the official API only. The owner already updated the
   `fantrax-etl` skill.
7. **hod-decision-engine** (gated, owner decision). Add owner sign-in to replace
   anonymous writes on `contract_decisions`, `team_cap_settings` and `teams`
   (the owner does not trust public access). Upgrade SheetJS from 0.18.5
   (versions before 0.19.3 have a known prototype-pollution issue; verify).
   First Green, memory tier, and `main` versus `pybaseball`. Done 2026-11-15:
   dropped `anon_insert_dp` and `anon_update_dp` on `draft_picks`. To undo:
   `create policy anon_insert_dp on public.draft_picks for insert to anon with check (true);`
   and `create policy anon_update_dp on public.draft_picks for update to anon using (true) with check (true);`.
   `anon_insert_cap_settings` looks unused (the app only patches
   `team_cap_settings`); not dropped, ask first.
8. **fantasy-baseball-etl upkeep** (next, owner steps). Delete `master` and 12
   merged remote branches in the web UI. Branch protection requiring `pytest`.
   Auto-delete of merged branches. Decide on `batches/` (35 league-data SQL
   files tracked in a public repo). Decide on Pages. Check that Decision Engine
   and Power BI treat a null Savant percentile as "not qualified", not zero.
   Verify the old database credentials were rotated (the owner says handled;
   not verified). Write a code-review ruleset. Test gaps: scraper, Supabase
   load step, standings parser, date helpers.
9. **benjamininja setup on the Windows machine** (gated, owner). His
   `setup-project-memory` skill, owner-queue mod, session-dispatch plugin,
   `PROJECT-RULES.md`. Install from a live clone of merged `main`, never a copy.
   Agents never start workflows; the owner presses Run.
10. **Name privacy** (next, owner decision). The owner does not want their real
    name public. The public repos expose it in a few tracked files and in some
    commit metadata. Fix going forward: no hardcoded user paths (read them from
    environment variables), neutral author and licence fields, and a noreply
    git email. Old commits keep their metadata unless history is rewritten,
    which is outward-facing and needs the owner's explicit say-so; the GitHub
    handle and display name stay public either way. The owner is creating a
    safe local project folder. The specifics are in the owner's private handoff,
    not in this public file.

## [ ] Deferred
- [ ] Shared code between mods: decide duplicate versus generate.
- [ ] Marketplace owner field: check it is the name the owner wants public.
- [ ] A `docs/` folder and ADRs, once decisions need alternatives written down.

## Shipped
- 2026-11-15: ModBods housekeeping, PR #3: standard memory tier, CI (tests and
  validator both green), README fixes.
- 2026-11-15: dropped anonymous write policies on `draft_picks` (project 7).
- 2026-11-14: Cache Keeper PR #2 merged: lifetime learning, subagent filter,
  validator fix, tests.
