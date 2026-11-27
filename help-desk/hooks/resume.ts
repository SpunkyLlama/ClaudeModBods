// ── Per-chat record, so a chat you left and came back to keeps its list ──────
// The engine starts a fresh session (and a fresh state) when you return to a chat, so
// without this the to-do list and subagent cards were empty on return, and every later
// TaskUpdate was for a task the mod had never seen. The desk is saved here under the chat's
// start time (which stays the same across resumes) and restored at session.start. Only
// the to-do text, subagent labels and counters are stored: nothing from the conversation.
// Cache Keeper has its own copy of the shared helpers (mods are isolated); a test checks
// that the copies match.
import type { Card, Desk, Todo } from '../types'

export const CHAT_PREFIX = 'chat:'
export const MAX_CHATS = 50 // oldest records past this are deleted

export const chatKey = (startedAt: number) => `${CHAT_PREFIX}${startedAt}`

// Chat records to delete: the oldest (the store lists keys in insertion order)
// once there are more than `max`. Other keys, such as the account-wide "ttl", are left alone.
export function excessKeys(keys: string[], max: number = MAX_CHATS): string[] {
  const chats = keys.filter(key => key.startsWith(CHAT_PREFIX))
  return chats.length > max ? chats.slice(0, chats.length - max) : []
}

const MAX_TODOS = 200
const MAX_STORED_CARDS = 50
const TODO_STATUSES = ['pending', 'in_progress', 'completed']
const CARD_STATUSES = ['running', 'idle', 'done', 'failed']

const isText = (v: unknown): v is string => typeof v === 'string'
const isCount = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0
const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

function toTodo(v: unknown): Todo | null {
  if (!isObject(v) || !isText(v.id) || !isText(v.text) || !isText(v.active) || !TODO_STATUSES.includes(v.status as string)) {
    return null
  }
  return { id: v.id, text: v.text, active: v.active, status: v.status as Todo['status'] }
}

function toCard(v: unknown): Card | null {
  if (
    !isObject(v) || !isText(v.id) || !isText(v.label) || !isText(v.kind) || !isText(v.model) ||
    !CARD_STATUSES.includes(v.status as string) || !isCount(v.tokens) || !isCount(v.steps) ||
    !isCount(v.startedAt) || typeof v.seen !== 'boolean' ||
    (v.adopted !== undefined && typeof v.adopted !== 'boolean') || (v.activeAt !== undefined && !isCount(v.activeAt))
  ) {
    return null
  }
  return {
    id: v.id, label: v.label, kind: v.kind, model: v.model, status: v.status as Card['status'], tokens: v.tokens, steps: v.steps, startedAt: v.startedAt, seen: v.seen,
    ...(v.adopted === undefined ? {} : { adopted: v.adopted }),
    ...(v.activeAt === undefined ? {} : { activeAt: v.activeAt }),
  }
}

// A stored desk, checked field by field and copied, or null. Refused whole when anything is
// wrong (a fresh start is better than a half-trusted list), and when there is nothing in it.
// A record without counters (older state) gets zeros.
export function restoreDesk(raw: unknown): Desk | null {
  if (!isObject(raw) || !Array.isArray(raw.todos) || !Array.isArray(raw.cards)) {
    return null
  }
  if (raw.todos.length > MAX_TODOS || raw.cards.length > MAX_STORED_CARDS) {
    return null
  }
  const todos = raw.todos.map(toTodo)
  const cards = raw.cards.map(toCard)
  if (todos.some(t => t === null) || cards.some(c => c === null)) {
    return null
  }
  let seen = { calls: 0, spawns: 0, steps: 0 }
  if (raw.seen !== undefined) {
    const s = raw.seen
    if (!isObject(s) || !isCount(s.calls) || !isCount(s.spawns) || !isCount(s.steps)) {
      return null
    }
    seen = { calls: s.calls, spawns: s.spawns, steps: s.steps }
  }
  if (todos.length === 0 && cards.length === 0) {
    return null
  }
  // `starting` is never restored: a spawn under way in another session means nothing here.
  return { todos: todos as Todo[], cards: cards as Card[], seen, starting: 0 }
}
