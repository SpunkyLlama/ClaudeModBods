// Scenarios for hooks/desk.ts. No dependencies, no engine. From help-desk/:
//   node --experimental-strip-types tests/desk.test.ts
// Prints one line per scenario and exits non-zero if any fails.

// Node needs the .ts extension; tsc and the validator do not all allow it.
// @ts-ignore
import { GRACE_MS, MAX_CARDS, addCard, addUsage, agentsLine, bandText, fromTodoWrite, k, syncStatuses, taskCreated, taskUpdated, todoLine, tokensOf, trim } from '../hooks/desk.ts'

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

const todo = (id: string, status: string, text = id, active = text) => ({ id, text, active, status }) as any
const card = (id: string, over: object = {}) => ({ id, label: id, kind: 'general-purpose', model: 'm', status: 'running', tokens: 0, steps: 0, startedAt: 0, seen: false, ...over }) as any

console.log('TodoWrite replaces the list')
const w = fromTodoWrite([
  { content: 'Run tests', status: 'in_progress', activeForm: 'Running tests' },
  { content: 'Fix bug', status: 'pending', activeForm: 'Fixing bug' },
])
check('maps content, activeForm and status', w.map((t: any) => [t.text, t.active, t.status]), [['Run tests', 'Running tests', 'in_progress'], ['Fix bug', 'Fixing bug', 'pending']])
check('ids are positions', w.map((t: any) => t.id), ['0', '1'])
check('not an array is an empty list', fromTodoWrite(undefined), [])
check('an unknown status becomes pending', fromTodoWrite([{ content: 'x', status: 'weird' }])[0]?.status, 'pending')
check('a missing activeForm falls back to the text', fromTodoWrite([{ content: 'x', status: 'pending' }])[0]?.active, 'x')

console.log('Task tools build the list step by step')
let t = taskCreated([], '7', 'Write docs', 'Writing docs')
check('create adds a pending task', t, [{ id: '7', text: 'Write docs', active: 'Writing docs', status: 'pending' }])
check('create with the same id twice adds one', taskCreated(t, '7', 'again').length, 1)
check('create with no id adds nothing', taskCreated(t, '', 'x').length, 1)
t = taskUpdated(t, '7', { status: 'in_progress' })
check('update sets the status', t[0]?.status, 'in_progress')
check('update keeps fields it does not name', [t[0]?.text, t[0]?.active], ['Write docs', 'Writing docs'])
check('update of an unknown id changes nothing', taskUpdated(t, '99', { status: 'completed' }), t)
check('deleted removes the task', taskUpdated(t, '7', { status: 'deleted' }), [])
check('a new subject without an activeForm renames the active form too', taskUpdated(t, '7', { subject: 'Ship docs' })[0]?.active, 'Ship docs')

console.log('todoLine')
check('no list is no line', todoLine([]), null)
check('the item in progress, with progress', todoLine([todo('a', 'completed'), todo('b', 'in_progress', 'Fix', 'Fixing'), todo('c', 'pending')]), '▶ Fixing (1/3)')
check('nothing in progress shows the next pending item', todoLine([todo('a', 'completed'), todo('b', 'pending', 'Fix')]), '☐ Fix (1/2)')
check('all done', todoLine([todo('a', 'completed'), todo('b', 'completed')]), '✓ 2/2 done')
check('a long item is cut with an ellipsis', todoLine([todo('a', 'in_progress', 'x', 'y'.repeat(60))])?.includes('…'), true)

console.log('subagent cards')
let cs = addCard([], { id: 'a1', label: 'scan repo', kind: 'Explore', model: 'm', now: 100 })
check('a new card is running with no tokens', [cs[0]?.status, cs[0]?.tokens, cs[0]?.seen], ['running', 0, false])
check('the same id twice adds one card', addCard(cs, { id: 'a1', label: 'x', kind: 'y', model: 'm', now: 200 }).length, 1)
check('an empty description falls back to the agent type', addCard([], { id: 'b', label: '', kind: 'Plan', model: 'm', now: 0 })[0]?.label, 'Plan')
cs = addUsage(cs, 'a1', 1200)
cs = addUsage(cs, 'a1', 800)
check('usage adds up per card', [cs[0]?.tokens, cs[0]?.steps], [2000, 2])
check('usage for an unknown id is ignored', addUsage(cs, 'zzz', 5), cs)
check('tokens processed counts all four kinds', tokensOf({ input_tokens: 1, output_tokens: 2, cache_read_input_tokens: 3, cache_creation_input_tokens: 4 }), 10)

console.log('syncStatuses')
const base = [card('a1', { startedAt: 0 })]
check('listed as running stays running and is marked seen', syncStatuses(base, [{ id: 'a1', status: 'running' }], 1000).map((c: any) => [c.status, c.seen]), [['running', true]])
check('completed becomes done', syncStatuses(base, [{ id: 'a1', status: 'completed' }], 1000)[0]?.status, 'done')
check('failed and killed become failed', [syncStatuses(base, [{ id: 'a1', status: 'failed' }], 1)[0]?.status, syncStatuses(base, [{ id: 'a1', status: 'killed' }], 1)[0]?.status], ['failed', 'failed'])
check('idle is shown as idle', syncStatuses(base, [{ id: 'a1', status: 'idle' }], 1)[0]?.status, 'idle')
check('a card that was listed and is now gone has ended', syncStatuses([card('a1', { seen: true })], [], 5)[0]?.status, 'done')
check('a card never listed is given a grace period', syncStatuses([card('a1', { startedAt: 0 })], [], GRACE_MS)[0]?.status, 'running')
check('...and is ended after it', syncStatuses([card('a1', { startedAt: 0 })], [], GRACE_MS + 1)[0]?.status, 'done')
const same = [card('a1', { seen: true })]
check('nothing changed returns the same array', syncStatuses(same, [{ id: 'a1', status: 'running' }], 5) === same, true)
const ended = [card('a1', { status: 'done' })]
check('an ended card is never reopened', syncStatuses(ended, [{ id: 'a1', status: 'running' }], 5) === ended, true)

console.log('trim')
const many = Array.from({ length: MAX_CARDS + 3 }, (_, i) => card(`d${i}`, { status: 'done' }))
check('only the newest finished cards are kept', trim(many).map((c: any) => c.id), many.slice(-MAX_CARDS).map((c: any) => c.id))
check('running cards are never dropped', trim([card('r', { status: 'running' }), ...many]).some((c: any) => c.id === 'r'), true)

console.log('the band')
check('tokens are shortened', [k(999), k(1500), k(2_400_000)], ['999', '2k', '2.4M'])
check('no subagents is no line', agentsLine([]), null)
check('running ones show their label and tokens', agentsLine([card('a', { label: 'scan repo', tokens: 12000 }), card('b', { label: 'fix tests', tokens: 4000 })]), '2 running: scan repo 12k, fix tests 4k')
check('a third running one is counted, not listed', agentsLine([card('a'), card('b'), card('c')])?.endsWith('+1'), true)
check('finished ones are counted, failures flagged', agentsLine([card('a', { status: 'done' }), card('b', { status: 'failed' })]), '2 done (1 failed)')
check('running and done together', agentsLine([card('a', { label: 'x', tokens: 0 }), card('b', { status: 'done' })]), '1 running: x 0 · 1 done')
check('both parts joined', bandText({ todos: [todo('a', 'in_progress', 'x', 'Doing x')], cards: [card('a', { label: 'y', tokens: 1000 })] }), '▶ Doing x (0/1)  │  1 running: y 1k')
check('nothing to show is an empty string', bandText({ todos: [], cards: [] }), '')

console.log(`\n${passed} passed, ${failures.length} failed`)
if (failures.length > 0) {
  process.exitCode = 1
}
