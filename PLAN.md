# PLAN.md

Scratchpad for active and upcoming work, and the **projects list**. Completed
items collapse to one-liners once their durable signal lands in `MEMORY.md` or
`GLOSSARY.md`. This file is tracked in git on purpose: `HANDOFF.md` is
overwritten by every `/handoff`, and lists kept only in chat or in that file
have been lost before.

## Working state (2026-11-22)
- ModBods `main`: Cache Keeper 1.2.0, Brain Dump 0.3.0 and Help Desk 0.1.1 (PRs
  #5, #6, #8, #12, #14, #16, #17; docs PRs #7, #9, #11, #13, #15). Offline tests and
  `claude plugin validate --strict` pass for all three; CI was green on each PR.
  Live so far (owner, desktop app, 2026-11-22): Brain Dump `/triage`, `/triage ticket`
  and `/rewrite` (Haiku wrote a prompt) ran; `/answer`, `/rewrite redo` on a fresh
  entry and `/rewrite fable-4` are not checked; 0.3.0 (`/braindump`) is not yet
  checked. Help Desk's band has never been seen. `/cache` showed the cache lifetime
  learned as 1h from warm replies (`www`).
- First live findings (2026-11-22, desktop app, cloud sessions):
  - A cloud session in the desktop app does attach a display surface (`/cache`
    printed `display surfaces: desktop`) and Brain Dump's band drew. The earlier
    "cloud sessions cannot draw" notes were wrong for that app.
  - In two sessions the band drew but `/triage`, `/answer` and `/rewrite` were "not
    a command here". Commands are registered per session, and 0.2.0 registered
    them only in `session.start`. 0.2.1 registers from `session.start`,
    `session.attach` and `prompt.submit` until all four are in, one at a time, and
    toasts the reason if one is refused. After 0.2.1 `/triage` and `/rewrite` ran,
    so it helped; whether late loading was the whole cause is not proven.
    `/cache` ran in the same sessions, so Cache Keeper's commands registered.
  - `/dump` had a different cause, shown by 0.2.1's toast: "could not register
    /dump (refused: it is the user's /anthropic-skills:dump)". The engine refuses a
    mod command whose name a user skill holds (a claude.ai skill named `dump`
    exists), so `/dump` ran the skill. 0.3.0 renames the command to `/braindump`
    (PR #17, merged); the live check is pending.
  - Help Desk 0.1.1 installed (its plugin page shows 0.1.1, "Added") but no row
    was seen in a new chat, and it is not listed in `/config`. The page has no
    enabled/disabled indicator, and whether `/config` lists any plugin's settings
    was not checked (Cache Keeper's and Brain Dump's were not looked for). An
    offline run of its own functions on the events a TaskCreate, TaskUpdate and
    subagent spawn raise produced rows, so the problem is not in that logic; it is
    in loading, hook wiring or drawing. 0.1.1 adds a debug row to find out which.
  - The build container held two Cache Keepers at once (an inline dev copy,
    1.1.0, and the marketplace copy, 1.2.0). The cold status line said "then
    /clear", wording only 1.1.0 has, and read "resumed, Σ 0" while `/cache`
    said warm with 7 turns. Likely two copies with separate state; not proven.
- ETL `main`: the Fantrax official-API client, loader and RLS draft merged
  (PRs #15, #16, #17; reviewed 2026-11-21, see project 6). Tests: 71 passed
  before the privacy PR, 73 after it.
- Name privacy (project 10): the going-forward fixes are merged (ModBods #10,
  ETL #18, both checked on GitHub 2026-11-21). `main` in both repos has no
  tracked account name or user path, and the ETL guard test keeps it that way.
  ETL `main` passes 73 tests. Old commits are unchanged.

## ➡ NEXT (in order)
1. Owner: set `FANTRAX_SOURCES_DIR` and `FANTRAX_BATCHES_DIR` on the Windows
   machine to the old folders. The old defaults are gone from `main`, so local
   runs need them (Actions already sets both).
2. Owner: the live checks (below), now including Help Desk.
3. Owner: add `FANTRAX_USER_AGENT` and confirm `SUPABASE_PASSWORD` as Actions
   secrets, run `fantrax_api_etl.yml` as a dry run, then decide on the first
   live load. The user agent must identify the program only: no name, email or
   other personal contact (project 10).
4. Owner: branch protection requiring `tests` (ModBods) and `pytest` (ETL),
   auto-delete of merged branches, and deleting the merged branches in the web UI.
5. Then Help Desk follow-ups (project 3), once its live check says what is wrong
   or missing: flashing, the side pane, per-card dollars.

## Live checks (owner; Claude cannot run these)
- Cache Keeper `/handoff`: run it here and confirm the `## Projects` section of
  `PLAN.md` lands at the bottom of `HANDOFF.md`.
- Brain Dump 0.3.0 (the command is `/braindump`, not `/dump`; start a new chat after
  updating). Done on 0.2.1: `/triage`, `/triage ticket`, `/rewrite`. Still to do:
  `/braindump test` (no "could not register" toast); `/braindump <a new entry>`,
  `/rewrite` (check the block under the entry), `/answer only on mobile Safari`,
  `/rewrite redo` (run it before triaging: it only takes unsorted entries, so after
  `/triage` it says "Nothing to rewrite"), `/rewrite fable-4` (refused by name),
  then `/triage ticket` on the entry (block kept). Note: an entry phrased like an
  instruction to Claude is read by Haiku as the task (seen 2026-11-22); that is
  the entry's wording, not a bug.
- Cache lifetime: send a message, wait more than 5.5 minutes, send another, run
  `/cache`, read the learned evidence.
- Cache Keeper cold-send guard (reviewed 2026-11-22): after a pause longer than
  the learned lifetime, with context at or above `coldGuardMinPercent`, send a
  multi-line prompt. It should be held once with a note. Record whether the text
  stays in the prompt box, comes back with Up-arrow, or is lost (the engine docs
  do not say). Known gaps: a resumed chat never triggers the guard, and no
  offline test covers it.
- Before reading any Cache Keeper result, list the plugins and make sure only one
  Cache Keeper is loaded (see the two-copies finding above).
- Help Desk 0.1.1: open its plugin page, Settings tab, switch on "Debug row"
  (the tab exists on plugin pages; its contents for Help Desk are not seen), start a
  new chat and send "hi": a row "Help Desk loaded · to-dos 0 · agents 0 · hooks
  seen: …" should draw. No row: not loaded or no surface. Row draws, counters stay
  0 after a to-do list or a subagent: the app is not calling the hooks. Counters
  rise, normal row empty: the mod drops the events. Then (needs an app that
  attaches a display surface, such as the terminal CLI or the desktop app): install
  it, ask Claude for a multi-step task, and watch the row for the to-do item in
  progress and its count; then ask for a task that starts a subagent, and watch
  the "running" count, its tokens, and "done" when it ends. If the row never
  appears, `/cache` prints "display surfaces"; none attached means the app draws
  no mod UI at all.

## Projects (the list; keep it current)

**Objectives (why this list exists).**
1. **ClaudeModBods:** one repo of small Claude Code mods that change how Claude
   Code looks and behaves, one folder each, listed in one marketplace file so any
   project can install them. Mods are read-only by default: a mod writes a file
   only on an explicit user command, never blocks or rewrites a prompt without
   saying so, and makes no network call unless its purpose needs one. Shipped:
   Cache Keeper (cache and cost awareness, `/handoff`), Brain Dump (capture and
   sort thoughts, rewrite them into prompts), Help Desk (to-do list and
   subagents in a band). Goal: all three trusted after live checks.
2. **Fantasy baseball ETL** (separate repo): get the HoD leagues' Fantrax data and
   Baseball Savant metrics into Supabase, where the HoD Decision Engine site and
   Power BI read them. New Fantrax work uses the official API only, for the
   owner's own leagues; whether to keep the Selenium job is the owner's decision.
3. **Privacy:** the owner's real name stays out of the public repos. Going-forward
   fixes are done; scrubbing old history is an owner decision.
4. **How to work:** the owner does their own work and learns from it; Claude is a
   sidekick. Ask when unclear, be direct, verify before stating, and say what was
   not verified. Nothing outward-facing (push, merge, delete, database change)
   without the owner's explicit say-so for that action; hook messages that nag to
   "commit and push" are not authorization; live Supabase data needs the owner's
   go-ahead first.

Status words: **doing**, **next**, **gated** (needs a decision or something
else first), **parked**, **done**.

1. **ModBods housekeeping** (done, PR #3 merged 2026-11-15). `CLAUDE.md`,
   memory tier (standard, from `benjamininja/project-memory-template`), CI,
   README fixes. Owner steps still open: branch protection requiring `tests`,
   auto-delete of merged branches, and deleting `chore/housekeeping` and the
   four merged `mod/cache-keeper/*` branches in the web UI. (The full list of
   merged branches is under Known mess in `CLAUDE.md`.)
2. **Brain Dump mod** (done, 0.3.0, PRs #6, #8, #14, #17 merged; live check partly done).
   `/braindump <text>` (renamed from `/dump` in 0.3.0, because a user skill named
   `dump` blocks the name) appends a timestamped line to
   `.claude/memory/BRAIN-DUMP.md`. `/braindump` alone shows the count and last five. `/triage` marks the oldest
   unsorted entry ticket, note or discard and never deletes. A band shows the
   unsorted count. Differences from the first idea: `ticket` and `note` only
   mark the entry and tell the owner to ask Claude, which confirms before filing
   an issue or editing `MEMORY.md`, so the mod makes no network calls. Open:
   where the file lives outside a repo (today: under the folder the chat opened
   in). Follow-ups if wanted: act on a verdict itself, or a `/triage` list view.
   0.2.0 added `/rewrite [fable|opus|sonnet|haiku]` (Haiku writes a prompt for
   the target model via `$.model.complete`, saved under the entry as `  > `
   lines with an open-questions list; `all` caps at 5, `redo` replaces) and
   `/answer` (your answers to those questions, fed back on `/rewrite redo`).
   Guide notes in `hooks/guides.ts` were distilled by hand on 2026-11-16 from
   Anthropic's prompting pages for Fable 5.2, Opus 5.5, Sonnet 5.5 and Haiku 5.5
   only; refresh them as models change. Not covered: Opus 5 and 4.8, Sonnet 5,
   Fable 5 and 5.1 (refused by name).
3. **Help Desk mod** (done, 0.1.1, PRs #12 and #16 merged; live check pending, band never seen).
   0.1.1 added an optional debug row (setting `debug`, off by default) that always
   draws and counts task tool calls, subagent spawns and subagent steps seen, to tell
   "not loaded" from "hooks never fire" from "events dropped". Known gap: a
   `TaskUpdate` for a task created before the mod loaded is ignored.
   Built 2026-11-22 from the findings below with option 1 for dollars (tokens
   processed per subagent, no per-card dollars; Cache Keeper still shows the
   session total). A read-only band above the prompt: the to-do list (both tool
   families, main chat only) and the running subagents with tokens. Start from
   `agent.spawn`, tokens from `turn.step` (it reads subagent turns), the end by
   polling `$.agent.list()` every 1.5s with a 15s grace for an agent never
   listed. Observer hooks fail open. 43 offline tests. Not in 0.1.0: flashing
   in-progress items and the side pane of cards. Unverified: the band has never
   seen drawing (the desktop app does attach a surface, so this can now be
   checked there); `TaskCreate`'s result carrying
   `task.id` as the types say; how fast the poll catches a short-lived subagent.
   Modeled on the "Helper Desk" in Stephen Smith's article (October 2026):
   Claude's to-do list above the prompt with in-progress items flashing, plus a
   side pane with a live card per subagent showing what it is doing, its tokens
   and its cost. Build our own; do not copy the Ben AI pack. Read-only: it
   displays, it never blocks or rewrites.
   Findings 2026-11-21, from the engine's type file for build 2.1.325 and
   Cache Keeper's source (no code written, nothing run):
   - To-do list: `tool.call` for `TodoWrite` (todos with pending, in_progress or
     completed, plus `activeForm`) and for `TaskCreate` / `TaskUpdate` (the
     newer incremental tools; status also `deleted`, with blocking links). This
     build has both, and which one a chat uses depends on the app, so the mod
     must handle both. `tool.call` carries `agentId`, so a subagent's list is
     told apart from the main one. Not read: the result shapes of `Task*`.
   - Subagent start: `agent.spawn` (description, subagentType, model,
     background, parentAgentId); `next(e)` unchanged resolves to `{ model,
     agentId }`.
   - Subagent tokens: `turn.step` carries `agentId` on a subagent's loop, and
     awaiting `next(e)` gives `usage` (four token counts and the model id) per
     request. Cache Keeper already filters these out with `e.agentId`.
   - Subagent finish: no plugin event found. `$.agent.list()` gives each agent's
     `status` (running, idle, completed, failed, killed) and drops entries
     seconds after they end, so the mod must poll (`$.clock.every`).
     `turn.complete` carries `agentId` but CLAUDE.md says it never fires in
     cloud sessions (not tested here). Classic SubagentStop is a settings hook;
     whether a plugin can subscribe to it is unchecked.
   - Blind spot: subagents a mod starts itself with `$.agent.spawn` step past
     plugin hooks. Subagents the model starts with the Agent tool are visible.
   - The old gating question about sharing "Cache Keeper's price table" rested
     on a wrong premise: Cache Keeper has no price table. It reads the session
     total from `$.session.usage().cost.usd`. The engine gives no per-subagent
     cost, so either show tokens per card plus the engine's session dollars
     (recommended for 0.1.0: no table to maintain, nothing that can be wrong
     about prices), or keep a small price table inside Help Desk alone to
     estimate dollars per card. No cross-mod sharing is needed either way.
   - Testing limit: in the session that wrote this, `/cache` reported "display
     surfaces: none attached", so a band or pane could not draw there. Corrected
     2026-11-22: a cloud session in the desktop app does attach one (`desktop`).
     Logic can be tested offline; the display needs an app that attaches a
     surface, so it adds to the owner's live checks.
   - Smallest first version: a read-only band above the prompt with the to-do
     list (in-progress item highlighted) and the count of running subagents
     with their tokens. The side pane of cards comes later.
   Open after 0.1.0: the live check, then flashing, the side pane, and whether
   per-card dollars are worth a price table kept inside Help Desk alone.
4. **Project Planner and Manager** (gated, owner decision). Adopt
   benjamininja's planner / builder-manager / owner-queue setup on the owner's
   Windows machine (his handoff doc: `docs/handoff/baseball-session-dispatch.md`).
   Do not rebuild it. Later, optionally, a thin read-only mod showing open items
   from `MEMORY.md`, GitHub issue and PR state, and the queue file.
5. **Cache Keeper upkeep** (next, owner steps left).
   - Live check that the cache lifetime is learned (see Live checks above).
   - Done, 1.2.0, PR #5: `/handoff` appends one section of a file verbatim
     (`pinnedFile` default `PLAN.md`, `pinnedHeading` default `## Projects`) so
     a list survives the under-400-word summary. Not yet seen in a live chat.
   - The in-chat status line is untested and off by default.
6. **Fantrax** (gated, owner decision). Fantrax's Terms ban automated scraping
   and non-published access, so the weekly Selenium job probably conflicts.
   Decide what to do with that job. Ask Fantrax in writing about the stat
   tables and transaction history the API does not document. Build any new
   league work on the official API only. The owner already updated the
   `fantrax-etl` skill.
   Progress, merged to ETL `main` 2026-11-16 to 2026-11-21 (PRs #15 to #17;
   reviewed 2026-11-21 against the rules above): `fantrax_api.py` uses only
   documented endpoints, requires an identifying `FANTRAX_USER_AGENT`, waits at
   least 1s between calls, retries with backoff, caches, and never touches
   `userSecretId`. `fantrax_api_load.py` is a dry run by default; a live load
   replaces one league per transaction, never truncates, and refuses empty,
   duplicate or orphaned data. The workflow is manual only, `dry_run` defaults
   to true, no schedule. Schema `fantrax_api.*` applied 2026-11-16 (7 tables,
   RLS on, no policies, empty). The Selenium job is untouched and still owns
   the stat tables and transactions.
   Still open: secrets, an Actions dry run, owner go-ahead for the first live
   load (the schema's loader path is only tested with a fake cursor), a read
   path for the Decision Engine and Power BI (nothing can read the new tables
   yet), and the keep-or-remove decision on the Selenium job. Confirm the owner
   is a member of the basketball league `p5pgetzsmqlu7ool` (it was added to
   `leagues.json`; I could not verify membership). The NFL league is correctly
   not added until membership is confirmed.
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
   Done 2026-11-16 (ETL PR #17): RLS on for 18 `fantrax` tables and 8 direct
   anon SELECT grants revoked; checked as `anon` that the public views and
   `public.contract_decisions` / `public.teams` still return rows. NOT checked:
   `index.html` in a browser, a Power BI refresh, the next `etl.yml` or Savant
   run. Still open, from that file's own notes: `anon` can still write through
   policies on `public.teams`, `public.team_cap_settings`,
   `public.contract_decisions` and `fantrax.owner_profiles`; dropping them breaks
   signed-out writes unless the site is tested signed in first.
8. **fantasy-baseball-etl upkeep** (next, owner steps). Delete `master` and the
   merged remote branches in the web UI (about 18 as of 2026-11-21, including the
   three Fantrax-API branches; `git ls-remote --heads origin` shows them). Branch protection requiring `pytest`.
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
10. **Name privacy** (going-forward fixes done; history decision open). The owner does not want their real
    name public. The public repos expose it in a few tracked files and in some
    commit metadata. Fix going forward: no hardcoded user paths (read them from
    environment variables), neutral author and licence fields, and a noreply
    git email. Old commits keep their metadata unless history is rewritten,
    which is outward-facing and needs the owner's explicit say-so; the GitHub
    handle and display name stay public either way. The owner is creating a
    safe local project folder. The specifics are in the owner's private handoff,
    not in this public file.
    Going-forward fixes done 2026-11-21, merged and checked on GitHub:
    ModBods #10 (public handle in the marketplace owner, plugin author and
    licence fields; licence reads "and ClaudeModBods contributors") and ETL #18
    (six hardcoded user paths replaced by env vars, `csv_downloads/` gitignored,
    a guard test that fails if one returns). Still open, all owner decisions or
    steps: set `FANTRAX_SOURCES_DIR` and `FANTRAX_BATCHES_DIR` on the Windows
    machine; set the git email to the noreply address on the owner's own
    machine; keep personal contact out of the
    `FANTRAX_USER_AGENT` secret; whether to rewrite history to scrub the old
    commits (a force-push of `main`, never done without explicit say-so). Known
    and accepted: league ids in `leagues.json` and the Supabase project ref and
    pooler host in `fantrax_api_load.py` are public in the repo (identifiers, not
    secrets). The AI-authorship point on the licence line has not been checked
    with a lawyer.

## [ ] Deferred
- [ ] Shared code between mods: decide duplicate versus generate.
- [ ] Marketplace owner field: check it is the name the owner wants public.
- [ ] A `docs/` folder and ADRs, once decisions need alternatives written down.

## Shipped
- 2026-11-22: Brain Dump 0.3.0, PR #17: `/dump` renamed `/braindump` (the engine
  refuses a name a user skill holds); tests changed first and failed on the old name.
- 2026-11-22: Help Desk 0.1.1, PR #16: optional debug row with hook counters; 19 new
  offline tests (62 in all).
- 2026-11-22: Brain Dump 0.2.1: commands register from `session.start`,
  `session.attach` and `prompt.submit` until all four are in, one at a time, with a
  toast naming any that is refused; 24 new offline tests (94 in all for the mod).
- 2026-11-22: Help Desk 0.1.0, PR #12: to-do list and subagent tokens in a band,
  43 offline tests.
- 2026-11-21: name privacy, going-forward fixes: ModBods PR #10 (author, owner
  and licence fields use the public handle) and ETL PR #18 (no hardcoded user
  paths, env vars, guard test).
- 2026-11-16 to 2026-11-21 (ETL, not ModBods): Fantrax API client, loader and
  workflow (PRs #15, #16), RLS on 18 `fantrax` tables (PR #17), `fantrax_api`
  schema applied. Reviewed, nothing run live except read-only API pulls.
- 2026-11-16: Brain Dump 0.2.0, PR #8: `/rewrite` and `/answer`, 70 offline
  tests in all.
- 2026-11-15: Brain Dump 0.1.0, PR #6: `/dump`, `/triage`, unsorted-count band,
  16 offline tests.
- 2026-11-15: Cache Keeper 1.2.0, PR #5: `/handoff` appends the pinned list, 11
  new offline tests.
- 2026-11-15: ModBods housekeeping, PR #3: standard memory tier, CI (tests and
  validator both green), README fixes.
- 2026-11-15: dropped anonymous write policies on `draft_picks` (project 7).
- 2026-11-14: Cache Keeper PR #2 merged: lifetime learning, subagent filter,
  validator fix, tests.
