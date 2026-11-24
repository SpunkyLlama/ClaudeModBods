# Task 3 rollout: ETL repo first (DRAFT, revised 2026-11-24 after reading the rest of his repo)

Drafts for the owner, from benjamininja's `skills-plugins-hooks-agents` at
`aefbc68` and his `docs/handoff/baseball-session-dispatch.md`. Nothing here is
installed and nothing was written to either repo. His own rule: these files
are owner-written, so they are text to review and copy by hand.

Owner's choices (2026-11-24): full setup, ETL repo first; the manager merges
when the owner invokes the dispatch skill. Python is Anaconda (Spyder).

## Files in this folder

| File | Goes to (by hand) | Notes |
|---|---|---|
| `PROJECT-RULES.md` | `<ETL checkout>/.claude/memory/` | Green, Never, Always parks, stages. Every line is a proposal. |
| `NEEDS-OWNER.md` | `<ETL checkout>/.claude/memory/` | Seven seeded entries: 4 decisions, 3 actions. |
| `builders.settings.json` | `<ETL checkout>/.claude/` | His example, plus a `.venv` pytest rule, plus deny-edit on the live-data paths. |
| `managers.settings.json` | `<ETL checkout>/.claude/` | His example, plus the same path denies. |
| `dispatch.json` | `<ETL checkout>/.claude/` | Builds a `.venv` per worktree. No absolute paths or user names, so it can be committed. |
| `CLAUDE-md-merge-rule.md` | proposal only | Wording for the delegated-merge rule. Not applied. |

Not drafted: the four agent files (copy from the plugin's `templates/agents/`),
`PLANNER.md`, `MANAGER.md` (blank state templates), `dispatch-projects.json`
(holds the Windows path, so it lives in the user profile, never in a repo), and
the ETL's own code-review ruleset (see "Gaps" below).

## What reading the rest of his repo changed

1. **Python (your Anaconda answer).** Builders run Python only "through the
   project's interpreter", never `-c`, never `pip install`, one command per call,
   no `cd` or variable prefix. So conda activation cannot be part of a builder's
   command. Resolution, copied from his own ADR-0013 pattern: `dispatch.json`'s
   `setup` lines make a project-local `.venv` in each worktree, and the builders'
   rule is the relative `Bash(.venv/Scripts/python.exe -m pytest -q)`. No user
   name is in any committed file. It needs `python` (3.11, as CI uses) on `PATH`
   where dispatch runs, so start the manager session from an **Anaconda
   PowerShell Prompt** with a Python 3.11 environment active. `.gitignore` needs
   `.venv/` and `builder-state/`.
2. **The merge rule is per dispatched ticket, not per session.** His
   `session-dispatch` skill says "A builder's PR for a dispatched ticket needs no
   further word from the owner." Your word is "dispatch this ticket now". A
   manager's own PRs and the planner's always need your approval of that PR.
3. **Settings can fence edits, not merges.** `Edit(path)` denies work (his ADR
   found `Write(path)` matches nothing, so the drafts use `Edit` only). Nothing in
   settings stops the manager running `gh pr merge` on a PR that touches
   `sql/**` or the workflows. "The owner merges those" is a written rule.
4. **Every session posts as you.** All sessions act through your GitHub login.
   His only defence against an outsider's issue text is a rule that only your
   login's text counts. Our repos are public, so that rule matters; it is in the
   plugin, not enforced by GitHub.
5. **`relink_live.ps1` links everything, and updates are live.** His doc says
   "link the skills you want"; the script links *every* skill and hook in his
   repo and repoints your whole `~/.claude/agents` folder, for all projects, not
   just the baseball repos. With a live clone, a `git pull` changes the code
   that runs in all your sessions. See "Trust" below.
6. **The code review needs a ruleset the ETL repo lacks.** Each repo has its own
   ruleset skill, read from `origin/main`. His is `tools-code-review`.
7. **Role-session style differs from this chat.** Planner, manager and builders
   never say "you" or "I", and they ask you questions through buttons or queue
   entries. The drafts follow that.

## What I checked in his code (read, not run)

- `owner-queue` mod (0.11.0): no network calls, no model calls, no subagents. It
  runs `git rev-parse` to find the main checkout, opens a draft file in your
  default editor by the system's own opener, and writes only to queue files
  you list in `queues`, to its own `drafts/` folder and to its store.
- `dispatch.ps1`: runs only `git`, `claude` and your `setup` lines. No network
  call. The permission mode is hard-coded `dontAsk`. A dry run changes nothing;
  `-Apply` works only in a project listed in your user-profile file.
- `relink_live.ps1`: dry run by default; never deletes a real directory (skips
  it, or moves it to `-BackupDir`); removes only links, never contents.

Not run: any of it. I cannot run Windows PowerShell here.

## Trust (decision for the owner)

You would run a third party's code in every Claude Code session you open.
Options, none done: (a) follow `main` as his doc says (updates arrive on each
pull); (b) pin the live clone to a commit you have read, and update only after
reading the diff; (c) install only the two plugin folders through
`CLAUDE_CODE_PLUGIN_DIRS` and skip `relink_live.ps1` until you want a skill.
I would pick (c) first, then (b). It is your call; his doc recommends (a).

## Order (his steps, with where each repo stands)

1. **Step 0, credentials** (yours): verify the old database password was rotated.
2. **Memory tier**: done for ETL and ModBods; `hod-decision-engine` unchecked.
3. **Git hygiene** (yours): branch protection requiring `pytest`; delete `master`
   and merged branches in the web UI; auto-delete of head branches.
4. **Green**: exists (73 tests, green on `a80630d`); written into the draft.
5. **ETL PR for me to open (on your word):** `.gitignore` gets `.venv/`,
   and `builder-state/`.
6. **Dispatch files** (yours, by hand): the five files above and the four agent
   files; `dispatch-projects.json` in the user profile.
7. **Queue**: `NEEDS-OWNER.md` in the main checkout; `Session:` lines from
   `/owner id`.
8. **Install** (yours): live clone, `CLAUDE_CODE_PLUGIN_DIRS`, the trust choice
   above, a new session after every pull.
9. **First dispatch**: one low-tier, read-only or tests-only ticket, with a dry
   run read line by line first. Not a stage.

## Gaps and risks

- **Merged code goes live on a schedule.** `savant_etl.yml` (daily) and `etl.yml`
  (weekly) run from `main`. A merged builder PR touching a loader, workflow or
  SQL file runs against live Supabase with nobody pressing Run. Queue decision 3.
- **Untested end to end.** His ADR says a real `-Apply` start and path-scoped
  `--disallowedTools` were "not yet proven" when written; a later amendment shows
  a throwaway-session test for profiles. I have not seen the production repo.
- **Builders push and open PRs without asking each time** (`dontAsk` under deny
  rules). That differs from "commit and push only when asked".
- **A manager can delete remote branches** on the Windows machine. Your cloud
  sessions get a 403; that is a cloud limit, not a rule.
- **Not read:** `project-memory-template` (already adopted in both repos),
  the owner-queue README beyond its start, the tests for either plugin.
- **His doc is dated 2026-11-08.** Where it and a plugin README disagree, he says
  the README wins.
