// Scenarios for hooks/resume.ts: the per-chat record that lets a chat you left
// and came back to show real elapsed time instead of "resumed".
//
// No dependencies. From cache-keeper/:
//   node --experimental-strip-types tests/resume.test.ts
// It prints one line per scenario and exits non-zero if any fails.

// Node needs the .ts extension; tsc and the validator do not all allow it.
// @ts-ignore
import { CHAT_PREFIX, MAX_CHATS, chatKey, excessKeys, restore } from '../hooks/resume.ts'

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

const NOW = 1_800_000_000_000
const SNAP = {
  lastAt: NOW - 11 * 60_000,
  lastRead: 80000,
  lastWrite: 500,
  turns: 8,
  spent: 2_400_000,
  hasNudged: false,
  held: false,
  ttl: 3600,
  evidence: 'ww',
}

// ── chatKey(): one stable key per chat ──────────────────────────────────────
console.log('chatKey: one key per chat')
check('the key starts with the prefix and holds the start time', chatKey(1700000000123), `${CHAT_PREFIX}1700000000123`)
check('the same start time always gives the same key', chatKey(42) === chatKey(42), true)
check('two chats started at different times get different keys', chatKey(1) === chatKey(2), false)
check('the prefix cannot be mistaken for the account-wide "ttl" key', chatKey(1) === 'ttl', false)

// ── restore(): trust nothing read back from the store ───────────────────────
console.log('restore: a good record comes back unchanged')
check('a full, valid record is returned as it was', restore(SNAP, NOW), SNAP)
check('a record read back through JSON is the same', restore(JSON.parse(JSON.stringify(SNAP)), NOW), SNAP)
check('a record from a moment ago (not yet in the past by much) is kept', restore({ ...SNAP, lastAt: NOW }, NOW), { ...SNAP, lastAt: NOW })
check('extra fields are dropped, not carried into state', restore({ ...SNAP, junk: 'x' }, NOW), SNAP)
check('a learned lifetime of 0 (not yet learned) is allowed', restore({ ...SNAP, ttl: 0, evidence: '' }, NOW), { ...SNAP, ttl: 0, evidence: '' })

console.log('restore: bad records are refused')
check('undefined (nothing stored) is refused', restore(undefined, NOW), null)
check('null is refused', restore(null, NOW), null)
check('a string is refused', restore('snap', NOW), null)
check('an array is refused', restore([SNAP], NOW), null)
check('a missing field is refused', restore({ ...SNAP, spent: undefined }, NOW), null)
check('a number stored as text is refused', restore({ ...SNAP, lastAt: '1' }, NOW), null)
check('a boolean stored as a number is refused', restore({ ...SNAP, held: 1 }, NOW), null)
check('a negative count is refused', restore({ ...SNAP, turns: -1 }, NOW), null)
check('a reply time in the future is refused', restore({ ...SNAP, lastAt: NOW + 1 }, NOW), null)
check('a reply time of 0 is refused: it says no reply was ever seen', restore({ ...SNAP, lastAt: 0 }, NOW), null)

// ── excessKeys(): keep the store small ──────────────────────────────────────
console.log('excessKeys: prune the oldest chats')
const chats = (n: number) => Array.from({ length: n }, (_, i) => chatKey(1000 + i))
check('at the limit, nothing is pruned', excessKeys(chats(MAX_CHATS)), [])
check('under the limit, nothing is pruned', excessKeys(chats(3)), [])
check('over the limit, the oldest (first inserted) go', excessKeys(chats(MAX_CHATS + 2)), [chatKey(1000), chatKey(1001)])
check('keys that are not chat records are never pruned', excessKeys(['ttl', ...chats(MAX_CHATS)]), [])
check('and they do not count toward the limit', excessKeys(['ttl', 'x', ...chats(MAX_CHATS + 1)]), [chatKey(1000)])
check('a smaller limit prunes more', excessKeys(chats(5), 2), [chatKey(1000), chatKey(1001), chatKey(1002)])

console.log(`\n${passed} passed, ${failures.length} failed`)
if (failures.length > 0) process.exitCode = 1
