import { Agent, deepseek } from '@agentaily/agent-loop'
import type { AgentOptions, StepEvent } from '@agentaily/agent-loop'
import { LocalSessionStore, LocalMemoryStore, type StorageLike } from './adapters/local.js'

export interface CreateClientAgentOptions {
  /** DeepSeek API key. Runs client-side, so this key is exposed to the browser
   * (see the skill's "key exposure" note: use a dedicated low-budget key). */
  apiKey: string
  /** DeepSeek model id. Defaults to the `deepseek()` wrapper's default. */
  model?: string
  /** Base system instructions (persona / rules). */
  instructions?: string
  /** Backing store for sessions + memory. Defaults to `globalThis.localStorage`. */
  storage?: StorageLike
  /** Key prefix for stored sessions. Default `'session:'`. */
  sessionPrefix?: string
  /** Key prefix for stored memory records. Default `'memory:'`. */
  memoryPrefix?: string
  /** Always-available app tools. */
  tools?: AgentOptions['tools']
  /** Skills — loaded progressively via the built-in `load_skill` tool. */
  skills?: AgentOptions['skills']
  /** Auto-inject `load_skill` / `remember` / `recall`. Default true. */
  builtins?: boolean
  /** Max provider round-trips per run before bailing out. Default 8. */
  maxSteps?: number
  temperature?: number
  maxTokens?: number
  /** Observe each step of the loop. */
  onStep?: (event: StepEvent) => void
}

/**
 * Convenience wrapper: build an {@link Agent} wired for the browser — DeepSeek
 * as the provider, `localStorage` for both sessions and memory. No server sits
 * in the middle; the model call goes straight to `api.deepseek.com` and all
 * state persists on the device.
 *
 * ```ts
 * const agent = createClientAgent({ apiKey: DEEPSEEK_KEY, instructions: '…' })
 * const { text, session } = await agent.run('hi')
 * await agent.run({ message: 'and again', sessionId: session.id })
 * ```
 */
export function createClientAgent(opts: CreateClientAgentOptions): Agent {
  const {
    apiKey,
    model,
    instructions,
    storage,
    sessionPrefix,
    memoryPrefix,
    tools,
    skills,
    builtins,
    maxSteps,
    temperature,
    maxTokens,
    onStep,
  } = opts

  return new Agent({
    // Only pass `model` when set — passing `model: undefined` would override the
    // deepseek() default via object spread.
    provider: deepseek(model === undefined ? { apiKey } : { apiKey, model }),
    sessions: new LocalSessionStore(storage, sessionPrefix),
    memory: new LocalMemoryStore(storage, memoryPrefix),
    instructions,
    tools,
    skills,
    builtins,
    maxSteps,
    temperature,
    maxTokens,
    onStep,
  })
}
