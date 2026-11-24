# NEEDS-OWNER

DRAFT for the owner to review and copy by hand to
`<ETL main checkout>/.claude/memory/NEEDS-OWNER.md`. Entries are seeded from
the ETL `CLAUDE.md` and ClaudeModBods `PLAN.md` as of 2026-11-24. No `Session:`
lines: the owner adds one from `/owner id` where an answer should go back to a
session.

What waits on the owner, in one place. The `owner-queue` pane reads the
main checkout's copy of this file and no other.

(Format notes are in the plugin's `templates/NEEDS-OWNER.md`; this draft
follows them: two sections, `### [ ] Title`, `- Label: value` fields.)

## Decisions

### [ ] Keep the weekly Selenium job?
- Ticket: none yet
- Context: Fantrax's Terms ban automated scraping and access other than through its published interfaces (8.6(g), 8.6(c), 8.7). The weekly job probably conflicts; the risk is to the owner's Fantrax account and league roles. The official API cannot yet replace it: the hitter and pitcher stat tables and transaction history are not documented there.
- Options: (a) keep the job as it is for now and ask Fantrax in writing about the stat tables and transactions; (b) stop the weekly job now and live without those tables until the API covers them; (c) keep it only until the written answer arrives, then decide
- Recommended: (c), because it keeps the stat tables flowing while the question to Fantrax is open, and gives a date to decide by
- Blocks: the multi-league work, which uses the API only
- Raised: 2026-11-24 by Claude (planner)

### [ ] Keep `batches/*.sql` tracked in git?
- Ticket: none yet
- Context: 35 league-data SQL files are tracked in a public repo. `skip_scrape` reuses them. They are generated output.
- Options: (a) keep them tracked, and decide separately whether the repo stays public; (b) stop tracking them and keep them as workflow artifacts, which means changing `skip_scrape`; (c) keep them tracked but move the repo to private
- Recommended: (b), because the files are generated and public league data adds nothing to review
- Blocks: the choice whether the repo stays public
- Raised: 2026-11-24 by Claude (planner)

### [ ] Who may merge a builder's PR in this repo?
- Ticket: none yet
- Context: The owner chose that the manager merges when the owner invokes the dispatch skill. Merged code runs against live Supabase on the next schedule (Savant daily, Fantrax weekly) without anyone pressing Run.
- Options: (a) the manager merges every green PR in a dispatch session, except PRs that touch the paths listed under "Always parks" in PROJECT-RULES.md, which the owner merges one at a time; (b) the manager merges every green PR in a dispatch session, with no exceptions; (c) the owner merges every PR
- Recommended: (a), because it gives builders the speed the owner asked for on tests and docs while keeping the code that touches the live database behind a person
- Blocks: the manager's settings file and PROJECT-RULES.md
- Raised: 2026-11-24 by Claude (planner)

### [ ] One planner across both baseball repos, or one each?
- Ticket: none yet
- Context: `hod-decision-engine` is a second repo that reads the same Supabase tables. A shared planner and one shared queue are what the plugin's handoff doc recommends.
- Options: (a) one planner for both repos, with one queue in the ETL repo that sessions in both repos read through the `queues` setting; (b) one planner and one queue per repo
- Recommended: (a), because the Decision Engine's work depends on the ETL's tables
- Blocks: the `queues` setting and the second repo's setup
- Raised: 2026-11-24 by Claude (planner)

## Actions

### [ ] Branch protection on the ETL repo and ClaudeModBods
- Ticket: none yet
- Steps:
  1. In GitHub, open each repo's Settings, then Rules, then add a branch ruleset for `main`
  2. Require a pull request before merging, and require the status check `pytest` (ETL) or `tests` (ClaudeModBods)
  3. Do not tick "Allow bypassing", so the rule applies to the owner too, unless you want to keep a bypass
- Context: neither repo has protection today. Builders push branches and open PRs; protection is what makes the required check binding, not just advisory.
- Blocks: dispatching any builder
- Raised: 2026-11-24 by Claude (planner)

### [ ] Check the old database credentials were rotated
- Ticket: none yet
- Steps:
  1. In the Supabase dashboard, open the project's database settings and look at when the database password was last changed
  2. If it predates the commit that exposed credentials, reset it and update the `SUPABASE_PASSWORD` GitHub secret
- Context: an earlier commit exposed database credentials. The owner says it is handled; an agent has not verified it, and cannot. The plugin's own handoff says to do this before any other work.
- Blocks: nothing in code, but his setup says do it first
- Raised: 2026-11-24 by Claude (planner)

### [ ] Delete `master` and the merged remote branches in the web UI
- Ticket: none yet
- Steps:
  1. In GitHub, open the ETL repo's Branches page
  2. Delete `master` (approved 2026-11-15) and each branch already merged into `main`
  3. In Settings, then General, turn on "Automatically delete head branches"
- Context: a cloud session gets a 403 deleting remote branches. A manager session on the Windows machine could, but the owner deletes `master`.
- Blocks: nothing
- Raised: 2026-11-24 by Claude (planner)
