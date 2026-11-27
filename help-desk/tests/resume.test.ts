// Scenarios for hooks/resume.ts (the per-chat record that lets a chat you left and came back
// to keep its to-do list and subagent cards) and for the TaskUpdate-for-an-unknown-task fix in
// hooks/desk.ts. No dependencies, no engine. From help-desk/:
//   node --experimental-strip-types tests/resume.test.ts
// Prints one line per scenario and exits non-zero if any fails.

// Node needs the .ts extension; tsc and the validator do not all allow it.
// @ts-ignore
import { CHAT_PREFIX, MAX_CHATS, chatKey, excessKeys, restoreDesk } from '../hooks/resume.ts'
// @ts-ignore
import { taskUpdated } from '../hooks/desk.ts'
// @ts-ignore
import { readFileSync } from 'node:fs'

declare const console: { log(...a: unknown[]): void }
declare const process: { exitCode?: number }

let passed = 0
const failures: string[] = []
function check(name: string, got: unknown, want: unknown) {
  const g = JSON.stringify(got)
  const w = JSON.stringify(want)
  if (g === w) {
    passed++
    console.log(`  ok    ${name}`)
  } else {
    failures.push(name)
    console.log(`  FAIL  ${name}\n          got  ${g}\n          want ${w}`)
  }
}

const TODO = { id: '3', text: 'Write tests', active: 'Writing tests', status: 'in_progress' } as any
const CARD = { id: 'a1', label: 'scan repo', kind: 'Explore', model: 'haiku', status: 'running', tokens: 12000, steps: 4, startedAt: 1700000000000, seen: true } as any
const DESK = { todos: [TODO], cards: [CARD], seen: { calls: 5, spawns: 1, steps: 4 }, starting: 0 }

// ── chatKey / excessKeys: the same small helpers Cache Keeper has ────────────
console.log('chatKey and excessKeys')
check('the key starts with the prefix and holds the start time', chatKey(1700000000123), `${CHAT_PREFIX}1700000000123`)
check('two chats get different keys', chatKey(1) === chatKey(2), false)
const chats = (n: number) => Array.from({ length: n }, (_, i) => chatKey(1000 + i))
check('at the limit nothing is pruned', excessKeys(chats(MAX_CHATS)), [])
check('over the limit the oldest go', excessKeys(chats(MAX_CHATS + 2)), [chatKey(1000), chatKey(1001)])
check('other keys are never pruned or counted', excessKeys(['x', ...chats(MAX_CHATS)]), [])

// ── restoreDesk(): trust nothing read back from the store ───────────────────
console.log('restoreDesk: a good record comes back unchanged')
check('a full record is returned as it was', restoreDesk(DESK), DESK)
check('read back through JSON it is the same', restoreDesk(JSON.parse(JSON.stringify(DESK))), DESK)
check('a record with only a to-do list is fine', restoreDesk({ ...DESK, cards: [] }), { ...DESK, cards: [] })
check('a record with only cards is fine', restoreDesk({ ...DESK, todos: [] }), { ...DESK, todos: [] })
check('a record without counters gets zeros', restoreDesk({ todos: [TODO], cards: [] }), { todos: [TODO], cards: [], seen: { calls: 0, spawns: 0, steps: 0 }, starting: 0 })
check('extra fields are dropped', restoreDesk({ ...DESK, junk: 1, todos: [{ ...TODO, extra: 'x' }] }), DESK)

console.log('restoreDesk: bad or empty records are refused')
check('undefined is refused', restoreDesk(undefined), null)
check('null is refused', restoreDesk(null), null)
check('a string is refused', restoreDesk('desk'), null)
check('an array is refused', restoreDesk([DESK]), null)
check('an empty desk is refused: nothing to restore', restoreDesk({ todos: [], cards: [], seen: DESK.seen }), null)
check('todos that are not a list are refused', restoreDesk({ ...DESK, todos: 'x' }), null)
check('a to-do with an unknown status is refused', restoreDesk({ ...DESK, todos: [{ ...TODO, status: 'deleted' }] }), null)
check('a to-do with a missing text is refused', restoreDesk({ ...DESK, todos: [{ id: '1', active: 'a', status: 'pending' }] }), null)
check('a card with an unknown status is refused', restoreDesk({ ...DESK, cards: [{ ...CARD, status: 'sleeping' }] }), null)
check('a card with tokens as text is refused', restoreDesk({ ...DESK, cards: [{ ...CARD, tokens: '12k' }] }), null)
check('a card with a negative count is refused', restoreDesk({ ...DESK, cards: [{ ...CARD, steps: -1 }] }), null)
check('a card with seen as a number is refused', restoreDesk({ ...DESK, cards: [{ ...CARD, seen: 1 }] }), null)
check('counters that are not numbers are refused', restoreDesk({ ...DESK, seen: { calls: 'x', spawns: 0, steps: 0 } }), null)
check('an absurdly long to-do list is refused', restoreDesk({ ...DESK, todos: Array.from({ length: 201 }, (_, i) => ({ ...TODO, id: String(i) })) }), null)

// ── TaskUpdate for a task made before the mod loaded ─────────────────────────
console.log('taskUpdated: an update for a task we never saw')
{
  const t = [TODO]
  check('a status change for an unknown id adds a placeholder', taskUpdated(t, '9', { status: 'in_progress' }).map((x: any) => [x.id, x.text, x.status]), [['3', 'Write tests', 'in_progress'], ['9', 'Task 9', 'in_progress']])
  check('a subject names the placeholder', taskUpdated([], '9', { status: 'completed', subject: 'Ship docs' })[0], { id: '9', text: 'Ship docs', active: 'Ship docs', status: 'completed' })
  check('an activeForm is kept for the placeholder', taskUpdated([], '9', { status: 'in_progress', subject: 'Ship docs', activeForm: 'Shipping docs' })[0]?.active, 'Shipping docs')
  check('a subject alone makes a pending placeholder', taskUpdated([], '9', { subject: 'Ship docs' })[0]?.status, 'pending')
  check('deleting an unknown task adds nothing', taskUpdated(t, '9', { status: 'deleted' }), t)
  check('an update that names nothing we show adds nothing', taskUpdated(t, '9', {}), t)
  check('an empty id adds nothing', taskUpdated(t, '', { status: 'completed' }), t)
  check('a second update then changes the same placeholder', taskUpdated(taskUpdated([], '9', { status: 'in_progress' }), '9', { status: 'completed' }).map((x: any) => [x.id, x.status]), [['9', 'completed']])
  check('a known id still updates in place', taskUpdated(t, '3', { status: 'completed' })[0]?.status, 'completed')
}

// ── Wiring in register.tsx (the real hooks cannot run here, so check the source) ──
console.log('wiring in register.tsx')
{
  const src = readFileSync('hooks/register.tsx', 'utf8') as string
  const body = (start: string, len = 400) => {
    const at = src.indexOf(start)
    return at < 0 ? '' : src.slice(at, at + len)
  }
  check('session.start restores the chat before anything else', body("on('session.start'", 120).includes('await restoreChat($)'), true)
  for (const tool of ['TodoWrite', 'TaskCreate', 'TaskUpdate']) {
    check(`${tool} saves the desk after updating it`, body(`{ tool: '${tool}' }`, 900).includes('await persist($)'), true)
  }
  check('a subagent spawn saves the desk', body("on('agent.spawn'", 900).includes('await persist($)'), true)
  check('the poll saves when a card changed', body('async function poll', 1100).includes('await persist($)'), true)
  check('subagent steps are throttled, not saved every time', body("on('turn.step'", 900).includes('SAVE_EVERY_MS'), true)
  check('the store helpers, the command helper, the spawn counter and the poll fail open', (src.match(/\/\/ fail open/g) ?? []).length, 5)
  check('the desk is only ever written to the store through persist', (src.match(/\$\.store\.set/g) ?? []).length, 1)
}

// ── The copies of the shared helpers must match Cache Keeper's ───────────────
// Mods are isolated (a mod cannot import another's files), so these few lines are duplicated.
console.log('shared helpers match the Cache Keeper copy')
{
  const pick = (src: string) =>
    [
      /export const CHAT_PREFIX[^\n]*\n/.exec(src)?.[0],
      /export const MAX_CHATS[^\n]*\n/.exec(src)?.[0],
      /export const chatKey[^\n]*\n/.exec(src)?.[0],
      /export function excessKeys[\s\S]*?\n}\n/.exec(src)?.[0],
    ].join('')
  const mine = pick(readFileSync('hooks/resume.ts', 'utf8') as string)
  const theirs = pick(readFileSync('../cache-keeper/hooks/resume.ts', 'utf8') as string)
  check('the four shared definitions are non-empty', mine.length > 200 && !mine.includes('undefined'), true)
  check('they are identical to Cache Keeper\'s', mine === theirs, true)
}

// ── 0.2.1: the new card fields and the count that is never restored ──────────
console.log('restoreDesk: adopted, activeAt and starting')
{
  const adoptedCard = { ...CARD, adopted: true, activeAt: 1700000005000 }
  check('adopted and activeAt come back', restoreDesk({ ...DESK, cards: [adoptedCard] }), { ...DESK, cards: [adoptedCard] })
  check('a card without them stays without them', JSON.stringify(restoreDesk(DESK)).includes('adopted'), false)
  check('a stored starting count is not restored', (restoreDesk({ ...DESK, starting: 5 }) as any).starting, 0)
  check('adopted that is not a boolean is refused', restoreDesk({ ...DESK, cards: [{ ...CARD, adopted: 'yes' }] }), null)
  check('activeAt that is not a count is refused', restoreDesk({ ...DESK, cards: [{ ...CARD, activeAt: -1 }] }), null)
}

console.log(`\n${passed} passed, ${failures.length} failed`)
if (failures.length > 0) process.exitCode = 1
