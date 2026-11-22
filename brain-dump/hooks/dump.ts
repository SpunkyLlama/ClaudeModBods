// Pure helpers for Brain Dump: no engine, no file access, so the tests can run
// them offline. The file is plain markdown, one entry per line:
//   - [ ] 2026-11-15 12:30 call the vet            (unsorted)
//   - [x] 2026-11-15 12:30 call the vet -> ticket  (sorted)
// Entries are never deleted: triage only marks them. /rewrite adds a block of
// indented "  > " lines directly under an entry (the prompt, then open questions);
// parse() ignores those lines, so entry line numbers and /triage are unaffected.

export const FILE = '.claude/memory/BRAIN-DUMP.md'
export const HEADER =
  '# Brain dump\n\n' +
  'Written by the brain-dump mod. `/braindump <text>` adds a line; `/triage` marks each\n' +
  'one ticket, note or discard. Nothing is deleted.\n\n'

export type Fate = 'ticket' | 'note' | 'discard'
export const FATES: readonly Fate[] = ['ticket', 'note', 'discard']

export type Entry = {
  index: number // line number in the file, 0-based
  stamp: string // "YYYY-MM-DD HH:MM", UTC
  text: string
  fate: Fate | null // null = unsorted
  hasRewrite: boolean // a "  > " block from /rewrite sits right under it
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
  const lines = file.split('\n')
  lines.forEach((raw, index) => {
    const m = LINE.exec(raw)
    if (!m) {
      return
    }
    const fate = (m[4] as Fate | undefined) ?? null
    // a [x] line with no verdict, or a verdict on a [ ] line, is hand-edited: trust the box
    out.push({
      index,
      stamp: m[2] ?? '',
      text: m[3] ?? '',
      fate: m[1] === 'x' ? (fate ?? 'note') : null,
      hasRewrite: (lines[index + 1] ?? '').startsWith('  >'),
    })
  })
  return out
}

export const unsorted = (entries: Entry[]) => entries.filter(e => e.fate === null)

export function summary(entries: Entry[]): string {
  const open = unsorted(entries)
  if (entries.length === 0) {
    return 'Brain dump is empty. Add a thought with /braindump <text>.'
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

// Puts `block` (plain lines) under the entry at `index`, replacing any block that
// is already there. Returns null when that line is no longer the entry the caller
// read (`text`), so a file edited meanwhile is never overwritten blindly.
export function insertBlock(file: string, index: number, text: string, block: string[]): string | null {
  const lines = file.split('\n')
  const m = LINE.exec(lines[index] ?? '')
  if (!m || m[3] !== text) {
    return null
  }
  let end = index + 1
  while ((lines[end] ?? '').startsWith('  >')) {
    end++
  }
  const quoted = block.map(l => (l === '' ? '  >' : `  > ${l}`))
  lines.splice(index + 1, end - index - 1, ...quoted)
  return lines.join('\n')
}

export const ANSWERS = 'Your answers:'
export const QUESTIONS = 'Open questions:'

// The plain lines of the block under the entry at `index` ("  > " stripped), or []
// when there is none.
export function blockLines(file: string, index: number): string[] {
  const lines = file.split('\n')
  const out: string[] = []
  for (let i = index + 1; (lines[i] ?? '').startsWith('  >'); i++) {
    out.push((lines[i] ?? '').replace(/^  > ?/, ''))
  }
  return out
}

// What the person has answered so far, one line each, from a block's lines.
export function answersIn(block: string[]): string[] {
  const at = block.indexOf(ANSWERS)
  return at < 0 ? [] : block.slice(at + 1).filter(l => l.trim() !== '')
}

// An entry /answer can target: it has a rewrite, and that rewrite asked something.
export function isAskingOf(file: string, index: number): boolean {
  return blockLines(file, index).includes(QUESTIONS)
}

// Appends one answer line to the block under the entry at `index`, adding the
// "Your answers:" section the first time. Null when the line is not that entry
// (`text`) or it has no block, so nothing is ever written to the wrong place.
export function addAnswer(file: string, index: number, text: string, answer: string): string | null {
  const block = blockLines(file, index)
  const one = answer.replace(/\s+/g, ' ').trim()
  if (block.length === 0 || one === '') {
    return null
  }
  const next = block.includes(ANSWERS) ? [...block, one] : [...block, '', ANSWERS, one]
  return insertBlock(file, index, text, next)
}
