// Slash-command registration for Brain Dump, kept free of engine imports so the
// tests can run it with a fake `command` object.
//
// Why this exists: `$.command.register` declares a command for one session, and
// the mod used to call it only from `session.start`. A session that loads the mod
// after that event (a resumed chat, plugins synced late, a surface attaching
// afterwards) then never got /dump, /triage, /answer or /rewrite, although the
// band still drew. Registering again is harmless (the engine replaces a name), so
// the mod now tries from several early events and stops once every command is in.

export type CommandSpec = { name: string; description: string }

export const COMMANDS: readonly CommandSpec[] = [
  { name: 'dump', description: 'Save a thought to the brain dump, or list the last five' },
  { name: 'triage', description: 'Sort the next unsorted brain-dump entry: ticket, note or discard' },
  { name: 'answer', description: 'Answer the open questions of the oldest rewritten entry; /rewrite redo then uses them' },
  { name: 'rewrite', description: 'Rewrite the oldest unsorted entry into a prompt for a Claude model, saved under it (uses Haiku)' },
]

// A plain function, not `$.command`: the plugin validator wants `$.command.register(...)` spelled
// out at its call site, so register.tsx passes `c => $.command.register(c)`.
export type Registrar = (c: CommandSpec) => Promise<unknown>
export type Failure = { name: string; reason: string }
export type RegState = { done: Set<string>; warned: boolean }

export function newState(): RegState {
  return { done: new Set(), warned: false }
}

export function isComplete(state: RegState, want: readonly CommandSpec[] = COMMANDS): boolean {
  return want.every(c => state.done.has(c.name))
}

// Registers every command not yet registered, one at a time, so one refusal does
// not stop the rest. Returns what failed and why (empty when all are in).
export async function ensureCommands(
  state: RegState,
  register: Registrar,
  want: readonly CommandSpec[] = COMMANDS,
): Promise<Failure[]> {
  const failed: Failure[] = []
  for (const c of want) {
    if (state.done.has(c.name)) {
      continue
    }
    try {
      await register(c)
      state.done.add(c.name)
    } catch (err) {
      failed.push({ name: c.name, reason: err instanceof Error ? err.message : String(err) })
    }
  }
  return failed
}

// One line for a toast, or null when there is nothing to say or it was already said.
export function failureNote(state: RegState, failed: readonly Failure[]): string | null {
  if (failed.length === 0 || state.warned) {
    return null
  }
  state.warned = true
  return `Brain Dump: could not register ${failed.map(f => `/${f.name} (${f.reason})`).join(', ')}.`
}
