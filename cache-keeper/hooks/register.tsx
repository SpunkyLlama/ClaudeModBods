import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import { classify, learn } from './lifetime'
import type { Snap } from '../types'

const PANE = 'cache-keeper'
const line = atom({ plugin: 'cache-keeper', key: 'line' } as const, '')
// Kept in session state, not module variables: the app may reload the module
// between turns, and these must survive that. Change the tag if Snap changes.
const snap = atom(
  { plugin: 'cache-keeper', key: 'snap' } as const,
  { lastAt: 0, lastRead: 0, lastWrite: 0, turns: 0, spent: 0, hasNudged: false, held: false, ttl: 0, evidence: '' },
  { shape: 'snap-3' },
)

const num = (v: unknown, fallback: number) =>
  typeof v === 'number' && v > 0 ? v : fallback

const k = (n: number) =>
  n >= 1_000_000 ? `${(n / 1e6).toFixed(1)}M` : n >= 1000 ? `${Math.round(n / 1000)}k` : `${n}`

const clock = (s: number) =>
  `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`

const HANDOFF_PROMPT =
  'Write a handoff note so a brand-new chat can continue this work with zero re-explaining. ' +
  'Markdown, under 400 words, no preamble. Sections: Goal; Decisions made (and why); ' +
  'Current state (files, commands, results); Open questions; Next steps; Preferences I have ' +
  'shown. Include exact names, paths and numbers. Omit anything that is only chit-chat.'

type Cfg = {
  ttl: number
  isAuto: boolean
  nudgeUsd: number
  nudgePct: number
  isTranscript: boolean
  isGuard: boolean
  isInChat: boolean
  guardPct: number
  resumeAwayMs: number
}

// The lifetime to count down from: what was learned, else the setting.
function ttlFor(s: Snap, cfg: Cfg) {
  return cfg.isAuto && s.ttl > 0 ? s.ttl : cfg.ttl
}

const lifeTag = (s: Snap, cfg: Cfg) => {
  const t = ttlFor(s, cfg)
  return `${t >= 3600 ? '1h' : t >= 300 ? `${Math.round(t / 60)}m` : `${t}s`}${cfg.isAuto && s.ttl > 0 ? '✓' : '?'}`
}

async function compute($: EngineInterface, cfg: Cfg) {
  const S = await read($, snap)
  const now = await $.clock.now()
  const u = await $.session.usage()
  const tokens = u.context.tokens ?? 0
  const pct = u.context.percent ?? 0
  const usd = u.cost?.usd ?? 0

  let cache = '⚪ cache: no data yet'
  let isCold = false
  // No reply seen by this mod yet, but the session already holds context and
  // began well before now: it was resumed. The cache lifetime has very likely
  // lapsed while it was away, so the first send re-caches the whole context.
  // Heuristic: startedAt is the first launch, not the last reply, so a resume
  // within the cache lifetime can still be warm; the wording says "probably".
  const isResumed =
    S.lastAt === 0 && tokens > 0 && u.startedAt > 0 && now - u.startedAt > cfg.resumeAwayMs
  if (isResumed) {
    isCold = true
    cache = `🧊 resumed · cache probably cold, next msg re-caches ~${k(tokens)}`
  } else if (S.lastAt > 0) {
    const left = ttlFor(S, cfg) - (now - S.lastAt) / 1000
    const total = S.lastRead + S.lastWrite
    const hit = total > 0 ? Math.round((100 * S.lastRead) / total) : 0
    if (left > 0) {
      cache = `🔥 warm ${clock(left)}${left < 60 ? ' ⚡reply soon' : ''} · ${hit}% hit · ${lifeTag(S, cfg)}`
    } else {
      isCold = true
      cache = `🧊 cold · next msg re-caches ~${k(tokens)}`
    }
  }

  const parts = [cache, `ctx ${k(tokens)} (${pct}%)`, `Σ ${k(S.spent)}`, `$${usd.toFixed(2)}`]
  const isHot = usd >= cfg.nudgeUsd || pct >= cfg.nudgePct
  if (isHot) {
    parts.push(
      isCold
        ? '⚠ cold + big context: /handoff, then start a new chat'
        : '⚠ getting pricey: /handoff, then start a new chat',
    )
  }
  return { text: parts.join('  │  '), isHot, pct, usd }
}

async function draw($: EngineInterface, cfg: Cfg) {
  const r = await compute($, cfg)
  $.ui.status(r.text) // where a surface draws status lines
  await update($, line, () => r.text) // band above the prompt and the pane
  return r
}

export const register: Register = (on, options) => {
  const cfg: Cfg = {
    ttl: num(options.cacheTtlSeconds, 3600),
    isAuto: options.autoDetectTtl !== false,
    nudgeUsd: num(options.nudgeCostUsd, 2),
    nudgePct: num(options.nudgeContextPercent, 60),
    isTranscript: options.transcriptLine !== false,
    isGuard: options.coldGuard !== false,
    isInChat: options.inChatLine === true,
    guardPct: num(options.coldGuardMinPercent, 20),
    resumeAwayMs: 60_000,
  }
  let timer: { cancel: () => void } | undefined

  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'cache',
      description: 'Show prompt-cache state, tokens and cost right now',
    })
    await $.command.register({
      name: 'handoff',
      description: 'Summarize this chat into HANDOFF.md to paste into a new chat',
    })
    void $.ui.open({ id: PANE, title: 'Cache Keeper' })
    // The lifetime belongs to the account, not the chat: reuse what an earlier
    // session learned.
    const saved = (await $.store.get('ttl')) as { ttl?: number; evidence?: string } | undefined
    if (saved && typeof saved.ttl === 'number' && saved.ttl > 0) {
      await update($, snap, s => (s.ttl > 0 ? s : { ...s, ttl: saved.ttl as number, evidence: String(saved.evidence ?? '') }))
    }
    timer?.cancel()
    timer = $.clock.every(5000, () => void draw($, cfg))
    await draw($, cfg)
    return next(e)
  })

  // The one event this app reliably raises. Record the reply's usage, and when
  // the reply is the turn's last (no tool call follows), say so in the chat.
  on('turn.step', async function* ($, e, next) {
    const r = yield* next(e)
    if (!r.usage) {
      return r
    }
    const x = r.usage
    // A subagent (or an engine fork) has its own prompt prefix: its reads and
    // writes say nothing about the main chat's cache. Count its tokens in the
    // running total, but keep it out of the cache state, the lifetime learner,
    // the nudge and the transcript line.
    if (e.agentId !== undefined) {
      await update($, snap, s => ({
        ...s,
        spent: s.spent + x.input_tokens + x.output_tokens + x.cache_read_input_tokens + x.cache_creation_input_tokens,
      }))
      return r
    }
    const now = await $.clock.now()
    const isFinal = r.stopReason !== 'tool_use'
    const before = await read($, snap)
    const mark =
      cfg.isAuto && before.lastAt > 0
        ? classify((now - before.lastAt) / 1000, x.cache_read_input_tokens, x.cache_creation_input_tokens)
        : null
    const learned = mark ? learn(before.evidence, mark, before.ttl) : null
    await update($, snap, s => ({
      ...s,
      ...(learned ?? {}),
      lastAt: now,
      lastRead: x.cache_read_input_tokens,
      lastWrite: x.cache_creation_input_tokens,
      spent: s.spent + x.input_tokens + x.output_tokens + x.cache_read_input_tokens + x.cache_creation_input_tokens,
      turns: isFinal ? s.turns + 1 : s.turns,
      held: false, // a fresh reply re-arms the cold-send guard
    }))
    if (learned) {
      await $.store.set('ttl', { ttl: learned.ttl, evidence: learned.evidence })
    }
    const d = await draw($, cfg)
    if (isFinal) {
      if (d.isHot && !(await read($, snap)).hasNudged) {
        await update($, snap, s => ({ ...s, hasNudged: true }))
        $.ui.toast(`Cache Keeper: ${d.pct}% context, $${d.usd.toFixed(2)}. Run /handoff, then start fresh.`)
      }
      if (cfg.isTranscript) {
        // a notice the model never reads: visible in the chat, costs no tokens
        await $.session.append({
          message: { type: 'system', content: [{ type: 'text', text: `cache-keeper: ${d.text}` }] },
        })
      }
    }
    return r
  })

  // Cold-send guard: once the cache has lapsed and the context is big enough to
  // matter, hold the first message and say what resending costs. Sending the same
  // message again goes through. Fails open: if this hook errors, the prompt passes.
  on('prompt.submit', async ($, e, next) => {
    if (!cfg.isGuard || e.isMeta || e.command !== undefined) {
      return next(e)
    }
    const s = await read($, snap)
    const now = await $.clock.now()
    const ttl = ttlFor(s, cfg)
    const isCold = s.lastAt > 0 && now - s.lastAt > ttl * 1000
    if (!isCold || s.held) {
      return next(e)
    }
    const { context } = await $.session.usage()
    if ((context.percent ?? 0) < cfg.guardPct) {
      return next(e)
    }
    await update($, snap, x => ({ ...x, held: true }))
    return {
      drop:
        `Cache Keeper: the cache expired ${clock((now - s.lastAt) / 1000 - ttl)} ago, so this message ` +
        `re-reads about ${k(context.tokens ?? 0)} tokens (${context.percent}% of context) uncached. ` +
        `Send it again to go ahead, or /handoff and start a fresh chat.`,
    }
  }).catch(($, e, next) => next(e))

  // In-chat status: AssistantMessage is raised on every attached surface, unlike
  // the band (terminal and desktop only). The line shows above the newest reply.
  let latestKey = ''
  on('ui.render', { component: 'AssistantMessage' }, async ($, e, next) => {
    if (!e.props.isFirstOfReply || !cfg.isInChat) {
      return next(e)
    }
    const key = e.props.text.slice(0, 60)
    latestKey = key
    const text = await read($, line)
    if (text === '' || key !== latestKey) {
      return next(e)
    }
    const { Box, Text } = $.ui.resolve(e)

    return (
      <Box flexDirection="column">
        <Text dimColor>{text}</Text>
        {await next(e)}
      </Box>
    )
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const text = await read($, line)
    if (e.props.hasSurvey || text === '') {
      return next(e)
    }
    const { Box, Text } = $.ui.resolve(e)

    return (
      <Box>
        <Text dimColor>{text}</Text>
      </Box>
    )
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const text = await read($, line)
    const { Box, Text } = $.ui.resolve(e)

    return (
      <Box flexDirection="column">
        <Text>{text === '' ? 'no data yet' : text}</Text>
      </Box>
    )
  })

  on('command.run', { command: 'cache' }, async $ => {
    const d = await compute($, cfg)
    const s = await read($, snap)
    const surfaces = await $.session.surfaces()
    const life =
      cfg.isAuto && s.ttl > 0
        ? `cache lifetime ${lifeTag(s, cfg)} learned (evidence ${s.evidence || 'none'})`
        : `cache lifetime ${lifeTag(s, cfg)} assumed, not yet learned`
    return {
      text:
        `${d.text}\n(${s.turns} turns seen; ${life}; display surfaces: ` +
        `${surfaces.length === 0 ? 'none attached, so no band/pane can draw' : surfaces.join(', ')})`,
    }
  })

  on('command.run', { command: 'handoff' }, async $ => {
    // the fork reads the existing transcript from the cache: cheapest while warm
    const r = await $.model.fork({ prompt: HANDOFF_PROMPT, effort: 'low' })
    if (!r.isAnswered) {
      return { text: `Cache Keeper: no handoff (${r.reason}). Nothing to summarize yet?` }
    }
    const path = `${await $.session.cwd()}/HANDOFF.md`
    await $.fs.write(path, r.text)
    const paid = r.usage.cache_creation_input_tokens
    return {
      text:
        `Handoff saved to ${path} (${paid > 1000 ? `cache was cold, re-cached ${k(paid)} tokens` : 'cache was warm, cheap'}).\n\n` +
        `${r.text}\n\n— Now start a new chat and paste this (Claude Code also has /clear). ` +
        `Or say "read HANDOFF.md and continue" if the new chat can see that file.`,
    }
  })
}
