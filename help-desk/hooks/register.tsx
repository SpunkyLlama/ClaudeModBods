import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import { EMPTY, addCard, addUsage, bandText, bump, ensureCommand, fromTodoWrite, paneLines, paneNote, spawnBegan, spawnEnded, startingOf, syncCards, taskCreated, taskUpdated, tokensOf } from './desk'
import type { CommandState } from './desk'
import type { Desk } from '../types'
import { chatKey, excessKeys, restoreDesk } from './resume'

// All state lives in the session's state atom, not module variables: the app may
// reload the module between turns. Change the tag if Desk changes.
const desk = atom({ plugin: 'help-desk', key: 'desk' } as const, EMPTY, { shape: 'desk-3' })

// Whether the pane drew the last time it was opened, for the debug row (see paneNote).
const pane = atom({ plugin: 'help-desk', key: 'pane' } as const, '')

const PANE = 'help-desk'
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

// Registers /helpdesk, once, and says so (one toast) if the engine refuses the name. Top-level so the
// validator follows `$`; it never throws, so the hooks that call it cannot break a session.
async function warmCommand($: any, state: CommandState) {
  try {
    const note = await ensureCommand(state, c => $.command.register(c))
    if (note !== null) {
      $.ui.toast(note)
    }
  } catch {
    // fail open
  }
}

// Counts a spawn under way (or its end) in the desk. Fails open: a store problem must never
// hold up or break the spawn it watches. Top-level so the validator follows `$`.
async function noteStarting($: any, change: (d: Desk) => Desk) {
  try {
    await update($, desk, change)
  } catch {
    // fail open
  }
}

// Top-level, because the validator follows `$` only into top-level functions.
// $.agent.list() is how a finished subagent is noticed (the engine has no event for it, and
// drops the entry seconds after the agent ends), and how a running one the spawn hook missed
// is found. So it is asked on every tick, even with no card: a call that changes nothing
// redraws nothing. Never throws: it runs from a timer.
async function poll($: any) {
  try {
    const listed = (await $.agent.list()) as { id: string; status: string; description?: string; type?: string; kind?: string }[]
    const now = (await $.clock.now()) as number
    let isChanged = false
    await update($, desk, d => {
      const cards = syncCards(d.cards, listed, now)
      if (cards === d.cards) {
        return d
      }
      isChanged = true
      return { ...d, cards }
    })
    if (isChanged) {
      await persist($)
    }
  } catch {
    // fail open: the next tick looks again
  }
}

export const register: Register = (on, options) => {
  // The debug row (userConfig `debug`) is always drawn and says what the hooks have seen.
  const isDebug = options.debug === true
  let timer: { cancel: () => void } | undefined
  let lastSavedAt = 0
  // Commands belong to a session, and a session can load this mod after session.start has fired,
  // so /helpdesk is registered from several early events until it is in (desk.ts, ensureCommand).
  const cmd: CommandState = { isDone: false, isWarned: false }

  on('session.start', async ($, e, next) => {
    await warmCommand($, cmd)
    await restoreChat($)
    await noteStarting($, d => (startingOf(d) === 0 ? d : { ...d, starting: 0 })) // a reload mid-spawn leaves a stale count
    timer?.cancel()
    timer = $.clock.every(POLL_MS, () => void poll($))
    return next(e)
  })

  on('session.attach', async ($, e, next) => {
    await warmCommand($, cmd)
    return next(e)
  }).catch(OPEN)

  on('prompt.submit', async ($, e, next) => {
    await warmCommand($, cmd)
    return next(e)
  }).catch(OPEN)

  // ── The pane: opened only by the person's /helpdesk, never on its own ───────

  on('command.run', { command: 'helpdesk' }, async $ => {
    const opened = await $.ui.open({ id: PANE, title: 'Help Desk' })
    await update($, pane, () => paneNote(opened))
    return {
      text: opened.isPlaced ? 'Help Desk pane opened.' : `Help Desk pane not drawn: ${opened.reason ?? 'no reason given'}.`,
    }
  })

  // The same desk the band reads, so a change redraws both. `placement` "widget" is the desktop
  // app's small form of a minimized pane: it gets the band's summary, which reads at a glance.
  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text } = $.ui.resolve(e)
    const d = await read($, desk)
    const rows = (e.viewport?.rows ?? 24) - 4
    const lines = paneLines(d, rows, { cols: e.props.bodyColumns, isGlance: e.props.placement === 'widget' })
    return (
      <Box flexDirection="column">
        {lines.map(l => (
          <Text bold={l.tone === 'bold'} dimColor={l.tone === 'dim'} color={l.tone === 'warn' ? 'warning' : undefined}>
            {l.text}
          </Text>
        ))}
      </Box>
    )
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

  // Start: observe only, the spawn goes through unchanged. "N starting…" shows from the moment
  // the hook is entered until the engine answers, so the band is not blank while a subagent
  // starts. A subagent this mod started itself would step past plugin hooks, but this mod starts none.
  on('agent.spawn', async ($, e, next) => {
    await noteStarting($, spawnBegan)
    try {
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
    } finally {
      await noteStarting($, spawnEnded)
    }
  }).catch(OPEN)

  // This mod READS SUBAGENT TURNS (unlike Cache Keeper, which ignores them): each
  // request a subagent makes adds its tokens to that subagent's card, and an agent met here
  // with no card yet (the spawn hook has not answered, or never will) gets one.
  on('turn.step', async function* ($, e, next) {
    const r = yield* next(e)
    if (e.agentId !== undefined && r.usage) {
      const id = e.agentId
      const tokens = tokensOf(r.usage)
      const now = (await $.clock.now()) as number
      const model = (r.usage as any).model as string | undefined
      await update($, desk, d => ({ ...bump(d, 'steps'), cards: addUsage(d.cards, id, tokens, { now, model }) }))
      if (now - lastSavedAt > SAVE_EVERY_MS) {
        lastSavedAt = now
        await persist($)
      }
    }
    return r
  })

  // ── The band ────────────────────────────────────────────────────────────────

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const text = bandText(await read($, desk), isDebug, await read($, pane))
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
