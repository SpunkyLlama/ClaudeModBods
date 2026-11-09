# Cache Keeper

A Claude Code mod that keeps you efficient with tokens in every chat.

- **Warm/cold cache status** with a countdown, based on the last reply's cache usage and your cache lifetime.
- **Tokens and cost**: context size and percent of the window, tokens billed this session, and session dollars.
- **A nudge** to start a new chat once cost or context passes your thresholds.
- **`/handoff`** summarizes the conversation into `HANDOFF.md` (using the warm cache, so it is cheap) so a fresh chat can pick up with no re-explaining.
- **Cold-send guard**: after the cache expires, the first message you send is held once with a note on how much context it would re-read uncached; send it again to go ahead. It stays out of the way under 20% context, ignores slash commands, and fails open.
- **`/cache`** prints the current status on demand.

Where the app draws mod UI (the terminal CLI), the status shows in a band above the prompt. Where it does not, a one-line notice is added to the conversation after each reply; the model never reads it, so it costs no tokens. Some apps hide that notice too, so use `/cache` there.

## Settings

| Setting | Default | Meaning |
| --- | --- | --- |
| `cacheTtlSeconds` | 3600 | 300 for the 5-minute cache, 3600 for the 1-hour cache. To check yours, wait past 5 minutes between messages and see whether the hit rate stays high. |
| `nudgeCostUsd` | 2 | Suggest a new chat at this session cost. |
| `nudgeContextPercent` | 60 | Suggest a new chat at this context fill. |
| `transcriptLine` | true | Print the status after each reply. |
| `coldGuard` | true | Hold the first message after the cache expires. |
| `coldGuardMinPercent` | 20 | Guard only applies at this context fill or higher. |

## Install

```
/plugin install cache-keeper --marketplace <owner>/<repo>
```
