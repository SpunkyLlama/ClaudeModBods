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
}

export type Desk = { todos: Todo[]; cards: Card[] }

// What claude-code's Shaped<Desk> is, written out: an atom created with { shape }
// needs its key declared this way, and the validator rejects a types file that
// imports anything.
export type DeskShaped = { shape: string; value: Desk }

declare module 'claude-code' {
  interface PluginState {
    'help-desk': { desk: DeskShaped }
  }
}
