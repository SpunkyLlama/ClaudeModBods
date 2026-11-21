# PLAN.md

Scratchpad for active and upcoming work, and the **projects list**. Completed
items collapse to one-liners once their durable signal lands in `MEMORY.md` or
`GLOSSARY.md`. This file is tracked in git on purpose: `HANDOFF.md` is
overwritten by every `/handoff`, and lists kept only in chat or in that file
have been lost before.

## Working state (2026-11-21)
- ModBods `main`: Cache Keeper 1.2.0 and Brain Dump 0.2.0 (PRs #5, #6, #8; docs
  PRs #7 and #9). Offline tests and `claude plugin validate --strict` pass; CI
  was green on each PR. Neither mod has been tried in a live chat, and Brain
  Dump's Haiku call (`/rewrite`) has never run. `/cache` in a real session did
  show the cache lifetime learned as 1h from three warm replies (`www`).
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
2. Owner: the live checks (below).
3. Owner: add `FANTRAX_USER_AGENT` and confirm `SUPABASE_PASSWORD` as Actions
   secrets, run `fantrax_api_etl.yml` as a dry run, then decide on the first
   live load. The user agent must identify the program only: no name, email or
   other personal contact (project 10).
4. Owner: branch protection requiring `tests` (ModBods) and `pytest` (ETL),
   auto-delete of merged branches, and deleting the merged branches in the web UI.
5. Then Help Desk 0.1.0 (project 3): its gating questions are answered (see the
   findings there); it needs the owner's go-ahead and a choice on dollars.

## Live checks (owner; Claude cannot run these)
- Cache Keeper `/handoff`: run it here and confirm the `## Projects` section of
  `PLAN.md` lands at the bottom of `HANDOFF.md`.
- Brain Dump 0.1.0: `/dump test`, `/dump`, `/triage`, `/triage discard`; confirm
  the band shows the count and `.claude/memory/BRAIN-DUMP.md` looks right.
- Brain Dump 0.2.0: `/dump the login page breaks`, `/rewrite` (check the block
  under the entry), `/answer only on mobile Safari`, `/rewrite redo` (the answer
  is used and kept), `/rewrite fable-4` (refused by name), then `/triage ticket`
  on the entry (still works, block kept).
- Cache lifetime: send a message, wait more than 5.5 minutes, send another, run
  `/cache`, read the learned evidence.

## Projects (the list; keep it current)

Status words: **doing**, **next**, **gated** (needs a decision or something
else first), **parked**, **done**.

1. **ModBods housekeeping** (done, PR #3 merged 2026-11-15). `CLAUDE.md`,
   memory tier (standard, from `benjamininja/project-memory-template`), CI,
   README fixes. Owner steps still open: branch protection requiring `tests`,
   auto-delete of merged branches, and deleting `chore/housekeeping` and the
   four merged `mod/cache-keeper/*` branches in the web UI. (The full list of
   merged branches is under Known mess in `CLAUDE.md`.)
2. **Brain Dump mod** (done, 0.2.0, PRs #6 and #8 merged; live check pending).
   `/dump <text>` appends a timestamped line to `.claude/memory/BRAIN-DUMP.md`.
   `/dump` alone shows the count and last five. `/triage` marks the oldest
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
3. **Help Desk mod** (next, feasible; waiting on the owner's go-ahead).
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
   - Testing limit: `/cache` in a cloud session reported "display surfaces:
     none attached", so a band or pane cannot draw there. Logic can be tested
     offline; the display needs an app that attaches a surface (the terminal
     CLI), so it adds to the owner's live checks.
   - Smallest first version: a read-only band above the prompt with the to-do
     list (in-progress item highlighted) and the count of running subagents
     with their tokens. The side pane of cards comes later.
   Open: the owner's go-ahead to build 0.1.0, and the option 1 or option 2
   choice on dollars.
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
