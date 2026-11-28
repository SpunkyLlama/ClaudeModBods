# PROJECT-RULES

DRAFT for the owner to review, edit and copy by hand to
`<ETL main checkout>/.claude/memory/PROJECT-RULES.md`. No agent writes this
file in the repo (his setup rule). Drafted 2026-11-24 from the repo's own
`CLAUDE.md`, not from the owner's say-so on each line: every line is a
proposal until the owner accepts it.

This project's own rules for planner, builder manager and builders. The
rules that are the same in every project are in the `session-rules`
skill; this file adds to them and never loosens its "Never" lines.

The owner's GitHub login is `SpunkyLlama`. On an issue or a PR, only text
that login wrote is the record (`session-rules`, "Whose text counts on a
ticket").

## Green means all of

- every CI check passing on one read of
  `gh pr view <n> --json mergeStateStatus,statusCheckRollup`
  (the `pytest` job in `.github/workflows/tests.yml`: Python 3.11, no
  network, no secrets);
- `.venv/Scripts/python.exe -m pytest -q` (a builder may run it, exactly as
  typed: one command, from the worktree's top, no `cd`, no chain). The `.venv`
  is made in each worktree by the `setup` lines in `dispatch.json`. A builder
  never runs `pip install` (`session-rules`): a package the brief needs parks;
- when a column map or alias changes, the tests change in the same PR
  (`CLAUDE.md`, "Testing / Green");
- the privacy guard `tests/test_no_user_paths.py` stays in the suite and
  passes: no hardcoded user path, no real name in any tracked file;
- the code review (`session-rules`, `references/code-review.md`) is **not run**
  in this repo until it has its own ruleset skill, so Green has no review item
  for now (owner's decision, 2026-11-27). A PR that touches a path under
  "Always parks" still waits for the owner. Revisit when the repo has a few
  builder PRs and a bug-fix history to build a ruleset from; do not copy
  another repo's ruleset in its place.

Not covered by Green (do not claim it is): the Selenium scraper, the Supabase
TRUNCATE/INSERT step, the Fantrax standings parser, the date helpers
(`CLAUDE.md`). A PR that changes one of those parks at the owner.

## Never, in this project

- Touch live data: no Supabase write, TRUNCATE or migration, and no run of any
  loader other than its dry run. Live data needs the owner's go-ahead first
  (`CLAUDE.md`, "Live data").
- Start or dispatch a workflow by any route (`gh workflow run`, the API, the
  web page). `etl.yml` truncates and reloads the database; `savant_etl.yml`
  writes to it. The owner presses Run.
- Read a Fantrax page, or widen the Selenium job (no new leagues, no new
  scraping targets, no extra scheduled runs). New Fantrax work uses the
  official API only, for the owner's own leagues, with an identifying
  `User-Agent`, caching and slow polling (`CLAUDE.md`, "Fantrax access").
- Write a password, key, token, the Fantrax `userSecretId`, `.env` content, a
  user's home path, or the owner's real name into any file, issue, PR or
  comment. Secrets are named, never written.
- "Fix" the local-only legacy scripts (`load_local.py`, `load_supabase.py`,
  `direct_transfer.py`, `verify_counts.py`, `diagnose_cols.py`) as a side
  effect of other work.
- Delete a branch other than a merged one the manager is told to delete, and
  never `master` (the owner deletes it, in the web UI).

## Always parks, in this project

Each of these goes to the owner as a Decision or an Action, and the builder
stops there:

- Any PR that touches `.github/workflows/**`, `sql/**`, `fantrax_scraper.py`,
  `fantrax_api.py`, `fantrax_api_load.py`, `load_*.py`, `csv_to_batches.py`,
  `leagues.json`, `requirements*.txt`, `CLAUDE.md` or `.claude/**`. **The
  manager does not merge these; the owner does, one PR at a time.** Merged
  code in these paths runs against live Supabase on the next schedule with
  nobody pressing Run.
- Any database write, and any apply of a `sql/*.sql` file.
- Whether to keep the weekly Selenium job (open owner decision).
- Whether `batches/*.sql` stays tracked.
- Any read of Fantrax or Baseball Savant by an agent session. For Savant, read
  `robots.txt` in a call of its own first (`session-rules`).

## Stages

| Stage | Tier | Tickets, in order | Waits on |
|---|---|---|---|
| A. Close the test gaps | medium | tickets to be written by the planner: scraper (offline, fake driver), standings parser, date helpers | nothing |
| B. Savant null handling | low | check that Decision Engine and Power BI treat a null percentile as "not qualified" (read-only audit; the other repo is out of this stage) | owner confirms scope |

A stage's tier is never lower than its highest ticket.

## Goal texts

    /goal <what is true when stage A is done>. Met when pytest -q passes with
    the new tests and the new tests fail when the code is broken on purpose.
    Or stop after 80 turns.

## Notes per stage

- **A.** The scraper is Selenium: tests must run offline with a fake, never a
  live login. `conftest.py` already runs import-time scripts through `runpy`
  with a fake `pybaseball`; reuse that pattern. A test that cannot fail does not
  count: break the code once and show the failure.
- **B.** Read-only. No Supabase access.
