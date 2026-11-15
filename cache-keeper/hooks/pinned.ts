// The pinned list /handoff carries over. The handoff summary is rewritten from
// scratch each time and is under 400 words, so a long list does not survive it.
// Instead the list is read from a file the owner keeps (PLAN.md by default) and
// appended to HANDOFF.md verbatim.

// Returns the section whose heading line starts with `heading` (for example
// "## Projects"), from that line up to, not including, the next heading of the
// same or higher level. Null when there is no such heading or the section is empty.
// Fenced code blocks are skipped, so a "## " inside one does not end the section.
export function extractSection(text: string, heading: string): string | null {
  const level = /^#+/.exec(heading)?.[0].length ?? 0
  if (level === 0) {
    return null
  }
  const lines = text.split('\n')
  let start = -1
  let end = lines.length
  let isFenced = false
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? ''
    if (line.startsWith('```')) {
      isFenced = !isFenced
      continue
    }
    if (isFenced) {
      continue
    }
    const m = /^(#+) /.exec(line)
    if (start < 0) {
      if (m && line.startsWith(heading)) {
        start = i
      }
    } else if (m && (m[1] ?? '').length <= level) {
      end = i
      break
    }
  }
  if (start < 0) {
    return null
  }
  const body = lines.slice(start, end).join('\n').trim()
  return body.split('\n').length > 1 ? body : null
}

// HANDOFF.md as written: the summary, then the list under a rule and a note.
export function withPinned(summary: string, section: string | null, source: string): string {
  if (section === null) {
    return summary
  }
  return `${summary.trimEnd()}\n\n---\n\n<!-- Copied verbatim from ${source} by /handoff -->\n\n${section}\n`
}
