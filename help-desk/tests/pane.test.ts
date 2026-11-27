// Scenarios for the side pane (0.2.0): the layout functions in hooks/desk.ts, the /helpdesk
// command's registration, and the wiring in hooks/register.tsx. No dependencies, no engine.
// From help-desk/:
//   node --experimental-strip-types tests/pane.test.ts
// Prints one line per scenario and exits non-zero if any fails.

// Node needs the .ts extension; tsc and the validator do not all allow it.
// @ts-ignore
import { bandText, debugLine, ensureCommand, paneLines, paneNote } from '../hooks/desk.ts'
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

const todo = (id: string, status: string, text = id, active = text) => ({ id, text, active, status }) as any
const card = (id: string, over: object = {}) => ({ id, label: id, kind: 'Explore', model: 'haiku', status: 'running', tokens: 0, steps: 0, startedAt: 0, seen: false, ...over }) as any
const desk = (todos: any[], cards: any[]) => ({ todos, cards, seen: { calls: 0, spawns: 0, steps: 0 } }) as any
const texts = (lines: { text: string }[]) => lines.map(l => l.text)

// ── paneLines(): the pane's body ─────────────────────────────────────────────
console.log('paneLines: empty and simple desks')
check('an empty desk says so, twice', texts(paneLines(desk([], []), 30)), ['To-do', '  No to-do list yet.', '', 'Subagents', '  No subagents yet.'])
{
  const d = desk([todo('1', 'completed', 'Read code'), todo('2', 'in_progress', 'Write tests', 'Writing tests'), todo('3', 'pending', 'Ship')], [])
  const lines = paneLines(d, 30)
  check('to-do header counts the done ones', lines[0]?.text, 'To-do · 1/3 done')
  check('a done item is ticked and dim', [lines[1]?.text, lines[1]?.tone], ['  ✓ Read code', 'dim'])
  check('the item in progress shows its doing form, bold', [lines[2]?.text, lines[2]?.tone], ['  ▶ Writing tests', 'bold'])
  check('a pending item is an open box', [lines[3]?.text, lines[3]?.tone], ['  ☐ Ship', undefined])
}
{
  const d = desk([], [
    card('a1', { label: 'scan repo', kind: 'Explore', model: 'haiku', tokens: 12000, steps: 4 }),
    card('a2', { label: 'fix tests', status: 'done', tokens: 4000, steps: 2 }),
    card('a3', { label: 'lint', status: 'failed', tokens: 900, steps: 1 }),
    card('a4', { label: 'wait', status: 'idle', tokens: 0, steps: 0 }),
  ])
  const lines = paneLines(d, 30)
  const at = lines.findIndex((l: { text: string }) => l.text.startsWith('Subagents'))
  check('the subagent header counts running, done and failed', lines[at]?.text, 'Subagents · 2 running · 2 done (1 failed)')
  check('a running card shows label, type, model, tokens and steps', lines[at + 1]?.text, '  ▶ scan repo (Explore, haiku) · 12k tokens · 4 steps')
  check('a done card is ticked and dim', [lines[at + 2]?.text, lines[at + 2]?.tone], ['  ✓ fix tests (Explore, haiku) · 4k tokens · 2 steps', 'dim'])
  check('a failed card is crossed and flagged', [lines[at + 3]?.text.slice(0, 4), lines[at + 3]?.tone], ['  ✗ ', 'warn'])
  check('an idle card is paused', lines[at + 4]?.text.startsWith('  ⏸ wait'), true)
  check('a card with no model drops the comma', paneLines(desk([], [card('x', { model: '' })]), 30).some((l: { text: string }) => l.text.includes('(Explore)')), true)
}

console.log('paneLines: not enough room')
{
  const todos = [...Array.from({ length: 6 }, (_, i) => todo(`d${i}`, 'completed', `done ${i}`)), todo('now', 'in_progress', 'Now', 'Doing now'), todo('p1', 'pending', 'Next one'), todo('p2', 'pending', 'Later one')]
  const cards = [card('e1', { status: 'done', label: 'old agent' }), card('r1', { status: 'running', label: 'live agent' })]
  const d = desk(todos, cards)
  const full = paneLines(d, 100)
  check('with room to spare nothing is hidden', texts(full).some((t: string) => t.includes('hidden')), false)
  const tight = paneLines(d, 12)
  check('a tight pane never exceeds its room', tight.length <= 12, true)
  check('the item in progress is kept', texts(tight).some((t: string) => t.includes('Doing now')), true)
  check('the running agent is kept', texts(tight).some((t: string) => t.includes('live agent')), true)
  check('the next pending item is kept', texts(tight).some((t: string) => t.includes('Next one')), true)
  check('the oldest finished items go first', texts(tight).some((t: string) => t.includes('done 0')), false)
  const hidden = texts(tight).find((t: string) => t.includes('hidden'))
  const shown = tight.filter((l: { text: string }) => l.text.startsWith('  ')).length - 1 // minus the hidden line itself
  check('a last line counts what is hidden', hidden, `  … ${todos.length + cards.length - shown} hidden`)
  const tiny = paneLines(d, 4)
  check('even a tiny room is respected', tiny.length <= 4, true)
  check('and the item in progress still shows', texts(tiny).some((t: string) => t.includes('Doing now')), true)
}
{
  // Over a grid of sizes: never more lines than room, never a wide line, always a header.
  let tooLong = 0
  let tooWide = 0
  let noHeader = 0
  for (let room = 4; room <= 40; room++) {
    for (let n = 0; n <= 25; n += 5) {
      for (let cols = 12; cols <= 60; cols += 24) {
        const d = desk(
          Array.from({ length: n }, (_, i) => todo(String(i), ['completed', 'in_progress', 'pending'][i % 3] as string, `a fairly long to-do text number ${i}`)),
          Array.from({ length: n % 7 }, (_, i) => card(`c${i}`, { status: ['running', 'done', 'failed', 'idle'][i % 4], label: `subagent doing a long task ${i}` })),
        )
        const lines = paneLines(d, room, { cols })
        if (lines.length > room) tooLong++
        if (lines.some((l: { text: string }) => l.text.length > cols)) tooWide++
        if (!texts(lines).some((t: string) => t.startsWith('To-do')) || !texts(lines).some((t: string) => t.startsWith('Subagents') || t.startsWith('Subag'))) noHeader++
      }
    }
  }
  check('over a grid of sizes: never more lines than room', tooLong, 0)
  check('over a grid of sizes: never a line wider than the pane', tooWide, 0)
  check('over a grid of sizes: both headers always show', noHeader, 0)
}

console.log('paneLines: the small widget form')
{
  const d = desk([todo('1', 'in_progress', 'Write tests', 'Writing tests'), todo('2', 'pending')], [card('a1', { label: 'scan repo', tokens: 12000 })])
  check('a widget shows the band summary, two lines at most', texts(paneLines(d, 30, { isGlance: true })), ['▶ Writing tests (0/2)', '1 running: scan repo 12k'])
  check('an empty desk in a widget says what it is', texts(paneLines(desk([], []), 30, { isGlance: true })), ['Help Desk: nothing yet'])
}

// ── the debug row learns whether the pane drew ───────────────────────────────
console.log('paneNote and the debug row')
check('a placed pane is "drawn"', paneNote({ isPlaced: true }), 'drawn')
check('a refused pane says why', paneNote({ isPlaced: false, reason: 'no surface attached' }), 'not drawn (no surface attached)')
check('a refusal without a reason still says so', paneNote({ isPlaced: false }), 'not drawn')
check('the debug row is unchanged without a pane note', debugLine(desk([], [])).includes('pane'), false)
check('an empty pane note reads "not opened"', debugLine(desk([], []), '').endsWith('pane: not opened'), true)
check('a pane note is appended', debugLine(desk([], []), 'drawn').endsWith('pane: drawn'), true)
check('bandText passes the pane note into the debug row', bandText(desk([], []), true, 'drawn').includes('pane: drawn'), true)
check('bandText without debug ignores the pane note', bandText(desk([], []), false, 'drawn'), '')

// ── /helpdesk registration ───────────────────────────────────────────────────
console.log('ensureCommand')
{
  const state = { isDone: false, isWarned: false }
  const calls: string[] = []
  const ok = async (c: { name: string }) => { calls.push(c.name) }
  check('registers /helpdesk and says nothing', [await ensureCommand(state, ok), calls], [null, ['helpdesk']])
  check('a second call registers nothing more', [await ensureCommand(state, ok), calls.length], [null, 1])
}
{
  const state = { isDone: false, isWarned: false }
  const refuse = async () => { throw new Error('refused: it is the user\'s skill') }
  const first = await ensureCommand(state, refuse)
  check('a refusal is reported with its reason', first, 'Help Desk: could not register /helpdesk (refused: it is the user\'s skill).')
  check('and reported only once', await ensureCommand(state, refuse), null)
  check('a later success still registers it', [await ensureCommand(state, async () => {}), state.isDone], [null, true])
}

// ── wiring in register.tsx (the real hooks cannot run here, so check the source) ──
console.log('wiring in register.tsx')
{
  const src = readFileSync('hooks/register.tsx', 'utf8') as string
  const body = (start: string, len = 500) => {
    const at = src.indexOf(start)
    return at < 0 ? '' : src.slice(at, at + len)
  }
  for (const ev of ['session.start', 'session.attach', 'prompt.submit']) {
    check(`${ev} tries to register the command`, body(`on('${ev}'`, 260).includes('await warmCommand($, cmd)'), true)
  }
  check('/helpdesk has a command.run handler', src.includes("{ command: 'helpdesk' }"), true)
  check('the handler opens the pane and records whether it drew', /\{ command: 'helpdesk' \}[\s\S]{0,400}\$\.ui\.open\([\s\S]{0,300}paneNote\(/.test(src), true)
  check('the pane is drawn by a ui.render hook for that pane only', /on\('ui\.render', \{ component: 'Pane', requestId: PANE \}/.test(src), true)
  check('the pane draws from the same desk atom as the band', body("{ component: 'Pane'", 700).includes('read($, desk)'), true)
  check('the pane never opens on its own (one $.ui.open, in the command)', (src.match(/\$\.ui\.open\(/g) ?? []).length, 1)
  check('one $.command.register call, through the helper', (src.match(/\$\.command\.register/g) ?? []).length, 1)
  check('the band hook is still there', src.includes("{ component: 'AbovePrompt' }"), true)
}

// ── 0.2.1: the pane shows a spawn under way ──────────────────────────────────
console.log('paneLines: starting')
{
  const d = { ...desk([], []), starting: 1 }
  const t = texts(paneLines(d, 30))
  check('the header counts the spawn', t.includes('Subagents · 1 starting'), true)
  check('a row says it is starting, in place of "No subagents yet."', t.includes('  ⏳ 1 starting…') && !t.includes('  No subagents yet.'), true)
  check('with cards the row is not added, the header still counts', texts(paneLines({ ...desk([], [card('a')]), starting: 2 }, 30)).some(x => x === 'Subagents · 2 starting · 1 running'), true)
  check('the glance summary says it too', texts(paneLines(d, 30, { isGlance: true })), ['1 starting…'])
  check('no field and zero look the same', texts(paneLines(desk([], []), 30)), texts(paneLines({ ...desk([], []), starting: 0 }, 30)))
}

console.log(`\n${passed} passed, ${failures.length} failed`)
if (failures.length > 0) process.exitCode = 1
