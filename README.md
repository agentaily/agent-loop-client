# @agentaily/agent-loop-client

Run the agentaily **agent loop in the browser** — DeepSeek direct, `localStorage`-backed sessions + memory, **no server**.

A thin companion to [`@agentaily/agent-loop`](https://github.com/agentaily/agent-loop): same loop, skills, memory, and sessions, wired for the client. The model call goes **straight to `api.deepseek.com`** (which allows browser CORS) and all conversation + memory state persists **on the device**.

- **No server hop** — DeepSeek is a domestic (China) service; a direct call is much faster than routing through a Cloudflare Worker, especially on mobile networks in China.
- **Data stays local** — sessions and memory live in `localStorage`; nothing is sent anywhere but the model API.
- **One import** — re-exports the whole `@agentaily/agent-loop` surface, so consumers usually import just this package.

## 🔴 Key handling — read this first (per-user BYOK only)

Whatever key you pass to `createClientAgent` **runs in the browser and is visible in network traffic.** DeepSeek treats this seriously:

> DeepSeek's console: *"Do not expose your API key in browsers or other client-side code… to protect your account, we may **automatically disable API keys we find have been publicly leaked**."*

So the **only** safe way to use this package is **per-user BYOK**: the end user supplies **their own** DeepSeek key at runtime (a settings field), you store it in **their** `localStorage`, and it never enters your repo or public bundle. That's not a public leak — it's the user's key, in the user's browser, at their own risk.

**Do NOT bake a shared, app-owned key into the frontend** (e.g. a build-time `VITE_DEEPSEEK_KEY`). DeepSeek's scanner will find it and **disable it**, breaking the app for everyone — this is not something "a low-budget key + monitoring" fixes. If your product can't ask each user for their own key, keep the key **server-side** behind a proxy / Worker (use `@agentaily/agent-loop` on the server) and don't use this package.

See the [`deepseek-api-key`] discipline and this package's usage skill for the full rationale.

First consumer: the [`2bti`](https://2bti.agentaily.com) SPA (per-user BYOK).

## Install

```bash
npm i @agentaily/agent-loop-client
```

`@agentaily/agent-loop` comes along as a dependency — you don't install it separately.

## Quick start

```ts
import { createClientAgent } from '@agentaily/agent-loop-client'

// BYOK: the key comes from the user (a settings field), stored in THEIR
// localStorage — never a build-time constant baked into the bundle.
const apiKey = localStorage.getItem('deepseek_key') ?? promptUserForKey()

const agent = createClientAgent({
  apiKey,
  instructions: 'You are a concise, friendly assistant.',
})

const res = await agent.run('what can you do?')
console.log(res.text)

// Resume the same conversation later (history is in localStorage):
await agent.run({ message: 'and again', sessionId: res.session.id })
```

`createClientAgent` returns a plain `Agent` from `@agentaily/agent-loop`, so its
whole API (`run`, `onStep`, tools, skills, …) is available.

## What it wires for you

```ts
new Agent({
  provider: deepseek({ apiKey }),                 // straight to api.deepseek.com
  sessions: new LocalSessionStore(storage),       // localStorage, prefix 'session:'
  memory: new LocalMemoryStore(storage),          // localStorage, prefix 'memory:'
  instructions, tools, skills, builtins, maxSteps, temperature, maxTokens, onStep,
})
```

### `createClientAgent(opts)`

| option | default | notes |
| --- | --- | --- |
| `apiKey` | — | **required**; DeepSeek key — must be the **user's own** key (BYOK), never a baked-in shared key (see above) |
| `model` | `deepseek()` default | DeepSeek model id |
| `instructions` | — | base system prompt (persona / rules) |
| `storage` | `globalThis.localStorage` | any `StorageLike`; inject for SSR / tests |
| `sessionPrefix` | `'session:'` | key prefix for stored sessions |
| `memoryPrefix` | `'memory:'` | key prefix for stored memory records |
| `tools` | — | always-available app tools |
| `skills` | — | `Skill[]` / `SkillRegistry`, progressive disclosure |
| `builtins` | `true` | inject `load_skill` / `remember` / `recall` |
| `maxSteps` | `8` | provider round-trips before bailing |
| `temperature`, `maxTokens` | — | forwarded to the provider |
| `onStep` | — | `(event) => void` per loop step |

## Storage adapters

Two `localStorage`-backed stores implementing the core `SessionStore` /
`MemoryStore` interfaces. `createClientAgent` uses them for you; import directly
if you want to build the `Agent` yourself.

```ts
import { LocalSessionStore, LocalMemoryStore } from '@agentaily/agent-loop-client/adapters/local'
import { Agent, deepseek } from '@agentaily/agent-loop-client'

const agent = new Agent({
  provider: deepseek({ apiKey }),
  sessions: new LocalSessionStore(),      // defaults to globalThis.localStorage
  memory: new LocalMemoryStore(),
})
```

Both accept an optional `StorageLike` (a subset of the Web Storage API) and a
key prefix. Pass your own `StorageLike` for SSR, Node, or tests — if none is
given and `globalThis.localStorage` is absent, the constructor throws a clear
error rather than failing later.

## Re-exported from `@agentaily/agent-loop`

So you can import everything from here: `Agent`, `defineTool`, `SkillRegistry`,
`parseSkill`, `InMemorySessionStore`, `InMemoryMemoryStore`, `createSession`,
`renderMemoryIndex`, `buildSystemPrompt`, `openaiCompatible`, `deepseek`, plus
all the shared types (`LLMProvider`, `Tool`, `Skill`, `Session`,
`MemoryRecord`, `SessionStore`, `MemoryStore`, …).

## Migrating from a server `/agent` endpoint to client-direct

If you currently `POST /agent { message, sessionId } → { text, sessionId }` at
a Worker that runs `@agentaily/agent-loop`, moving the loop into the browser is
a straight swap:

```ts
// before — over the network to your Worker
const r = await fetch('/agent', { method: 'POST', body: JSON.stringify({ message, sessionId }) })
const { text, sessionId } = await r.json()

// after — no server; loop runs in the page
const agent = createClientAgent({ apiKey: DEEPSEEK_KEY })
const { text, session } = await agent.run({ message, sessionId })
```

You trade a server round-trip (and key secrecy) for latency and offline-friendly
local state — but only do this when the key is the **user's own** (BYOK). If the
key is app-owned and secret, keep the Worker path; a baked-in DeepSeek key gets
auto-disabled (see the key-handling section above).

## Develop

```bash
npm install
npm test          # vitest (fake storage — no network, no browser)
npm run typecheck
npm run build     # tsup -> dist (ESM + d.ts)
```

## License

MIT © agentaily
