// Scenarios for hooks/pinned.ts. No dependencies. From cache-keeper/:
//   node --experimental-strip-types tests/pinned.test.ts
// Prints one line per scenario and exits non-zero if any fails.

// @ts-ignore
import { extractSection, withPinned } from '../hooks/pinned.ts'

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

const doc = [
  '# PLAN',
  '## Working state',
  'old',
  '## Projects (the list; keep it current)',
  '1. one',
  '```',
  '## not a heading',
  '```',
  '### sub heading',
  '2. two',
  '## Deferred',
  '- x',
].join('\n')

console.log('extractSection')
const sec = extractSection(doc, '## Projects') as string
check('starts at the heading (prefix match)', sec.split('\n')[0], '## Projects (the list; keep it current)')
check('ends before the next ## heading', sec.split('\n').at(-1), '2. two')
check('keeps a ### subheading inside', sec.includes('### sub heading'), true)
check('a ## inside a code fence does not end it', sec.includes('## not a heading'), true)
check('missing heading is null', extractSection(doc, '## Nope'), null)
check('heading with no body is null', extractSection('## Projects\n## Next\nx', '## Projects'), null)
check('last section runs to end of file', extractSection('## Projects\na\nb', '## Projects'), '## Projects\na\nb')
check('a heading with no # is refused', extractSection(doc, 'Projects'), null)

console.log('withPinned')
check('no section leaves the summary untouched', withPinned('sum', null, 'PLAN.md'), 'sum')
const out = withPinned('sum\n', '## Projects\na', 'PLAN.md')
check('summary comes first', out.startsWith('sum\n\n---'), true)
check('section appended verbatim, with its source named', out.endsWith('Copied verbatim from PLAN.md by /handoff -->\n\n## Projects\na\n'), true)

console.log(`\n${passed} passed, ${failures.length} failed`)
if (failures.length > 0) {
  process.exitCode = 1
}
