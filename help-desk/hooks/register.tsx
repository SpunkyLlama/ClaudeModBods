import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import { EMPTY, addCard, addUsage, bandText, fromTodoWrite, syncStatuses, taskCreated, taskUpdated, tokensOf } from './desk'

// All state lives in the session's state atom, not module variables: the app may
// reload the module between turns. Change the tag if Desk changes.
const desk = atom({ plugin: 'help-desk', key: 'desk' } as const, EMPTY, { shape: 'desk-1' })

const POLL_MS = 1500

// These hooks only watch. If one fails, the call it watched goes through as if it
// were not there: they never deny, rewrite or hold anything.
const OPEN = ($: any, e: any, next: any) => next(e)

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
  await update($, desk, d => {
    const cards = syncStatuses(d.cards, listed, now)
    return cards === d.cards ? d : { ...d, cards }
  })
}

export const register: Register = on => {
  let timer: { cancel: () => void } | undefined

  on('session.start', async ($, e, next) => {
    timer?.cancel()
    timer = $.clock.every(POLL_MS, () => void poll($))
    return next(e)
  })

  // ── To-do list (main loop only; a subagent's own list is not shown) ─────────

  on('tool.call', { tool: 'TodoWrite' }, async ($, e, next) => {
    const r = await next(e)
    if (e.agentId === undefined && r.deny === undefined && r.isError !== true) {
      const todos = fromTodoWrite((e as any).todos)
      await update($, desk, d => ({ ...d, todos }))
    }
    return r
  }).catch(OPEN)

  on('tool.call', { tool: 'TaskCreate' }, async ($, e, next) => {
    const r = await next(e)
    if (e.agentId === undefined && r.deny === undefined && r.isError !== true) {
      const id = String((r.result as any)?.task?.id ?? '')
      await update($, desk, d => ({ ...d, todos: taskCreated(d.todos, id, String((e as any).subject ?? ''), (e as any).activeForm) }))
    }
    return r
  }).catch(OPEN)

  on('tool.call', { tool: 'TaskUpdate' }, async ($, e, next) => {
    const r = await next(e)
    const ok = r.deny === undefined && r.isError !== true && (r.result as any)?.success !== false
    if (e.agentId === undefined && ok) {
      const a = e as any
      await update($, desk, d => ({
        ...d,
        todos: taskUpdated(d.todos, String(a.taskId ?? ''), { status: a.status, subject: a.subject, activeForm: a.activeForm }),
      }))
    }
    return r
  }).catch(OPEN)

  // ── Subagents ───────────────────────────────────────────────────────────────

  // Start: observe only, the spawn goes through unchanged. A subagent this mod
  // started itself would step past plugin hooks, but this mod starts none.
  on('agent.spawn', async ($, e, next) => {
    const r = await next(e)
    if (r.deny === undefined && r.agentId !== undefined) {
      const id = r.agentId
      const now = await $.clock.now()
      await update($, desk, d => ({
        ...d,
        cards: addCard(d.cards, { id, label: e.description, kind: e.subagentType, model: r.model, now }),
      }))
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
      await update($, desk, d => ({ ...d, cards: addUsage(d.cards, id, tokens) }))
    }
    return r
  })

  // ── The band ────────────────────────────────────────────────────────────────

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const text = bandText(await read($, desk))
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
