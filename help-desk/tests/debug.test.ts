// Scenarios for the 0.1.1 debug row (hooks/desk.ts) and its wiring in hooks/register.tsx.
// No dependencies, no engine. From help-desk/:
//   node --experimental-strip-types tests/debug.test.ts
// Prints one line per scenario and exits non-zero if any fails.

// @ts-ignore
import { EMPTY, bandText, bump, debugLine } from '../hooks/desk.ts'
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

const todo = (id: string, status: string, text = id) => ({ id, text, active: text, status }) as any

console.log('bump')
{
  let d: any = EMPTY
  d = bump(d, 'calls')
  d = bump(d, 'calls')
  d = bump(d, 'spawns')
  d = bump(d, 'steps')
  check('counts each hook separately', d.seen, { calls: 2, spawns: 1, steps: 1 })
  check('does not change the lists', [d.todos, d.cards], [[], []])
  check('EMPTY itself is never mutated', EMPTY.seen, { calls: 0, spawns: 0, steps: 0 })
  check('copes with state written before `seen` existed', bump({ todos: [], cards: [] } as any, 'calls').seen, { calls: 1, spawns: 0, steps: 0 })
}

console.log('debug row')
check('says the mod is loaded even when idle', debugLine({ todos: [], cards: [] }), 'Help Desk loaded · to-dos 0 · agents 0 · hooks seen: 0 task calls, 0 spawns, 0 subagent steps')
check('shows what the hooks saw', debugLine({ todos: [todo('1', 'pending')], cards: [], seen: { calls: 3, spawns: 1, steps: 9 } }), 'Help Desk loaded · to-dos 1 · agents 0 · hooks seen: 3 task calls, 1 spawns, 9 subagent steps')
check('off: idle stays empty (the 0.1.0 behaviour)', bandText({ todos: [], cards: [] }), '')
check('on: idle is never empty', bandText({ todos: [], cards: [] }, true).startsWith('Help Desk loaded'), true)
check('on: the normal row stays in front', bandText({ todos: [todo('a', 'in_progress', 'x')], cards: [] }, true).startsWith('▶ x (0/1)  │  Help Desk loaded'), true)
check('off: a normal row is unchanged', bandText({ todos: [todo('a', 'in_progress', 'x')], cards: [] }, false), '▶ x (0/1)')

console.log('wiring in register.tsx (the real hooks cannot run here, so check the source)')
{
  const src = readFileSync('hooks/register.tsx', 'utf8') as string
  const body = (start: string) => {
    const at = src.indexOf(start)
    return at < 0 ? '' : src.slice(at, at + 420)
  }
  check('debug comes from the option, off unless exactly true', src.includes('options.debug === true'), true)
  for (const t of ['TodoWrite', 'TaskCreate', 'TaskUpdate']) {
    check(`${t} hook counts a call`, body(`on('tool.call', { tool: '${t}' }`).includes("bump(d, 'calls')"), true)
  }
  check('agent.spawn hook counts a spawn', body("on('agent.spawn'").includes("bump(d, 'spawns')"), true)
  check('a subagent step is counted', src.includes("bump(d, 'steps')"), true)
  check('the band passes the flag and the pane note on', src.includes('bandText(await read($, desk), isDebug, await read($, pane))'), true)
  check('the state tag was bumped with the new field', src.includes("{ shape: 'desk-2' }") && !src.includes("'desk-1'"), true)
  check('observer hooks still fail open', (src.match(/\.catch\(OPEN\)/g) ?? []).length >= 4, true)
}

console.log(`\n${passed} passed, ${failures.length} failed`)
if (failures.length > 0) {
  process.exitCode = 1
}
