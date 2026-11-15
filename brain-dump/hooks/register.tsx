import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import { FATES, FILE, HEADER, fateAdvice, formatEntry, mark, parse, summary, triagePrompt, unsorted } from './dump'
import type { Fate } from './dump'

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

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'dump', description: 'Save a thought to the brain dump, or list the last five' })
    await $.command.register({ name: 'triage', description: 'Sort the next unsorted brain-dump entry: ticket, note or discard' })
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
