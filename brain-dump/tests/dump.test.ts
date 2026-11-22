// Scenarios for hooks/dump.ts. No dependencies. From brain-dump/:
//   node --experimental-strip-types tests/dump.test.ts
// Prints one line per scenario and exits non-zero if any fails.

// @ts-ignore
import { HEADER, addAnswer, answersIn, blockLines, formatEntry, insertBlock, isAskingOf, mark, parse, stampOf, summary, unsorted } from '../hooks/dump.ts'

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
check('empty', summary([]), 'Brain dump is empty. Add a thought with /braindump <text>.')
check('the new file header names /braindump, not /dump', [HEADER.includes('`/braindump <text>`'), HEADER.includes('`/dump ')], [true, false])
const many = parse(Array.from({ length: 7 }, (_, i) => `- [ ] 2026-11-15 12:3${i} n${i}`).join('\n'))
check('shows count and only the last five', summary(many).split('\n').length, 6)
check('count line', summary(many).split('\n')[0], '7 unsorted of 7 total. Last 5:')

console.log('insertBlock (the /rewrite block under an entry)')
const base = HEADER + '- [ ] 2026-11-15 12:30 one\n- [ ] 2026-11-15 12:31 two\n'
const withB = insertBlock(base, 5, 'one', ['Prompt:', 'Do X.', '', 'Open questions:', '- why?']) as string
check('block sits under the entry, indented, blank lines kept', withB.split('\n').slice(5, 11), ['- [ ] 2026-11-15 12:30 one', '  > Prompt:', '  > Do X.', '  >', '  > Open questions:', '  > - why?'])
check('the next entry is intact', withB.includes('\n- [ ] 2026-11-15 12:31 two\n'), true)
check('parse ignores the block and flags the entry', parse(withB).map((e: any) => [e.text, e.hasRewrite]), [['one', true], ['two', false]])
check('entry line numbers do not move for the entry itself', parse(withB)[0]?.index, 5)
const redone = insertBlock(withB, 5, 'one', ['New.']) as string
check('a second block replaces the first', redone.split('\n').filter((l: string) => l.startsWith('  >')), ['  > New.'])
check('refuses when the line is no longer that entry', insertBlock(base, 5, 'different', ['x']), null)
check('refuses a non-entry line', insertBlock(base, 0, 'one', ['x']), null)
check('/triage still marks an entry that has a block', parse(mark(withB, 5, 'ticket') as string).map((e: any) => e.fate), ['ticket', null])
check('...and keeps the block', (mark(withB, 5, 'ticket') as string).includes('  > Do X.'), true)

console.log('answers')
check('blockLines strips the quote prefix and keeps blanks', blockLines(withB, 5), ['Prompt:', 'Do X.', '', 'Open questions:', '- why?'])
check('an entry with no block has no lines', blockLines(withB, 11), [])
check('a rewrite that asked is asking', isAskingOf(withB, 5), true)
check('a rewrite with no questions is not', isAskingOf(insertBlock(base, 5, 'one', ['Prompt:', 'Do X.']) as string, 5), false)
const a1 = addAnswer(withB, 5, 'one', '  prod only\n ') as string
check('first answer adds the section', blockLines(a1, 5).slice(-3), ['', 'Your answers:', 'prod only'])
const a2 = addAnswer(a1, 5, 'one', 'since Monday') as string
check('second answer is appended', answersIn(blockLines(a2, 5)), ['prod only', 'since Monday'])
check('answers do not touch the next entry', a2.includes('\n- [ ] 2026-11-15 12:31 two\n'), true)
check('no block: nowhere to put an answer', addAnswer(base, 5, 'one', 'x'), null)
check('blank answer is refused', addAnswer(withB, 5, 'one', '   '), null)
check('wrong entry text is refused', addAnswer(withB, 5, 'other', 'x'), null)
check('no answers section means none', answersIn(['Prompt:', 'Do X.']), [])

console.log(`\n${passed} passed, ${failures.length} failed`)
if (failures.length > 0) {
  process.exitCode = 1
}
