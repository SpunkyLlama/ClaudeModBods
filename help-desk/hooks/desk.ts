// Pure helpers for Help Desk: no engine, no file access, so the tests run offline.
import type { Card, Desk, Todo } from '../types'

export const EMPTY: Desk = { todos: [], cards: [] }
export const MAX_CARDS = 8 // finished cards kept, newest last; running ones are never dropped
export const GRACE_MS = 15_000 // a new card the agent list has not shown yet is not "ended"

export const k = (n: number) =>
  n >= 1_000_000 ? `${(n / 1e6).toFixed(1)}M` : n >= 1000 ? `${Math.round(n / 1000)}k` : `${n}`

const cut = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s)

// Tokens a request processed: read, written and generated, cache reads included.
// A size measure, not a bill (a cache read costs a fraction of an output token).
export function tokensOf(u: {
  input_tokens: number
  output_tokens: number
  cache_read_input_tokens: number
  cache_creation_input_tokens: number
}): number {
  return u.input_tokens + u.output_tokens + u.cache_read_input_tokens + u.cache_creation_input_tokens
}

// ── To-do list ───────────────────────────────────────────────────────────────

const STATUSES = ['pending', 'in_progress', 'completed']
const statusOf = (s: unknown): Todo['status'] => (STATUSES.includes(s as string) ? (s as Todo['status']) : 'pending')

// TodoWrite sends the whole list each time: it replaces ours.
export function fromTodoWrite(todos: unknown): Todo[] {
  if (!Array.isArray(todos)) {
    return []
  }
  return todos.map((t: any, i: number) => ({
    id: String(i),
    text: String(t?.content ?? ''),
    active: String(t?.activeForm ?? t?.content ?? ''),
    status: statusOf(t?.status),
  }))
}

// TaskCreate adds one pending task under the id the engine gave it.
export function taskCreated(todos: Todo[], id: string, subject: string, activeForm?: string): Todo[] {
  if (id === '' || todos.some(t => t.id === id)) {
    return todos
  }
  return [...todos, { id, text: subject, active: activeForm || subject, status: 'pending' }]
}

export type TaskPatch = { status?: string; subject?: string; activeForm?: string }

// TaskUpdate changes the fields it names; "deleted" removes the task.
export function taskUpdated(todos: Todo[], id: string, patch: TaskPatch): Todo[] {
  const at = todos.findIndex(t => t.id === id)
  if (at < 0) {
    return todos
  }
  if (patch.status === 'deleted') {
    return todos.filter((_, i) => i !== at)
  }
  return todos.map((t, i) =>
    i !== at
      ? t
      : {
          ...t,
          text: patch.subject ?? t.text,
          active: patch.activeForm ?? (patch.subject !== undefined ? patch.subject : t.active),
          status: patch.status === undefined ? t.status : statusOf(patch.status),
        },
  )
}

// ── Subagent cards ───────────────────────────────────────────────────────────

export function addCard(cards: Card[], c: { id: string; label: string; kind: string; model: string; now: number }): Card[] {
  if (cards.some(x => x.id === c.id)) {
    return cards
  }
  const card: Card = {
    id: c.id,
    label: c.label || c.kind,
    kind: c.kind,
    model: c.model,
    status: 'running',
    tokens: 0,
    steps: 0,
    startedAt: c.now,
    seen: false,
  }
  return trim([...cards, card])
}

// One request of a subagent's loop. An id we never saw spawn (a fork, a workflow
// agent) has no card and is ignored.
export function addUsage(cards: Card[], id: string, tokens: number): Card[] {
  if (!cards.some(c => c.id === id)) {
    return cards
  }
  return cards.map(c => (c.id === id ? { ...c, tokens: c.tokens + tokens, steps: c.steps + 1 } : c))
}

export type Listed = { id: string; status: string }

const fromListed = (s: string): Card['status'] =>
  s === 'completed' ? 'done' : s === 'failed' || s === 'killed' ? 'failed' : s === 'idle' ? 'idle' : 'running'

// Brings the cards in line with `$.agent.list()`. The list drops an agent seconds
// after it ends, so a card that was listed once and is now gone has ended. One
// never listed is given GRACE_MS before the same is assumed. Returns the same
// array when nothing changed, so a poll that finds nothing redraws nothing.
export function syncStatuses(cards: Card[], listed: Listed[], now: number): Card[] {
  let changed = false
  const out = cards.map(c => {
    if (c.status === 'done' || c.status === 'failed') {
      return c
    }
    const hit = listed.find(l => l.id === c.id)
    let next: Card = c
    if (hit) {
      next = { ...c, seen: true, status: fromListed(hit.status) }
    } else if (c.seen || now - c.startedAt > GRACE_MS) {
      next = { ...c, status: 'done' }
    }
    if (next.status !== c.status || next.seen !== c.seen) {
      changed = true
      return next
    }
    return c
  })
  return changed ? trim(out) : cards
}

// Running cards always stay; of the finished ones only the newest MAX_CARDS.
export function trim(cards: Card[]): Card[] {
  const live = cards.filter(c => c.status === 'running' || c.status === 'idle')
  const ended = cards.filter(c => c.status === 'done' || c.status === 'failed').slice(-MAX_CARDS)
  const keep = new Set([...live, ...ended].map(c => c.id))
  return cards.filter(c => keep.has(c.id))
}

// ── The band ─────────────────────────────────────────────────────────────────

// "▶ Running tests (3/7)", or the next pending item, or "✓ 7/7 done". Null when
// there is no list.
export function todoLine(todos: Todo[]): string | null {
  if (todos.length === 0) {
    return null
  }
  const done = todos.filter(t => t.status === 'completed').length
  const doing = todos.find(t => t.status === 'in_progress')
  if (doing) {
    return `▶ ${cut(doing.active, 48)} (${done}/${todos.length})`
  }
  const next = todos.find(t => t.status === 'pending')
  return next ? `☐ ${cut(next.text, 48)} (${done}/${todos.length})` : `✓ ${done}/${todos.length} done`
}

// "2 running: scan repo 12k, fix tests 4k · 3 done". Null when no subagent was seen.
export function agentsLine(cards: Card[]): string | null {
  if (cards.length === 0) {
    return null
  }
  const live = cards.filter(c => c.status === 'running' || c.status === 'idle')
  const ended = cards.filter(c => c.status === 'done' || c.status === 'failed')
  const failed = ended.filter(c => c.status === 'failed').length
  const parts: string[] = []
  if (live.length > 0) {
    const shown = live.slice(0, 2).map(c => `${cut(c.label, 22)} ${k(c.tokens)}`)
    const more = live.length > 2 ? ` +${live.length - 2}` : ''
    parts.push(`${live.length} running: ${shown.join(', ')}${more}`)
  }
  if (ended.length > 0) {
    parts.push(`${ended.length} done${failed > 0 ? ` (${failed} failed)` : ''}`)
  }
  return parts.join(' · ')
}

// The whole band row, or '' when there is nothing to show.
export function bandText(d: Desk): string {
  return [todoLine(d.todos), agentsLine(d.cards)].filter((x): x is string => x !== null).join('  │  ')
}
