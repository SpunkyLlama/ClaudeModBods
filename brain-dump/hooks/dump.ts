// Pure helpers for Brain Dump: no engine, no file access, so the tests can run
// them offline. The file is plain markdown, one entry per line:
//   - [ ] 2026-11-15 12:30 call the vet            (unsorted)
//   - [x] 2026-11-15 12:30 call the vet -> ticket  (sorted)
// Entries are never deleted: triage only marks them.

export const FILE = '.claude/memory/BRAIN-DUMP.md'
export const HEADER =
  '# Brain dump\n\n' +
  'Written by the brain-dump mod. `/dump <text>` adds a line; `/triage` marks each\n' +
  'one ticket, note or discard. Nothing is deleted.\n\n'

export type Fate = 'ticket' | 'note' | 'discard'
export const FATES: readonly Fate[] = ['ticket', 'note', 'discard']

export type Entry = {
  index: number // line number in the file, 0-based
  stamp: string // "YYYY-MM-DD HH:MM", UTC
  text: string
  fate: Fate | null // null = unsorted
}

const LINE = /^- \[( |x)\] (\d{4}-\d{2}-\d{2} \d{2}:\d{2}) (.*?)(?: -> (ticket|note|discard))?$/

export function stampOf(ms: number): string {
  return new Date(ms).toISOString().slice(0, 16).replace('T', ' ')
}

// One entry as a file line. Newlines become spaces so it stays one line, and a
// trailing " -> word" is neutralised so a thought can never look like a verdict.
export function formatEntry(text: string, ms: number): string | null {
  const clean = text.replace(/\s+/g, ' ').trim().replace(/ -> (ticket|note|discard)$/, ' => $1')
  return clean === '' ? null : `- [ ] ${stampOf(ms)} ${clean}`
}

export function parse(file: string): Entry[] {
  const out: Entry[] = []
  file.split('\n').forEach((raw, index) => {
    const m = LINE.exec(raw)
    if (!m) {
      return
    }
    const fate = (m[4] as Fate | undefined) ?? null
    // a [x] line with no verdict, or a verdict on a [ ] line, is hand-edited: trust the box
    out.push({ index, stamp: m[2] ?? '', text: m[3] ?? '', fate: m[1] === 'x' ? (fate ?? 'note') : null })
  })
  return out
}

export const unsorted = (entries: Entry[]) => entries.filter(e => e.fate === null)

export function summary(entries: Entry[]): string {
  const open = unsorted(entries)
  if (entries.length === 0) {
    return 'Brain dump is empty. Add a thought with /dump <text>.'
  }
  const last = entries.slice(-5).map(e => `  ${e.fate === null ? '[ ]' : `[${e.fate}]`} ${e.stamp} ${e.text}`)
  return `${open.length} unsorted of ${entries.length} total. Last ${last.length}:\n${last.join('\n')}`
}

// Marks entry `index` with a fate and returns the new file text, or null when
// that line is not an unsorted entry (so nothing is ever rewritten blindly).
export function mark(file: string, index: number, fate: Fate): string | null {
  const lines = file.split('\n')
  const m = LINE.exec(lines[index] ?? '')
  if (!m || m[1] === 'x') {
    return null
  }
  lines[index] = `- [x] ${m[2]} ${m[3]} -> ${fate}`
  return lines.join('\n')
}

export function triagePrompt(entry: Entry, left: number): string {
  return (
    `${left} unsorted. Next:\n  ${entry.stamp} ${entry.text}\n` +
    'Reply /triage ticket, /triage note or /triage discard.'
  )
}

// What to tell the person after a verdict. Brain Dump never creates an issue or
// writes elsewhere itself: the file is the only thing it touches.
export function fateAdvice(fate: Fate): string {
  if (fate === 'ticket') {
    return 'Marked ticket. To file it, ask Claude; filing a GitHub issue is outward-facing, so it will confirm first.'
  }
  if (fate === 'note') {
    return 'Marked note. To keep it, ask Claude to add it to .claude/memory/MEMORY.md.'
  }
  return 'Marked discard (the line stays in the file).'
}
