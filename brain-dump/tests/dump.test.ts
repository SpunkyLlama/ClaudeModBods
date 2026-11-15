// Scenarios for hooks/dump.ts. No dependencies. From brain-dump/:
//   node --experimental-strip-types tests/dump.test.ts
// Prints one line per scenario and exits non-zero if any fails.

// @ts-ignore
import { HEADER, formatEntry, mark, parse, stampOf, summary, unsorted } from '../hooks/dump.ts'

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

const T = Date.UTC(2026, 10, 15, 12, 30)
console.log('formatEntry')
check('stamp is UTC minute', stampOf(T), '2026-11-15 12:30')
check('plain entry', formatEntry('call the vet', T), '- [ ] 2026-11-15 12:30 call the vet')
check('newlines collapse to one line', formatEntry('a\n\n b\tc', T), '- [ ] 2026-11-15 12:30 a b c')
check('blank text is no entry', formatEntry('   \n ', T), null)
check('a thought ending in a verdict is neutralised', formatEntry('x -> ticket', T), '- [ ] 2026-11-15 12:30 x => ticket')

console.log('parse / unsorted')
const file =
  HEADER +
  '- [ ] 2026-11-15 12:30 one\n- [x] 2026-11-15 12:31 two -> ticket\n- [ ] 2026-11-15 12:32 three\nnot an entry\n'
const es = parse(file)
check('only entry lines parse', es.map((e: any) => e.text), ['one', 'two', 'three'])
check('fates read back', es.map((e: any) => e.fate), [null, 'ticket', null])
check('unsorted keeps order', unsorted(es).map((e: any) => e.text), ['one', 'three'])
check('hand-ticked line with no verdict counts as sorted', parse('- [x] 2026-11-15 12:30 hi')[0]?.fate, 'note')

console.log('mark')
const idx = unsorted(es)[0]?.index ?? -1
const marked = mark(file, idx, 'discard') as string
check('marks the line', parse(marked).map((e: any) => e.fate), ['discard', 'ticket', null])
check('leaves other lines alone', marked.split('\n').length, file.split('\n').length)
check('refuses an already sorted line', mark(marked, idx, 'note'), null)
check('refuses a non-entry line', mark(file, 0, 'note'), null)

console.log('summary')
check('empty', summary([]), 'Brain dump is empty. Add a thought with /dump <text>.')
const many = parse(Array.from({ length: 7 }, (_, i) => `- [ ] 2026-11-15 12:3${i} n${i}`).join('\n'))
check('shows count and only the last five', summary(many).split('\n').length, 6)
check('count line', summary(many).split('\n')[0], '7 unsorted of 7 total. Last 5:')

console.log(`\n${passed} passed, ${failures.length} failed`)
if (failures.length > 0) {
  process.exitCode = 1
}
