import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import { EMPTY, addCard, addUsage, bandText, bump, fromTodoWrite, syncStatuses, taskCreated, taskUpdated, tokensOf } from './desk'
import { chatKey, excessKeys, restoreDesk } from './resume'

// All state lives in the session's state atom, not module variables: the app may
// reload the module between turns. Change the tag if Desk changes.
const desk = atom({ plugin: 'help-desk', key: 'desk' } as const, EMPTY, { shape: 'desk-2' })

const POLL_MS = 1500

// These hooks only watch. If one fails, the call it watched goes through as if it
// were not there: they never deny, rewrite or hold anything.
const OPEN = ($: any, e: any, next: any) => next(e)

const SAVE_EVERY_MS = 10_000 // subagent steps save at most this often

// Save and restore this chat's desk in the plugin's own store (resume.ts), so a chat you left
// and came back to keeps its list. Top-level so the validator follows `$`. Both fail open: a
// store problem must never break a session, and a missing record just means an empty band.
async function persist($: any) {
  try {
    const { startedAt } = await $.session.usage()
    const d = await read($, desk)
    if (typeof startedAt === 'number' && startedAt > 0 && (d.todos.length > 0 || d.cards.length > 0)) {
      await $.store.set(chatKey(startedAt), d)
    }
  } catch {
    // fail open
  }
}

async function restoreChat($: any) {
  try {
    const held = await read($, desk)
    if (held.todos.length > 0 || held.cards.length > 0) {
      return // a hot reload keeps state: nothing to restore
    }
    const { startedAt } = await $.session.usage()
    if (typeof startedAt === 'number' && startedAt > 0) {
      const saved = restoreDesk(await $.store.get(chatKey(startedAt)))
      if (saved) {
        await update($, desk, d => (d.todos.length > 0 || d.cards.length > 0 ? d : saved))
      }
    }
    for (const key of excessKeys((await $.store.keys()) as string[])) {
      await $.store.delete(key)
    }
  } catch {
    // fail open
  }
}

// Top-level, because the validator follows `$` only into top-level functions.
// $.agent.list() is how a finished subagent is noticed: the engine has no event
// for it, and drops the entry seconds after the agent ends.
async function poll($: any) {
  const before = await read($, desk)
  if (!before.cards.some(c => c.status === 'running' || c.status === 'idle')) {
    return // nothing to watch: no call, no redraw
  }
  const listed = (await $.agent.list()) as { id: string; status: string }[]
  const now = (await $.clock.now()) as number
  let isChanged = false
  await update($, desk, d => {
    const cards = syncStatuses(d.cards, listed, now)
    if (cards === d.cards) {
      return d
    }
    isChanged = true
    return { ...d, cards }
  })
  if (isChanged) {
    await persist($)
  }
}

export const register: Register = (on, options) => {
  // The debug row (userConfig `debug`) is always drawn and says what the hooks have seen.
  const isDebug = options.debug === true
  let timer: { cancel: () => void } | undefined
  let lastSavedAt = 0

  on('session.start', async ($, e, next) => {
    await restoreChat($)
    timer?.cancel()
    timer = $.clock.every(POLL_MS, () => void poll($))
    return next(e)
  })

  // ── To-do list (main loop only; a subagent's own list is not shown) ─────────

  on('tool.call', { tool: 'TodoWrite' }, async ($, e, next) => {
    const r = await next(e)
    await update($, desk, d => bump(d, 'calls'))
    if (e.agentId === undefined && r.deny === undefined && r.isError !== true) {
      const todos = fromTodoWrite((e as any).todos)
      await update($, desk, d => ({ ...d, todos }))
      await persist($)
    }
    return r
  }).catch(OPEN)

  on('tool.call', { tool: 'TaskCreate' }, async ($, e, next) => {
    const r = await next(e)
    await update($, desk, d => bump(d, 'calls'))
    if (e.agentId === undefined && r.deny === undefined && r.isError !== true) {
      const id = String((r.result as any)?.task?.id ?? '')
      await update($, desk, d => ({ ...d, todos: taskCreated(d.todos, id, String((e as any).subject ?? ''), (e as any).activeForm) }))
      await persist($)
    }
    return r
  }).catch(OPEN)

  on('tool.call', { tool: 'TaskUpdate' }, async ($, e, next) => {
    const r = await next(e)
    await update($, desk, d => bump(d, 'calls'))
    const ok = r.deny === undefined && r.isError !== true && (r.result as any)?.success !== false
    if (e.agentId === undefined && ok) {
      const a = e as any
      await update($, desk, d => ({
        ...d,
        todos: taskUpdated(d.todos, String(a.taskId ?? ''), { status: a.status, subject: a.subject, activeForm: a.activeForm }),
      }))
      await persist($)
    }
    return r
  }).catch(OPEN)

  // ── Subagents ───────────────────────────────────────────────────────────────

  // Start: observe only, the spawn goes through unchanged. A subagent this mod
  // started itself would step past plugin hooks, but this mod starts none.
  on('agent.spawn', async ($, e, next) => {
    const r = await next(e)
    await update($, desk, d => bump(d, 'spawns'))
    if (r.deny === undefined && r.agentId !== undefined) {
      const id = r.agentId
      const now = await $.clock.now()
      await update($, desk, d => ({
        ...d,
        cards: addCard(d.cards, { id, label: e.description, kind: e.subagentType, model: r.model, now }),
      }))
      await persist($)
    }
    return r
  }).catch(OPEN)

  // This mod READS SUBAGENT TURNS (unlike Cache Keeper, which ignores them): each
  // request a subagent makes adds its tokens to that subagent's card.
  on('turn.step', async function* ($, e, next) {
    const r = yield* next(e)
    if (e.agentId !== undefined && r.usage) {
      const id = e.agentId
      const tokens = tokensOf(r.usage)
      await update($, desk, d => ({ ...bump(d, 'steps'), cards: addUsage(d.cards, id, tokens) }))
      const now = (await $.clock.now()) as number
      if (now - lastSavedAt > SAVE_EVERY_MS) {
        lastSavedAt = now
        await persist($)
      }
    }
    return r
  })

  // ── The band ────────────────────────────────────────────────────────────────

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const text = bandText(await read($, desk), isDebug)
    if (e.props.hasSurvey || text === '') {
      return next(e)
    }
    const { Box, Text } = $.ui.resolve(e)
    return (
      <Box>
        <Text>{text}</Text>
      </Box>
    )
  })
}
