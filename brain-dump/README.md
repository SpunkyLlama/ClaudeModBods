# Brain Dump

A Claude Code mod for catching a thought without leaving the chat.

- **`/dump <text>`** appends a timestamped (UTC) line to `.claude/memory/BRAIN-DUMP.md` in the current folder, creating it if needed.
- **`/dump`** alone shows the unsorted count and the last five entries.
- **`/triage`** shows the oldest unsorted entry. **`/triage ticket`**, **`/triage note`** or **`/triage discard`** marks it and shows the next. Entries are only marked, never deleted.
- **`/rewrite [model]`** takes the oldest unsorted entry that has no rewrite yet and rewrites it into a prompt for a Claude model, following that model's prompting guidance, then **saves it under the entry** in `BRAIN-DUMP.md` as indented `  > ` lines: the prompt, then an "Open questions" list for anything the note leaves out (Haiku is told not to invent requirements). **`/rewrite all`** does up to five entries; **`/rewrite redo`** replaces the existing rewrite of the oldest unsorted entry that has one. The model is `fable`, `opus`, `sonnet` or `haiku` (the 5.2 / 5.5 versions); the `targetModel` setting is the default, and Haiku always does the writing, with no tools and no chat history. The chat output also shows the model's default effort, which is advice and is not saved. The entry's own line is never changed, `/triage` works as before, and a save is skipped (and said so) if the file changed while Haiku was writing. Each call spends Haiku tokens, shown at the end.
- **`/answer <text>`** adds your answer to the open questions under the oldest rewritten entry that still has some (repeat it for more lines). Your answers are saved in the block as "Your answers:". Then **`/rewrite redo`** sends them to Haiku together with the note for a better second pass; the answers stay in the block across redos, and a question they settle is dropped.
- A **band** above the prompt shows the unsorted count when it is above zero (where the app draws mod UI).

Read-only apart from that one file, which it writes only when you run `/dump`, `/triage <verdict>`, `/rewrite` or `/answer`. It makes no network calls of its own; `/rewrite` sends the entry text to Haiku through your session, as anything you type in a chat is. It does not file GitHub issues or edit other files: a `ticket` or `note` verdict tells you to ask Claude, which confirms before anything outward-facing.

The guide notes in `hooks/guides.ts` were distilled by hand on 2026-11-16 from Anthropic's prompting best-practices page and the Fable 5.2, Opus 5.5, Sonnet 5.5 and Haiku 5.5 pages. Only guidance that changes the text of a prompt is kept. They go stale as models change, so refresh them and bump `GUIDE_DATE`. Older versions (for example Opus 4.8) have no notes yet and are refused by name.

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
