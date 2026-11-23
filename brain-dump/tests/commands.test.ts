// Scenarios for hooks/commands.ts and its wiring in hooks/register.tsx. No dependencies.
// From brain-dump/:
//   node --experimental-strip-types tests/commands.test.ts
// Prints one line per scenario and exits non-zero if any fails.

// @ts-ignore
import { COMMANDS, ensureCommands, failureNote, isComplete, newState, warm } from '../hooks/commands.ts'
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

// A fake `$.command`: records what was registered; `refuse` names that throw.
function fake(refuse: string[] = []) {
  const calls: string[] = []
  const register = async (c: { name: string }) => {
    calls.push(c.name)
    if (refuse.includes(c.name)) {
      throw new Error(`refused ${c.name}`)
    }
    return { command: c.name }
  }
  return { calls, refuse, register }
}

async function main() {
  console.log('ensureCommands')
  {
    const s = newState()
    const f = fake()
    const failed = await ensureCommands(s, f.register)
    check('registers all four', f.calls, ['braindump', 'triage', 'answer', 'rewrite'])
    check('nothing failed', failed, [])
    check('state is complete', isComplete(s), true)
    check('a second call registers nothing more', (await ensureCommands(s, f.register), f.calls.length), 4)
  }
  {
    const s = newState()
    const f = fake(['triage'])
    const failed = await ensureCommands(s, f.register)
    check('one refusal does not stop the others', f.calls, ['braindump', 'triage', 'answer', 'rewrite'])
    check('the refusal is reported with its reason', failed, [{ name: 'triage', reason: 'refused triage' }])
    check('state is not complete', isComplete(s), false)
    f.refuse.length = 0
    f.calls.length = 0
    const again = await ensureCommands(s, f.register)
    check('a retry registers only the missing one', f.calls, ['triage'])
    check('and then it is complete', [again, isComplete(s)], [[], true])
  }
  {
    const s = newState()
    const f = { register: async () => { throw 'plain string' } }
    const failed = await ensureCommands(s, f.register)
    check('a non-Error throw still gives a reason', failed[0]?.reason, 'plain string')
  }

  console.log('failureNote')
  {
    const s = newState()
    const failed = [{ name: 'triage', reason: 'boom' }]
    check('says what failed', failureNote(s, failed), 'Brain Dump: could not register /triage (boom).')
    check('says it only once', failureNote(s, failed), null)
    check('says nothing when nothing failed', failureNote(newState(), []), null)
  }

  // The band's count must follow the file: another chat in the same folder, or a hand
  // edit, changes it, and the old code read it once per chat and then went stale.
  console.log('warm: registers commands and keeps the band count current')
  {
    const s = newState()
    const f = fake()
    const toasts: string[] = []
    let counted = 0
    const ops = { register: f.register, toast: (t: string) => { toasts.push(t) }, refreshCount: async () => { counted++ } }
    await warm(s, ops)
    check('first call registers all four and refreshes the count', [f.calls.length, counted], [4, 1])
    await warm(s, ops)
    await warm(s, ops)
    check('later calls register nothing more', f.calls.length, 4)
    check('but refresh the count every time', counted, 3)
    check('no toast when nothing failed', toasts, [])
  }
  {
    const s = newState()
    const f = fake(['triage'])
    const toasts: string[] = []
    let counted = 0
    await warm(s, { register: f.register, toast: (t: string) => { toasts.push(t) }, refreshCount: async () => { counted++ } })
    check('a refused command is toasted', toasts, ['Brain Dump: could not register /triage (refused triage).'])
    check('and the count is still refreshed', counted, 1)
    await warm(s, { register: f.register, toast: (t: string) => { toasts.push(t) }, refreshCount: async () => { counted++ } })
    check('the refusal is toasted only once', toasts.length, 1)
  }
  {
    const s = newState()
    const f = fake()
    const failing = async () => { throw new Error('file unreadable') }
    let threw = false
    try {
      await warm(s, { register: f.register, toast: () => {}, refreshCount: failing })
    } catch {
      threw = true
    }
    check('a count failure never throws out of warm (fails open)', threw, false)
    check('and the commands were still registered', f.calls.length, 4)
  }
  {
    const s = newState()
    let counted = 0
    let threw = false
    try {
      await warm(s, {
        register: async () => { throw new Error('x') },
        toast: () => { throw new Error('toast broke') },
        refreshCount: async () => { counted++ },
      })
    } catch {
      threw = true
    }
    check('a toast failure never throws out of warm either', threw, false)
    check('and the count is still refreshed after it', counted, 1)
  }

  console.log('command list')
  check('the four commands, in order', COMMANDS.map((c: { name: string }) => c.name), ['braindump', 'triage', 'answer', 'rewrite'])
  check('no command uses a name another skill is known to hold (dump)', COMMANDS.some((c: { name: string }) => c.name === 'dump'), false)
  check('every command has a description', COMMANDS.every((c: { description: string }) => c.description.length > 10), true)

  console.log('wiring in register.tsx (the real hooks cannot run here, so check the source)')
  {
    const src = readFileSync('hooks/register.tsx', 'utf8') as string
    for (const ev of ['session.start', 'session.attach', 'prompt.submit']) {
      const at = src.indexOf(`on('${ev}'`)
      const body = at < 0 ? '' : src.slice(at, at + 220)
      check(`${ev} hook calls warmUp`, body.includes('warmUp($, reg)'), true)
    }
    check('no once-only "synced" flag is left that would freeze the band count', src.includes('synced'), false)
    check('the old /dump handler is gone from register.tsx', src.includes("{ command: 'dump' }"), false)
    check('register.tsx registers only through the helper (one $.command.register call)', (src.match(/\$\.command\.register/g) ?? []).length, 1)
    check('the prompt.submit hook fails open', /on\('prompt\.submit'[\s\S]*?\.catch\(\(\$, e, next\) => next\(e\)\)/.test(src), true)
    // the declared commands must each have a handler
    for (const c of COMMANDS as readonly { name: string }[]) {
      check(`/${c.name} has a command.run handler`, src.includes(`{ command: '${c.name}' }`), true)
    }
  }

  console.log(`\n${passed} passed, ${failures.length} failed`)
  if (failures.length > 0) {
    process.exitCode = 1
  }
}

main()
