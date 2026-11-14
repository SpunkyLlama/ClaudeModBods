// Scenarios for hooks/lifetime.ts: classify() turns one reply into evidence,
// learn() turns evidence into a cache lifetime.
//
// No dependencies. From cache-keeper/:
//   node --experimental-strip-types tests/lifetime.test.ts
// It prints one line per scenario and exits non-zero if any fails.

import { classify, learn, MIN_GAP_S } from '../hooks/lifetime.ts'

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

// ── classify(gapS, read, write): 'w' warm after a long gap, 'c' cold after a
//    gap a 1-hour cache would survive, null when the reply proves nothing ──────
console.log('classify: the gap window')
check('gap just under 330 s says nothing, even when warm', classify(329, 50000, 0), null)
check('gap of exactly 330 s counts (warm)', classify(MIN_GAP_S, 50000, 0), 'w')
check('gap just under 330 s says nothing, even when cold', classify(329, 0, 50000), null)
check('gap of exactly 330 s counts (cold)', classify(MIN_GAP_S, 0, 50000), 'c')
check('a warm reply after 1 h is still warm evidence', classify(3600, 50000, 500), 'w')
check('a warm reply after 4000 s has no upper limit', classify(4000, 50000, 500), 'w')
check('cold at exactly 3300 s still counts', classify(3300, 0, 50000), 'c')
check('cold at 3301 s says nothing: a 1-hour cache is cold by then too', classify(3301, 0, 50000), null)

console.log('classify: size of the reply')
check('under 1000 tokens in total says nothing', classify(600, 500, 499), null)
check('exactly 1000 tokens, all read: warm', classify(600, 1000, 0), 'w')
check('exactly 1000 tokens, all written: cold', classify(600, 0, 1000), 'c')
check('read of 999 is too small to call warm', classify(600, 999, 100), null)
check('write of 999 is too small to call cold', classify(600, 500, 999), null)

console.log('classify: the 80% / 20% edges')
check('read share of exactly 80% is warm', classify(600, 80000, 20000), 'w')
check('read share just under 80% says nothing', classify(600, 79999, 20001), null)
check('read share just under 20% is cold', classify(600, 19999, 80001), 'c')
check('read share of exactly 20% says nothing', classify(600, 20000, 80000), null)
check('an even split says nothing', classify(600, 50000, 50000), null)

console.log('classify: sanity over a grid')
{
  let bothAnswers = 0
  let earlyHit = 0
  let outOfRangeCold = 0
  for (const gap of [0, 60, 329, 330, 600, 3300, 3301, 7200]) {
    for (const read of [0, 500, 1000, 20000, 80000, 200000]) {
      for (const write of [0, 500, 1000, 20000, 80000, 200000]) {
        const r = classify(gap, read, write)
        if (gap < MIN_GAP_S && r !== null) earlyHit++
        if (r === 'c' && gap > 3300) outOfRangeCold++
        if (r === 'w' && read < 0.8 * (read + write)) bothAnswers++
      }
    }
  }
  check('never an answer under 330 s', earlyHit, 0)
  check('never "cold" over 3300 s', outOfRangeCold, 0)
  check('never "warm" below an 80% read share', bothAnswers, 0)
}

// ── learn(evidence, mark, ttl) ───────────────────────────────────────────────
console.log('learn: a warm reply')
check('warm proves the 1-hour cache at once', learn('', 'w', 0), { evidence: 'w', ttl: 3600 })
check('warm overrides a learned 5 minutes', learn('cc', 'w', 300), { evidence: 'ccw', ttl: 3600 })

console.log('learn: cold replies')
check('one cold reply changes nothing (unlearned)', learn('', 'c', 0), { evidence: 'c', ttl: 0 })
check('one cold reply changes nothing (assumed 1 h)', learn('', 'c', 3600), { evidence: 'c', ttl: 3600 })
check('two cold replies in a row mean 5 minutes', learn('c', 'c', 3600), { evidence: 'cc', ttl: 300 })
check('two cold replies from unlearned mean 5 minutes', learn('c', 'c', 0), { evidence: 'cc', ttl: 300 })
check('a third cold reply keeps 5 minutes', learn('cc', 'c', 300), { evidence: 'ccc', ttl: 300 })
check('cold, warm, cold is not two in a row', learn('cw', 'c', 3600), { evidence: 'cwc', ttl: 3600 })
check('warm then two colds does count', learn('wc', 'c', 3600), { evidence: 'wcc', ttl: 300 })

console.log('learn: the evidence window')
check('evidence keeps only the last three marks (cold)', learn('wcw', 'c', 3600), { evidence: 'cwc', ttl: 3600 })
check('evidence keeps only the last three marks (warm)', learn('ccc', 'w', 300), { evidence: 'ccw', ttl: 3600 })
check('a long run of colds still reads as cc at the end', learn('wcc', 'c', 300), { evidence: 'ccc', ttl: 300 })

console.log('learn: a whole history, replayed')
{
  let s = { evidence: '', ttl: 0 }
  const steps: Array<['w' | 'c', number]> = [
    ['c', 0], //     one cold: still unknown
    ['c', 300], //   second cold in a row: 5 minutes
    ['w', 3600], //  a warm reply after a long gap: 1 hour after all
    ['c', 3600], //  a single cold (model switch?) does not undo it
    ['c', 300], //   but two in a row do
  ]
  const got: number[] = []
  for (const [mark] of steps) {
    s = learn(s.evidence, mark, s.ttl)
    got.push(s.ttl)
  }
  check('ttl after each reply: 0, 300, 3600, 3600, 300', got, steps.map(x => x[1]))
}

console.log(`\n${passed} passed, ${failures.length} failed`)
if (failures.length > 0) process.exitCode = 1
