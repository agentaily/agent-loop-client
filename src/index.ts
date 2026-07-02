// @agentaily/agent-loop-client — run the agentaily agent loop directly in the
// browser: DeepSeek direct, localStorage-backed sessions + memory, no server.

export { createClientAgent } from './client.js'
export type { CreateClientAgentOptions } from './client.js'

export { LocalSessionStore, LocalMemoryStore } from './adapters/local.js'
export type { StorageLike } from './adapters/local.js'

// Re-export the core agent loop so consumers only need to import this one
// package (no separate `@agentaily/agent-loop` import for common cases).
export {
  Agent,
  defineTool,
  SkillRegistry,
  parseSkill,
  InMemorySessionStore,
  InMemoryMemoryStore,
  createSession,
  newId,
  renderMemoryIndex,
  buildSystemPrompt,
  openaiCompatible,
  deepseek,
} from '@agentaily/agent-loop'

export type {
  AgentOptions,
  RunInput,
  RunResult,
  StepEvent,
  BuildPromptOptions,
  OpenAICompatibleOptions,
  JSONSchema,
  Role,
  Message,
  ToolCall,
  ToolSpec,
  Tool,
  ToolHandler,
  ToolContext,
  Skill,
  Session,
  MemoryRecord,
  SessionStore,
  MemoryStore,
  LLMRequest,
  LLMResponse,
  LLMProvider,
} from '@agentaily/agent-loop'
