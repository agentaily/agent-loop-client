# @agentaily/agent-loop-client

Run the agentaily **agent loop in the browser** — DeepSeek direct, `localStorage`-backed sessions + memory, **no server**.

A thin companion to [`@agentaily/agent-loop`](https://github.com/agentaily/agent-loop): same loop, skills, memory, and sessions, wired for the client. The model call goes **straight to `api.deepseek.com`** (which allows browser CORS) and all conversation + memory state persists **on the device**.

- **No server hop** — DeepSeek is a domestic (China) service; a direct call is much faster than routing through a Cloudflare Worker, especially on mobile networks in China.
- **Data stays local** — sessions and memory live in `localStorage`; nothing is sent anywhere but the model API.
- **One import** — re-exports the whole `@agentaily/agent-loop` surface, so consumers usually import just this package.

## Key handling — two ways to supply the DeepSeek key

Whatever key you pass to `createClientAgent` **runs in the browser and is visible in network traffic.** That's inherent to the no-server design. There are two legitimate ways to supply it — pick per product:

**1. Embed the app's own key (default — what `2bti` does).** Inject a shared, app-owned DeepSeek key at **build time** (e.g. a `VITE_DEEPSEEK_KEY` from a CI/build secret — kept out of git source, but it does ship in the public bundle). Simplest UX: users just chat, no setup. You accept that the key is exposed, and **mitigate**:

- use a **dedicated, low-budget key** (not your main account key) so the blast radius of abuse is capped;
- **monitor spend** and set alerts;
- **rotate** the key on a schedule (and immediately if you see abuse).

> Heads-up: a key that ships in a public bundle can be scraped, and DeepSeek may auto-disable a key it detects as publicly leaked — the rotation + monitoring above are exactly how you stay ahead of that. Don't use a key you can't afford to have leaked or disabled.

**2. Per-user BYOK (more secure, optional).** The end user pastes **their own** DeepSeek key at runtime (a settings field); you store it in **their** `localStorage`. Nothing app-owned is exposed and there's no shared key to abuse — at the cost of asking each user for a key. Good when you can't or don't want to fund usage centrally.

Either way the API is the same — `createClientAgent({ apiKey })`; only where `apiKey` comes from differs. If a key must stay secret (app-owned and you can't tolerate exposure), don't put it in the browser at all: keep it **server-side** behind a proxy / Worker running `@agentaily/agent-loop`.

First consumer: the [`2bti`](https://2bti.agentaily.com) SPA (embedded app key).

## Install

```bash
npm i @agentaily/agent-loop-client
```

`@agentaily/agent-loop` comes along as a dependency — you don't install it separately.

## Quick start

```ts
import { createClientAgent } from '@agentaily/agent-loop-client'

// Default: the app's own key, injected at build time (kept out of git source).
// For per-user BYOK, read the user's key from localStorage instead — same call.
const apiKey = import.meta.env.VITE_DEEPSEEK_KEY

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
| `apiKey` | — | **required**; DeepSeek key — an embedded app key or the user's own (see [Key handling](#key-handling--two-ways-to-supply-the-deepseek-key)) |
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
local state. The key then lives in the browser — supply it as an embedded app
key (with a dedicated low-budget key + monitoring + rotation) or via per-user
BYOK (see [Key handling](#key-handling--two-ways-to-supply-the-deepseek-key)).
If a key must stay secret and you can't tolerate exposure, keep the Worker path.

## Develop

```bash
npm install
npm test          # vitest (fake storage — no network, no browser)
npm run typecheck
npm run build     # tsup -> dist (ESM + d.ts)
```

## License

MIT © agentaily
