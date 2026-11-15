# ClaudeModBods: Glossary

Shared language for this project: how the key concepts are named so the code,
the docs and anyone reading them mean the same thing.

## Language

**Mod**:
A Claude Code plugin that changes how Claude Code looks or behaves, such as a
status band, a slash command or a hook on turns. One folder in this repo.
_Avoid_: extension, add-on, when you mean a specific mod.

**Band**:
The status strip a mod draws above the prompt, in apps that draw mod UI. Where
an app does not, a mod falls back to a one-line notice in the chat.
_Avoid_: status bar, panel (a panel is a side pane).

**Warm / cold (cache)**:
Warm means the prompt cache still holds the conversation, so the next message
is cheap. Cold means it has expired, so the next message re-reads the whole
context at full price.
_Avoid_: hot, expired (except as the cause of cold).

**Cache lifetime**:
How long the cache stays warm: 5 minutes or 1 hour. Cache Keeper learns it from
replies that arrive after a long pause.
_Avoid_: TTL in user-facing text.

**Evidence**:
A reply Cache Keeper uses to learn the lifetime: a warm reply after a gap of
330 seconds or more, or a cold one. The reply after `/handoff` is never
evidence.

**Atom (snap)**:
The single versioned piece of saved state a mod keeps (for Cache Keeper,
`snap-3`). Change its shape and you bump its version.

**turn.step**:
The hook event every mod here runs from. `turn.complete` does not fire in cloud
sessions.

**Handoff**:
A summary of a chat written to `HANDOFF.md` by `/handoff`, so a fresh chat can
continue. It is overwritten each time and is scratch, not a place for lists.

**Cold-send guard**:
After the cache expires, the first message is held once with a note on how
much context it would re-read uncached. Send again to go ahead.

**Nudge**:
Cache Keeper's suggestion to start a new chat once session cost or context
fill passes a threshold.

**Σ (total)**:
Tokens processed in the session, counting cache reads like any other token. It
is a size measure, not a bill, and includes the `/handoff` fork's tokens.
_Avoid_: cost (cost is dollars).

**Subagent**:
A helper Claude that handles one piece of a larger job. Its turns carry an
`agentId`. Cache Keeper ignores them; Help Desk will show them.

**Green**:
The `tests` workflow passing on a PR.
