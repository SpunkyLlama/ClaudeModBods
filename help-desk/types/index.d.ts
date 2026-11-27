export type Todo = {
  id: string // TodoWrite: its position in the list; TaskCreate: the engine's task id
  text: string // what the item is
  active: string // the present-continuous form, shown while it is in progress
  status: 'pending' | 'in_progress' | 'completed'
}

export type Card = {
  id: string // the agent id every event of its loop carries
  label: string // the Agent call's short description of the task
  kind: string // the agent type (Explore, general-purpose, ...)
  model: string
  status: 'running' | 'idle' | 'done' | 'failed'
  tokens: number // tokens processed by its requests so far (cache reads included: not a bill)
  steps: number // model requests seen
  startedAt: number // ms
  seen: boolean // $.agent.list() has listed it at least once
  adopted?: boolean // met before the spawn hook named it (a subagent step or the agent list): its name is a placeholder until the spawn or the list says better
  activeAt?: number // ms of its latest model request; the grace for a card the list never shows runs from here
}

// How often each hook has fired since the chat began (for the debug row only): a task tool call
// seen, a subagent spawn seen, a subagent model request seen. Lets a live check tell "the hook
// never fires" from "it fires but nothing draws".
export type Seen = { calls: number; spawns: number; steps: number }

export type Desk = { todos: Todo[]; cards: Card[]; seen: Seen; starting: number } // starting: spawns whose hook was entered and not yet answered

// What claude-code's Shaped<Desk> is, written out: an atom created with { shape }
// needs its key declared this way, and the validator rejects a types file that
// imports anything.
export type DeskShaped = { shape: string; value: Desk }

declare module 'claude-code' {
  interface PluginState {
    'help-desk': { desk: DeskShaped; pane: string }
  }
}
