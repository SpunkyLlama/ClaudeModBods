export type Line = string

export type Snap = {
  lastAt: number // when the last model response landed (ms)
  lastRead: number // cache-read tokens of that response
  lastWrite: number // cache-write tokens of that response
  turns: number
  spent: number // all tokens billed this session
  hasNudged: boolean
  held: boolean // the cold-send guard already held a message since the last reply
  ttl: number // learned cache lifetime in seconds; 0 until learned
  evidence: string // last 3 observations: w = warm after a long gap, c = cold after one
}

// What claude-code's Shaped<Snap> is, written out: an atom created with
// { shape } needs its key declared this way, and the validator rejects a types
// file that imports anything.
export type SnapShaped = { shape: string; value: Snap }

declare module 'claude-code' {
  interface PluginState {
    'cache-keeper': { line: Line; snap: SnapShaped; forked: boolean }
  }
}
