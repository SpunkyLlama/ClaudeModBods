// ── Per-chat record, so a chat you left and came back to keeps its clock ─────
// The engine starts a fresh session (and a fresh state) when you return to a
// chat, so without this the mod sees "no reply yet" and guesses "resumed". Each
// reply is saved here under the chat's start time (which stays the same across
// resumes), and session.start restores it. Only numbers and flags are stored:
// no prompt text, no file names.
import type { Snap } from '../types'

export const CHAT_PREFIX = 'chat:'
export const MAX_CHATS = 50 // oldest records past this are deleted

export const chatKey = (startedAt: number) => `${CHAT_PREFIX}${startedAt}`

const isCount = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0
const isFlag = (v: unknown): v is boolean => typeof v === 'boolean'

// A stored record, checked field by field and copied, or null. A record is
// refused unless it holds a real reply time that is not in the future: a record
// that says "no reply yet" or comes from a skewed clock must not look warm.
export function restore(raw: unknown, now: number): Snap | null {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return null
  }
  const r = raw as Record<string, unknown>
  if (
    !isCount(r.lastAt) || r.lastAt === 0 || r.lastAt > now ||
    !isCount(r.lastRead) || !isCount(r.lastWrite) || !isCount(r.turns) ||
    !isCount(r.spent) || !isCount(r.ttl) ||
    !isFlag(r.hasNudged) || !isFlag(r.held) || typeof r.evidence !== 'string'
  ) {
    return null
  }
  return {
    lastAt: r.lastAt,
    lastRead: r.lastRead,
    lastWrite: r.lastWrite,
    turns: r.turns,
    spent: r.spent,
    hasNudged: r.hasNudged,
    held: r.held,
    ttl: r.ttl,
    evidence: r.evidence,
  }
}

// Chat records to delete: the oldest (the store lists keys in insertion order)
// once there are more than `max`. Other keys, such as the account-wide "ttl", are left alone.
export function excessKeys(keys: string[], max: number = MAX_CHATS): string[] {
  const chats = keys.filter(key => key.startsWith(CHAT_PREFIX))
  return chats.length > max ? chats.slice(0, chats.length - max) : []
}
