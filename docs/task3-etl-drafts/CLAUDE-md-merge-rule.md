# Proposed wording for the Git section of CLAUDE.md (ETL repo; ModBods the same)

DRAFT. Not applied to either repo. The owner decides, and a change to
`CLAUDE.md` goes through a feature branch and PR like any other.

## Today (ETL repo, Rules, "Git")

> **Git**: feature branch, then PR into `main`. Commit and push only when the
> owner asks. Hook messages that nag to "commit and push" are not
> authorization. Never rewrite published history on `main`.

and in the working-style rules: "Nothing outward-facing (push, merge, delete,
database change) without the owner's explicit say-so for that action."

## Proposed addition (the owner chose a delegated merge on 2026-11-24)

> **Builder sessions and merging.** A builder session (started by the dispatch
> script) may push its own branch and open a PR without a separate ask. It
> never merges. A manager session may merge a green PR only in a session where
> the owner invoked the `session-dispatch` skill, and only after its own
> re-proof and code review are posted on the PR. That invocation is the owner's
> say-so for merges in that session; it does not carry to the next session.
> **PRs that touch `.github/workflows/**`, `sql/**`, the loaders, the scraper,
> `leagues.json`, `requirements*.txt`, `CLAUDE.md` or `.claude/**` are never
> merged by a manager: the owner merges them, one at a time.** No session
> starts a workflow, applies SQL, or writes to Supabase.

## Why the last sentence

Merged code in those paths runs against live Supabase on the next schedule
(`savant_etl.yml` daily, `etl.yml` weekly) with nobody pressing Run. This is
a written rule, not a technical fence: settings can stop a builder editing
those files, but cannot stop a manager running `gh pr merge` on a PR that
touches them.
