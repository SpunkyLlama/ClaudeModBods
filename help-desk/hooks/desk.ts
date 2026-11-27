// Pure helpers for Help Desk: no engine, no file access, so the tests run offline.
import type { Card, Desk, Seen, Todo } from '../types'

export const EMPTY: Desk = { todos: [], cards: [], seen: { calls: 0, spawns: 0, steps: 0 }, starting: 0 }
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

// TaskUpdate changes the fields it names; "deleted" removes the task. An update for a task
// we never saw (made before the mod loaded, or in a chat whose list was not saved) adds a
// placeholder when it carries a status or a subject, so progress still shows: named by the
// subject if there is one, else "Task <id>". It adds nothing for a delete or an empty update.
export function taskUpdated(todos: Todo[], id: string, patch: TaskPatch): Todo[] {
  const at = todos.findIndex(t => t.id === id)
  if (at < 0) {
    if (id === '' || patch.status === 'deleted' || (patch.status === undefined && patch.subject === undefined)) {
      return todos
    }
    const text = patch.subject ?? `Task ${id}`
    return [...todos, { id, text, active: patch.activeForm ?? text, status: patch.status === undefined ? 'pending' : statusOf(patch.status) }]
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
  const known = cards.find(x => x.id === c.id)
  if (known) {
    // A card adopted from a subagent step or the agent list before the spawn hook answered has a
    // placeholder name and no model: the spawn's own words replace them, once.
    if (known.adopted !== true) {
      return cards
    }
    const named = { ...known, label: c.label || c.kind || known.label, kind: c.kind || known.kind, model: c.model || known.model, adopted: false }
    return cards.map(x => (x.id === c.id ? named : x))
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

// One request of a subagent's loop. Given `opts` (the time, and the model it ran on), a request
// from an id with no card adopts it: the spawn hook may not have answered yet, or never will
// (a fork, a workflow agent), and a running agent must not be invisible. Without `opts` an
// unknown id is ignored. A request also proves its agent alive: it moves `activeAt`, and revives
// a card the list never confirmed that the grace period had closed too early.
export function addUsage(cards: Card[], id: string, tokens: number, opts?: { now: number; model?: string }): Card[] {
  if (!cards.some(c => c.id === id)) {
    if (opts === undefined) {
      return cards
    }
    return trim([...cards, { ...placeholder(id, opts.now), model: opts.model ?? '', tokens, steps: 1, activeAt: opts.now }])
  }
  return cards.map(c => {
    if (c.id !== id) {
      return c
    }
    const alive = opts !== undefined && c.status === 'done' && !c.seen
    return {
      ...c,
      tokens: c.tokens + tokens,
      steps: c.steps + 1,
      ...(opts === undefined ? {} : { activeAt: opts.now }),
      ...(alive ? { status: 'running' as const } : {}),
    }
  })
}

// A card for an agent met before the spawn hook named it: "Subagent a1b2c3d4", until a spawn or
// the agent list gives the real description.
const placeholder = (id: string, now: number, label = '', kind = ''): Card => ({
  id,
  label: label || `Subagent ${id.slice(0, 8)}`,
  kind,
  model: '',
  status: 'running',
  tokens: 0,
  steps: 0,
  startedAt: now,
  seen: false,
  adopted: true,
})

export type Listed = { id: string; status: string; description?: string; type?: string; kind?: string }

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
    } else if (c.seen || now - (c.activeAt ?? c.startedAt) > GRACE_MS) {
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

// Cards for running subagents the agent list shows and we have no card for (the spawn hook did
// not fire, or has not answered yet), and real names for adopted cards the list can name. Only
// `local_agent`s (subagents) are taken, never teammates. Returns the same array when nothing
// changed. An agent that has a card, ended ones too, is never added a second time.
export function adoptListed(cards: Card[], listed: Listed[], now: number): Card[] {
  let out = cards
  for (const l of listed) {
    if (l.kind !== undefined && l.kind !== 'local_agent') {
      continue
    }
    const at = out.findIndex(c => c.id === l.id)
    if (at < 0) {
      if (l.status === 'running') {
        out = trim([...out, { ...placeholder(l.id, now, l.description ?? '', l.type ?? ''), seen: true }])
      }
      continue
    }
    const c = out[at]
    const label = l.description ?? ''
    if (c !== undefined && c.adopted === true && label !== '' && (c.label !== label || (l.type !== undefined && c.kind !== l.type))) {
      out = out.map((x, i) => (i === at ? { ...x, label, kind: l.type ?? x.kind } : x))
    }
  }
  return out
}

// One poll: adopt what the list shows that we missed, then bring every card's status in line.
export function syncCards(cards: Card[], listed: Listed[], now: number): Card[] {
  return syncStatuses(adoptListed(cards, listed, now), listed, now)
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

// How many subagent spawns are under way: the hook was entered and the engine has not answered.
// Zero for state written before the field existed, and never negative.
export const startingOf = (d: { starting?: number }): number => Math.max(0, d.starting ?? 0)

// A spawn began, or its answer came (or failed): the count behind "N starting…".
export const spawnBegan = <T extends { starting?: number }>(d: T): T => ({ ...d, starting: startingOf(d) + 1 })
export const spawnEnded = <T extends { starting?: number }>(d: T): T => ({ ...d, starting: Math.max(0, startingOf(d) - 1) })

// "1 starting… · 2 running: scan repo 12k, fix tests 4k · 3 done". Null when no subagent was seen
// and none is starting.
export function agentsLine(cards: Card[], starting = 0): string | null {
  if (cards.length === 0 && starting <= 0) {
    return null
  }
  const live = cards.filter(c => c.status === 'running' || c.status === 'idle')
  const ended = cards.filter(c => c.status === 'done' || c.status === 'failed')
  const failed = ended.filter(c => c.status === 'failed').length
  const parts: string[] = []
  if (starting > 0) {
    parts.push(`${starting} starting…`)
  }
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

// One more hook firing counted. Never throws on a state written before `seen` existed.
export function bump(d: Desk, key: keyof Seen): Desk {
  const s = seenOf(d)
  return { ...d, seen: { ...s, [key]: s[key] + 1 } }
}

// The counters, with zeros for any missing from state written before they existed.
function seenOf(d: { seen?: Partial<Seen> }): Seen {
  return { calls: d.seen?.calls ?? 0, spawns: d.seen?.spawns ?? 0, steps: d.seen?.steps ?? 0 }
}

// The debug row: proof the mod is loaded and drawing, and what its hooks have seen.
export function debugLine(d: Pick<Desk, 'todos' | 'cards'> & { seen?: Partial<Seen> }, paneNote?: string): string {
  const s = seenOf(d)
  const base = `Help Desk loaded · to-dos ${d.todos.length} · agents ${d.cards.length} · hooks seen: ${s.calls} task calls, ${s.spawns} spawns, ${s.steps} subagent steps`
  return paneNote === undefined ? base : `${base} · pane: ${paneNote === '' ? 'not opened' : paneNote}`
}

// The whole band row, or '' when there is nothing to show. With `isDebug` the row is never
// empty: it says the mod is loaded, then adds whatever there is to show.
export function bandText(d: Pick<Desk, 'todos' | 'cards'> & { seen?: Partial<Seen>; starting?: number }, isDebug = false, paneNote?: string): string {
  const main = [todoLine(d.todos), agentsLine(d.cards, startingOf(d))].filter((x): x is string => x !== null).join('  │  ')
  return isDebug ? [main, debugLine(d, paneNote)].filter(x => x !== '').join('  │  ') : main
}

// ── The side pane (0.2.0) ────────────────────────────────────────────────────

export type Tone = 'dim' | 'bold' | 'warn'
export type PaneLine = { text: string; tone?: Tone }
export type PaneOpts = { cols?: number; isGlance?: boolean }

export const MIN_PANE_ROWS = 4 // a smaller room is treated as this
const SEPARATOR_FROM_ROWS = 8 // under this the blank line between sections is dropped

type Item = { line: PaneLine; section: 0 | 1; order: number; rank: number }

const fit = (text: string, cols?: number) => (cols !== undefined && cols > 0 ? cut(text, cols) : text)

const todoItem = (t: Todo): PaneLine =>
  t.status === 'completed'
    ? { text: `  ✓ ${t.text}`, tone: 'dim' }
    : t.status === 'in_progress'
      ? { text: `  ▶ ${t.active}`, tone: 'bold' }
      : { text: `  ☐ ${t.text}` }

const cardItem = (c: Card): PaneLine => {
  const details = [c.kind, c.model].filter(x => x !== '').join(', ')
  const text = `${c.label}${details === '' ? '' : ` (${details})`} · ${k(c.tokens)} tokens · ${c.steps} steps`
  return c.status === 'done'
    ? { text: `  ✓ ${text}`, tone: 'dim' }
    : c.status === 'failed'
      ? { text: `  ✗ ${text}`, tone: 'warn' }
      : { text: `  ${c.status === 'idle' ? '⏸' : '▶'} ${text}` }
}

// What hides first when the room runs out: finished to-dos, then finished agents, then pending
// to-dos (the last first), then idle agents, then running agents, and the item in progress last.
// Within a rank the oldest goes first, except for pending, idle and running (the last first).
const todoRank = (t: Todo) => (t.status === 'completed' ? 0 : t.status === 'pending' ? 2 : 5)
const cardRank = (c: Card) => (c.status === 'done' || c.status === 'failed' ? 1 : c.status === 'idle' ? 3 : 4)

// The pane's body as lines: the to-do list, then the subagent cards, trimmed to `room` rows.
// With `isGlance` (the small widget seat) it is the band's summary instead. Every line fits
// `cols`. When something is cut, the last line says how many items are hidden.
export function paneLines(d: Pick<Desk, 'todos' | 'cards'> & { starting?: number }, room: number, opts: PaneOpts = {}): PaneLine[] {
  const { cols, isGlance = false } = opts
  const starting = startingOf(d)
  if (isGlance) {
    const glance = [todoLine(d.todos), agentsLine(d.cards, starting)].filter((x): x is string => x !== null)
    return (glance.length === 0 ? ['Help Desk: nothing yet'] : glance).map(text => ({ text: fit(text, cols) }))
  }
  const rows = Math.max(MIN_PANE_ROWS, Math.floor(room))
  const done = d.todos.filter(t => t.status === 'completed').length
  const live = d.cards.filter(c => c.status === 'running' || c.status === 'idle').length
  const ended = d.cards.length - live
  const failed = d.cards.filter(c => c.status === 'failed').length

  const head1 = `To-do${d.todos.length > 0 ? ` · ${done}/${d.todos.length} done` : ''}`
  const head2 = `Subagents${starting > 0 ? ` · ${starting} starting` : ''}${live > 0 ? ` · ${live} running` : ''}${ended > 0 ? ` · ${ended} done${failed > 0 ? ` (${failed} failed)` : ''}` : ''}`

  const items: Item[] = [
    ...d.todos.map((t, i): Item => ({ line: todoItem(t), section: 0, order: i, rank: todoRank(t) })),
    ...d.cards.map((c, i): Item => ({ line: cardItem(c), section: 1, order: i, rank: cardRank(c) })),
  ]
  const hasSeparator = rows >= SEPARATOR_FROM_ROWS
  const placeholders = (d.todos.length === 0 ? 1 : 0) + (d.cards.length === 0 ? 1 : 0)
  const avail = rows - 2 - (hasSeparator ? 1 : 0) - placeholders

  let hidden = new Set<Item>()
  if (items.length > avail) {
    const budget = Math.max(0, avail - 1) // one row is kept for the "hidden" line
    const oldestFirst = (it: Item) => it.rank <= 1
    const byHiding = [...items].sort((a, b) => a.rank - b.rank || (oldestFirst(a) ? a.order - b.order : b.order - a.order))
    hidden = new Set(byHiding.slice(0, items.length - budget))
  }

  const body = (section: 0 | 1) => items.filter(it => it.section === section && !hidden.has(it)).map(it => it.line)
  const out: PaneLine[] = [
    { text: head1, tone: 'bold' },
    ...(d.todos.length === 0 ? [{ text: '  No to-do list yet.', tone: 'dim' as Tone }] : body(0)),
    ...(hasSeparator ? [{ text: '' }] : []),
    { text: head2, tone: 'bold' },
    ...(d.cards.length === 0 ? [{ text: starting > 0 ? `  ⏳ ${starting} starting…` : '  No subagents yet.', tone: 'dim' as Tone }] : body(1)),
    ...(hidden.size > 0 ? [{ text: `  … ${hidden.size} hidden`, tone: 'dim' as Tone }] : []),
  ]
  return out.map(l => ({ ...l, text: fit(l.text, cols) }))
}

// One line for the debug row: did the pane draw, and if not, why.
export function paneNote(r: { isPlaced: boolean; reason?: string }): string {
  return r.isPlaced ? 'drawn' : r.reason ? `not drawn (${r.reason})` : 'not drawn'
}

// ── /helpdesk ────────────────────────────────────────────────────────────────

export const COMMAND = { name: 'helpdesk', description: 'Open the Help Desk pane: the to-do list and a card per subagent' }

export type CommandState = { isDone: boolean; isWarned: boolean }

// A plain function, not `$.command`: the plugin validator wants `$.command.register(...)` spelled
// out at its call site, so register.tsx passes `c => $.command.register(c)`. Commands belong to a
// session and a session can load the mod after session.start, so this is tried from several early
// events until it works (as Brain Dump does). Returns a one-time toast line when registering is
// refused (the engine refuses a name that a user skill holds), else null.
export async function ensureCommand(
  state: CommandState,
  register: (c: { name: string; description: string }) => Promise<unknown>,
): Promise<string | null> {
  if (state.isDone) {
    return null
  }
  try {
    await register(COMMAND)
    state.isDone = true
    return null
  } catch (err) {
    if (state.isWarned) {
      return null
    }
    state.isWarned = true
    return `Help Desk: could not register /${COMMAND.name} (${err instanceof Error ? err.message : String(err)}).`
  }
}
