// ── Cache lifetime detection ─────────────────────────────────────────────────
// Anthropic's cache lives 5 minutes or, where enabled, 1 hour, and each reply
// that reads it refreshes the clock. So a reply that arrives after a long pause
// tells us which one we have: still cached means at least that long (1 hour);
// cold, with the whole context written again, means it lapsed.
export const MIN_GAP_S = 330 // under this, both lifetimes look warm: no evidence
const MAX_COLD_GAP_S = 3300 // over this, a 1-hour cache is cold too: no evidence

// One observation from a reply: the pause before it, and what it read and wrote.
// 'w' warm after a long pause, 'c' cold after a pause that a 1-hour cache would
// have survived, null when this reply says nothing either way.
export function classify(gapS: number, read: number, write: number): 'w' | 'c' | null {
  const total = read + write
  if (gapS < MIN_GAP_S || total < 1000) {
    return null
  }
  if (read >= 1000 && read >= 0.8 * total) {
    return 'w'
  }
  if (write >= 1000 && read < 0.2 * total && gapS <= MAX_COLD_GAP_S) {
    return 'c'
  }
  return null
}

// A warm reply proves the 1-hour cache at once. One cold reply could be something
// else (a model switch, a changed system prompt), so the 5-minute cache needs two
// cold replies in a row, with no warm one between them.
export function learn(evidence: string, mark: 'w' | 'c', ttl: number) {
  const next = (evidence + mark).slice(-3)
  if (mark === 'w') {
    return { evidence: next, ttl: 3600 }
  }
  return { evidence: next, ttl: next.endsWith('cc') ? 300 : ttl }
}
