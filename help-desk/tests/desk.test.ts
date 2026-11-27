// Scenarios for hooks/desk.ts. No dependencies, no engine. From help-desk/:
//   node --experimental-strip-types tests/desk.test.ts
// Prints one line per scenario and exits non-zero if any fails.

// Node needs the .ts extension; tsc and the validator do not all allow it.
// @ts-ignore
import { GRACE_MS, MAX_CARDS, addCard, addUsage, adoptListed, agentsLine, bandText, fromTodoWrite, k, spawnBegan, spawnEnded, startingOf, syncCards, syncStatuses, taskCreated, taskUpdated, todoLine, tokensOf, trim } from '../hooks/desk.ts'

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
check('an empty update of an unknown id changes nothing (a status adds a placeholder: see resume.test.ts)', taskUpdated(t, '99', {}), t)
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

// ── 0.2.1: a running subagent must not be invisible ──────────────────────────
console.log('starting: a spawn under way')
check('a missing count is zero', startingOf({}), 0)
check('a spawn begins', spawnBegan({ starting: 0 }).starting, 1)
check('a spawn begins on state written before the field existed', spawnBegan({} as { starting?: number }).starting, 1)
check('two begin, one ends', spawnEnded(spawnBegan(spawnBegan({ starting: 0 }))).starting, 1)
check('the count never goes below zero', spawnEnded({ starting: 0 }).starting, 0)
check('a starting spawn alone is a line', agentsLine([], 1), '1 starting…')
check('no cards and none starting is still no line', agentsLine([], 0), null)
check('starting comes before running', agentsLine([card('a', { label: 'x', tokens: 0 })], 2), '2 starting… · 1 running: x 0')
check('the band is not blank while a subagent starts', bandText({ todos: [], cards: [], starting: 1 }), '1 starting…')
check('the band is blank again once it has ended', bandText({ todos: [], cards: [], starting: 0 }), '')

console.log('addUsage: an agent met before its spawn answered is adopted')
{
  const adopted = addUsage([], 'a1b2c3d4e5f6', 900, { now: 5000, model: 'haiku' })
  check('an unknown id with opts gets a placeholder card', adopted.map((c: any) => [c.id, c.label, c.status, c.tokens, c.steps, c.model, c.adopted, c.seen, c.activeAt]), [['a1b2c3d4e5f6', 'Subagent a1b2c3d4', 'running', 900, 1, 'haiku', true, false, 5000]])
  check('a second request adds to it, not a second card', addUsage(adopted, 'a1b2c3d4e5f6', 100, { now: 6000 }).map((c: any) => [c.tokens, c.steps, c.activeAt]), [[1000, 2, 6000]])
  check('without opts an unknown id is still ignored', addUsage([], 'zzz', 5), [])
  const wrongDone = [card('a', { status: 'done', seen: false, startedAt: 0 })]
  check('a request revives a card the list never confirmed', addUsage(wrongDone, 'a', 1, { now: 99_000 })[0]?.status, 'running')
  check('...but not one the list had confirmed and then dropped', addUsage([card('a', { status: 'done', seen: true })], 'a', 1, { now: 99_000 })[0]?.status, 'done')
  check('...and not without opts (the old call)', addUsage(wrongDone, 'a', 1)[0]?.status, 'done')
}

console.log('addCard: the spawn names a card adopted earlier')
{
  const early = addUsage([], 'ag1', 500, { now: 1000, model: 'haiku' })
  const named = addCard(early, { id: 'ag1', label: 'scan repo', kind: 'Explore', model: 'haiku-5', now: 2000 })
  check('label, kind and model come from the spawn', named.map((c: any) => [c.label, c.kind, c.model, c.adopted]), [['scan repo', 'Explore', 'haiku-5', false]])
  check('its tokens and steps are kept', named.map((c: any) => [c.tokens, c.steps]), [[500, 1]])
  const plain = [card('ag2')]
  check('a card that was not adopted is left alone', addCard(plain, { id: 'ag2', label: 'other', kind: 'k', model: 'm', now: 1 }) === plain, true)
}

console.log('syncStatuses: the grace runs from the last request')
{
  const quiet = [card('a', { startedAt: 0, activeAt: 10_000 })]
  check('a card with a recent request is still running', syncStatuses(quiet, [], 10_000 + GRACE_MS)[0]?.status, 'running')
  check('...and ends one tick after the grace', syncStatuses(quiet, [], 10_000 + GRACE_MS + 1)[0]?.status, 'done')
  check('without activeAt it still runs from startedAt', syncStatuses([card('a', { startedAt: 0 })], [], GRACE_MS + 1)[0]?.status, 'done')
}

console.log('adoptListed: running subagents the spawn hook missed')
{
  const l = (id: string, over: object = {}) => ({ id, status: 'running', description: 'scan repo', type: 'Explore', kind: 'local_agent', ...over })
  const got = adoptListed([], [l('x1')], 7000)
  check('a running subagent with no card gets one, already seen', got.map((c: any) => [c.id, c.label, c.kind, c.status, c.seen, c.adopted, c.startedAt]), [['x1', 'scan repo', 'Explore', 'running', true, true, 7000]])
  check('a teammate is not a subagent', adoptListed([], [l('t1', { kind: 'in_process_teammate' })], 1), [])
  check('an idle or finished entry is not adopted', adoptListed([], [l('i1', { status: 'idle' }), l('c1', { status: 'completed' })], 1), [])
  check('an entry with no kind is taken (older engine)', adoptListed([], [l('o1', { kind: undefined })], 1).length, 1)
  const have = [card('x1', { label: 'mine' })]
  check('an agent that has a card is not added twice, and its name stays', adoptListed(have, [l('x1')], 1) === have, true)
  const ended = [card('x1', { status: 'done' })]
  check('an ended card is never reopened by the list', adoptListed(ended, [l('x1')], 1) === ended, true)
  const early = addUsage([], 'x1', 10, { now: 1 })
  check('an adopted placeholder gets the list\'s name', adoptListed(early, [l('x1')], 2).map((c: any) => [c.label, c.kind]), [['scan repo', 'Explore']])
  const same = adoptListed([], [l('x1')], 1)
  check('nothing new returns the same array', adoptListed(same, [l('x1')], 2) === same, true)
}

console.log('syncCards: one poll, end to end')
{
  const running = [{ id: 'x1', status: 'running', description: 'fix tests', type: 'general-purpose', kind: 'local_agent' }]
  const first = syncCards([], running, 1000)
  check('a running agent the hook missed shows as running', first.map((c: any) => [c.label, c.status]), [['fix tests', 'running']])
  check('it stays running while listed', syncCards(first, running, 2500)[0]?.status, 'running')
  check('it is done once the list drops it', syncCards(first, [], 4000)[0]?.status, 'done')
  check('an empty list and no cards changes nothing', (() => { const none: any[] = []; return syncCards(none, [], 1) === none })(), true)
}

console.log(`\n${passed} passed, ${failures.length} failed`)
if (failures.length > 0) {
  process.exitCode = 1
}
