# Brain Dump

A Claude Code mod for catching a thought without leaving the chat.

- **`/dump <text>`** appends a timestamped (UTC) line to `.claude/memory/BRAIN-DUMP.md` in the current folder, creating it if needed.
- **`/dump`** alone shows the unsorted count and the last five entries.
- **`/triage`** shows the oldest unsorted entry. **`/triage ticket`**, **`/triage note`** or **`/triage discard`** marks it and shows the next. Entries are only marked, never deleted.
- A **band** above the prompt shows the unsorted count when it is above zero (where the app draws mod UI).

Read-only apart from that one file, which it writes only when you run `/dump` or `/triage <verdict>`. It makes no network calls. It does not file GitHub issues or edit other files: a `ticket` or `note` verdict tells you to ask Claude, which confirms before anything outward-facing.

Known limit: the file lives under the current folder, so a chat outside a repo gets a `.claude/memory/` folder wherever it was opened.

## Install

```
/plugin install brain-dump --marketplace SpunkyLlama/claudemodbods
```

## Test

From this folder:

```
node --experimental-strip-types tests/dump.test.ts
claude plugin validate --strict .
```
