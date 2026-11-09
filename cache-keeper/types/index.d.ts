export type Line = string

export type Snap = {
  lastAt: number // when the last model response landed (ms)
  lastRead: number // cache-read tokens of that response
  lastWrite: number // cache-write tokens of that response
  turns: number
  spent: number // all tokens billed this session
  hasNudged: boolean
  held: boolean // the cold-send guard already held a message since the last reply
}

declare module 'claude-code' {
  interface PluginState {
    'cache-keeper': { line: Line; snap: Snap }
  }
}
