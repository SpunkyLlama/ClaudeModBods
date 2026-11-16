import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import { FATES, FILE, HEADER, addAnswer, answersIn, blockLines, fateAdvice, formatEntry, insertBlock, isAskingOf, mark, parse, stampOf, summary, triagePrompt, unsorted } from './dump'
import type { Fate } from './dump'
import { MODELS } from './guides'
import { MAX_ALL, blockText, buildRequest, formatOne, parseArgs, parseReply, resolveTarget, unknownTarget } from './rewrite'
import type { ModelKey } from './guides'

const count = atom({ plugin: 'brain-dump', key: 'unsorted' } as const, 0)

// Top-level functions, because the validator follows `$` only into these.
// Reads the file (missing = empty), the one place this mod looks.
async function load($: any) {
  const path = `${await $.session.cwd()}/${FILE}`
  const text = (await $.fs.exists(path)) ? ((await $.fs.read(path)) as string) : ''
  return { path, text }
}

async function refresh($: any, text: string) {
  await update($, count, () => unsorted(parse(text)).length)
}

// One Haiku call: the sub-agent that rewrites a note. No tools and no chat history,
// so it sees only the note and the guide notes. Top-level so the validator follows $.
async function rewriteOne($: any, text: string, key: ModelKey, answers: string[]) {
  const req = buildRequest(text, key, answers)
  const r = await $.model.complete({
    model: 'haiku',
    system: req.system,
    prompt: req.prompt,
    maxTokens: 1500,
    effort: 'low',
    timeoutMs: 45000,
  })
  return r as { isAnswered: boolean; text?: string; reason?: string; usage?: { input_tokens: number; output_tokens: number } }
}

export const register: Register = (on, options) => {
  const defaultTarget = typeof options.targetModel === 'string' && options.targetModel.trim() !== '' ? options.targetModel.trim() : 'opus'

  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'dump', description: 'Save a thought to the brain dump, or list the last five' })
    await $.command.register({ name: 'triage', description: 'Sort the next unsorted brain-dump entry: ticket, note or discard' })
    await $.command.register({ name: 'answer', description: 'Answer the open questions of the oldest rewritten entry; /rewrite redo then uses them' })
    await $.command.register({ name: 'rewrite', description: 'Rewrite the oldest unsorted entry into a prompt for a Claude model, saved under it (uses Haiku)' })
    await refresh($, (await load($)).text)
    return next(e)
  })

  on('command.run', { command: 'dump' }, async ($, e) => {
    const { path, text } = await load($)
    const line = formatEntry(e.args, await $.clock.now())
    if (line === null) {
      return { text: summary(parse(text)) }
    }
    const next = (text === '' ? HEADER : text.endsWith('\n') ? text : `${text}\n`) + `${line}\n`
    await $.fs.write(path, next)
    await refresh($, next)
    return { text: `Dumped. ${unsorted(parse(next)).length} unsorted.` }
  })

  on('command.run', { command: 'triage' }, async ($, e) => {
    const { path, text } = await load($)
    const open = unsorted(parse(text))
    const arg = e.args.trim().toLowerCase()
    const first = open[0]
    if (first === undefined) {
      return { text: 'Nothing to triage.' }
    }
    if (arg === '') {
      return { text: triagePrompt(first, open.length) }
    }
    if (!(FATES as readonly string[]).includes(arg)) {
      return { text: `Unknown verdict "${arg}". ${triagePrompt(first, open.length)}` }
    }
    const done = mark(text, first.index, arg as Fate)
    if (done === null) {
      return { text: 'That entry changed on disk; run /triage again.' }
    }
    await $.fs.write(path, done)
    await refresh($, done)
    const rest = unsorted(parse(done))
    const nextUp = rest[0]
    return {
      text: `${fateAdvice(arg as Fate)}\n${nextUp === undefined ? 'All sorted.' : triagePrompt(nextUp, rest.length)}`,
    }
  })

  on('command.run', { command: 'rewrite' }, async ($, e) => {
    const a = parseArgs(e.args, defaultTarget)
    const key = resolveTarget(a.target)
    if (key === null) {
      return { text: unknownTarget(a.target) }
    }
    const first = await load($)
    const all = unsorted(parse(first.text))
    // Plain /rewrite takes entries with no rewrite yet; "redo" takes ones that have one.
    const todo = all.filter(x => (a.isRedo ? x.hasRewrite : !x.hasRewrite)).slice(0, a.isAll ? MAX_ALL : 1)
    if (todo.length === 0) {
      return {
        text: all.length === 0
          ? 'Nothing to rewrite: no unsorted entries.'
          : a.isRedo
            ? 'No unsorted entry has a rewrite to redo yet. Run /rewrite first.'
            : 'Every unsorted entry already has a rewrite. Answer its questions with /answer, then /rewrite redo.',
      }
    }
    const done: { index: number; text: string; block: string[] }[] = []
    const out: string[] = []
    let tokensIn = 0
    let tokensOut = 0
    for (const entry of todo) {
      const answers = answersIn(blockLines(first.text, entry.index))
      const r = await rewriteOne($, entry.text, key, answers)
      if (!r.isAnswered || r.text === undefined) {
        out.push(`${entry.stamp}  ${entry.text}\n\nNo rewrite (${r.reason ?? 'no reply'}).`)
        continue
      }
      tokensIn += r.usage?.input_tokens ?? 0
      tokensOut += r.usage?.output_tokens ?? 0
      const parsed = parseReply(r.text)
      out.push(formatOne(entry.stamp, entry.text, key, parsed))
      done.push({ index: entry.index, text: entry.text, block: blockText(key, stampOf(await $.clock.now()), parsed, answers) })
    }
    // Save bottom-up so earlier line numbers stay valid, on a fresh read of the file:
    // an entry that changed during the calls is skipped, not overwritten.
    const fresh = await load($)
    let file = fresh.text
    let saved = 0
    for (const d of [...done].sort((x, y) => y.index - x.index)) {
      const next = insertBlock(file, d.index, d.text, d.block)
      if (next !== null) {
        file = next
        saved++
      }
    }
    if (saved > 0) {
      await $.fs.write(fresh.path, file)
    }
    const skipped = done.length - saved
    const left = all.length - todo.length
    return {
      text:
        out.join('\n\n---\n\n') +
        `\n\nRewritten by Haiku (${tokensIn} tokens in, ${tokensOut} out) for ${MODELS[key].label}. ` +
        `Saved ${saved} under the entr${saved === 1 ? 'y' : 'ies'} in ${FILE}.` +
        (skipped > 0 ? ` ${skipped} not saved: the file changed while Haiku was writing.` : '') +
        (a.isAll && left > 0 ? ` ${left} more unsorted (cap ${MAX_ALL} per run).` : ''),
    }
  })

  on('command.run', { command: 'answer' }, async ($, e) => {
    const { path, text } = await load($)
    const target = unsorted(parse(text)).find(x => x.hasRewrite && isAskingOf(text, x.index))
    if (target === undefined) {
      return { text: 'No rewritten entry is waiting on answers. Run /rewrite first.' }
    }
    const next = addAnswer(text, target.index, target.text, e.args)
    if (next === null) {
      return { text: `Usage: /answer <your answer>   (for: ${target.text})` }
    }
    await $.fs.write(path, next)
    return { text: `Noted under "${target.text}". Add more with /answer, or run /rewrite redo to have Haiku use your answers.` }
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const n = await read($, count)
    if (e.props.hasSurvey || n === 0) {
      return next(e)
    }
    const { Box, Text } = $.ui.resolve(e)
    return (
      <Box>
        <Text dimColor>Brain dump: {n} unsorted (/triage)</Text>
      </Box>
    )
  })
}
