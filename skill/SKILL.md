---
name: agentaily-agent-loop-client
description: 在任意前端仓消费 @agentaily/agent-loop-client —— 让 @agentaily/agent-loop 直接跑在浏览器里:直连 DeepSeek(不经服务器)、session+memory 存 localStorage。做「客户端直连、国内快、数据留本地」的 agent 聊天前端,或把已有「服务端 /agent 端点」迁成「客户端直连」时查它。
---

# @agentaily/agent-loop-client 用法(给 Agent 看的自包含指南)

> 这是一个内部 npm 包的**用法 skill**:讲清「装哪、导出什么、怎么用、怎么迁移、有什么坑」,让任何前端仓里干活的 Agent 不必翻源码就能正确消费。包源码 / 进度见仓 `agentaily/agent-loop-client`(README + ROADMAP)。上游内核用法见 skill **`agentaily-agent-loop`**。

## 这是什么 / 为什么

`@agentaily/agent-loop`(runtime 无关的极简 agent loop 内核)的**客户端伴生包**:把同一套 loop **搬进浏览器**跑 ——
- **provider 直连 DeepSeek**(`api.deepseek.com`,已确认允许浏览器 CORS),**不经任何服务器**;
- **session + memory 存 `localStorage`**(数据全留在本地设备)。

**动机:** CF Worker 在中国国内(尤其移动端)访问慢 / 被限速;DeepSeek 本身是国内服务,浏览器直连很快。**绕开服务器 = 国内快 + 数据本地**。首个消费方是 **2bti**(前端 SPA)。

## 🔴 头号红线:只能【每用户 BYOK】,绝不打进公开 bundle

客户端直连 = **传给 `createClientAgent` 的 key 明文出现在浏览器**(网络请求里就能扒到)。DeepSeek 对此有**硬约束**(控制台原文):

> 「不要将 API key 暴露在浏览器或其他客户端代码中……为了保护你的帐户安全,**我们可能会自动禁用我们发现已公开泄露的 API key**。」

后果不是「被盗刷、低额度 key + 监控就能兜」那么轻 —— 是 **DeepSeek 官方主动扫描、【停用】泄露的 key** → 打进公开前端 bundle = key 随时被禁 = **app 直接挂**。

**所以本包唯一安全的用法 = 每用户 BYOK:**
- 终端用户在**运行时**填**自己的** DeepSeek key(设置项),存进**他自己浏览器的 `localStorage`**,**永不进你的仓库 / 公开 bundle**。这不算「公开泄露」——是用户自己的 key、在用户自己的浏览器里、风险自负。
- **绝不**把一个**共享的、app 自己的** key 打进前端(如 build-time `VITE_DEEPSEEK_KEY`)—— 会被 DeepSeek 扫到禁用,全员挂。
- 产品**没法让每个用户自带 key**时 → key 只能**服务端/代理持有**(CF Worker 里跑 `@agentaily/agent-loop`),前端只调你自己的 endpoint,**别用本包**。

配套见 skill **`deepseek-api-key`**(🔴 红线:DeepSeek key 不进公开客户端)。

## 装哪 / 导出什么

```bash
npm i @agentaily/agent-loop-client
```
`@agentaily/agent-loop` 作为依赖**自动带上**,不用单独装。

两个入口:
- `@agentaily/agent-loop-client` —— `createClientAgent`、`LocalSessionStore`、`LocalMemoryStore`、`StorageLike`,**并再导出上游全套**(`Agent`、`deepseek`、`openaiCompatible`、`defineTool`、`parseSkill`、`SkillRegistry`、`InMemory*Store`、`createSession`、`renderMemoryIndex`、`buildSystemPrompt` + 全部类型)→ 消费方只 import 本包即可。
- `@agentaily/agent-loop-client/adapters/local` —— `LocalSessionStore`、`LocalMemoryStore`、`StorageLike`(想自己 `new Agent(...)` 时直接拿适配器)。

## 最小用法

```ts
import { createClientAgent } from '@agentaily/agent-loop-client'

// BYOK:key 来自用户(设置项),存用户自己的 localStorage —— 不是打进 bundle 的常量
const apiKey = localStorage.getItem('deepseek_key') ?? promptUserForKey()

const agent = createClientAgent({
  apiKey,                                       // 🔴 必须是【用户自带】的 key(见头号红线)
  instructions: '你是一个简洁友好的助手。',
})

const res = await agent.run('你能做什么?')      // { text, session, steps, stoppedOnMaxSteps }
// 续接同一轮对话(历史在 localStorage 里):
await agent.run({ message: '再来一次', sessionId: res.session.id })
```

`createClientAgent` 返回的就是上游原生 `Agent`,`run` / `onStep` / 工具 / skills 全都能用。

## `createClientAgent(opts)` 速查

`apiKey`(必填,前端暴露)· `model`(默认 `deepseek()` 的默认模型)· `instructions` · `storage`(默认 `globalThis.localStorage`,可注入 `StorageLike` 做 SSR/测试)· `sessionPrefix`(默认 `'session:'`)· `memoryPrefix`(默认 `'memory:'`)· `tools` · `skills` · `builtins`(默认 true)· `maxSteps`(默认 8)· `temperature` · `maxTokens` · `onStep(event)`。

内部等价于:
```ts
new Agent({
  provider: deepseek({ apiKey, model }),
  sessions: new LocalSessionStore(storage, sessionPrefix),
  memory: new LocalMemoryStore(storage, memoryPrefix),
  instructions, tools, skills, builtins, maxSteps, temperature, maxTokens, onStep,
})
```

## 自己搭 Agent(要更多控制时)

```ts
import { Agent, deepseek } from '@agentaily/agent-loop-client'
import { LocalSessionStore, LocalMemoryStore } from '@agentaily/agent-loop-client/adapters/local'

const agent = new Agent({
  provider: deepseek({ apiKey }),
  sessions: new LocalSessionStore(),   // 默认 globalThis.localStorage,prefix 'session:'
  memory: new LocalMemoryStore(),      // 默认 globalThis.localStorage,prefix 'memory:'
})
```

`Local*Store` 都收一个可选 `StorageLike`(Web Storage 子集:`getItem/setItem/removeItem/key/length`)+ 可选 prefix。**SSR / Node / 测试**里没有 `globalThis.localStorage` → 注入自己的 `StorageLike`;都没有则**构造时即抛清晰错误**(不会拖到运行中才炸)。

## 从「服务端 /agent 端点」迁到「客户端直连」

已有 `POST /agent {message, sessionId} → {text, sessionId}`(Worker 里跑 `@agentaily/agent-loop`)想搬进浏览器:

```ts
// before — 走网络到你的 Worker
const r = await fetch('/agent', { method: 'POST', body: JSON.stringify({ message, sessionId }) })
const { text, sessionId } = await r.json()

// after — 无服务器,loop 在页面里跑
const agent = createClientAgent({ apiKey: DEEPSEEK_KEY })
const { text, session } = await agent.run({ message, sessionId })
```
换来:**去掉服务器 round-trip(国内快)+ 状态本地化**;代价:**key 暴露 → 只能每用户 BYOK**(见头号红线)。**反向**:凡 key 是 app 自己的、必须保密的调用,保留服务端 `/agent` 那条路,别搬进前端。

## 坑 / 注意

- **key 暴露 → 只能每用户 BYOK**(见「头号红线」)—— 这是本包最重要的约束;共享 app key 打进 bundle 会被 DeepSeek 自动禁用。
- **`localStorage` 是同步的**:适配器用 `async` 方法把同步读写包成 Promise 满足接口;单标签页够用。**多标签页并发写同一 session** 无锁,极端情况下后写覆盖前写(单用户聊天基本无碍)。
- **`localStorage` 有容量上限**(通常 ~5MB/域)且**明文**:别往 memory 里塞敏感大数据;长对话累积到上限会 `setItem` 抛错。
- **`memory.list()` 遍历 storage 全部 key 按 prefix 过滤**:同一 storage 里 session 与 memory 靠不同 prefix 隔离,别把两者 prefix 设成一样。
- **DeepSeek 模型 id 全小写**、会变更:`createClientAgent` 不传 `model` 就用 `deepseek()` 的默认;要改传 `model`。**别传 `model: undefined` 期望走默认**——本包已内部规避(只在 `model` 有值时才传给 `deepseek`),但你自己调 `deepseek({model: undefined})` 会踩上游 spread 覆盖默认的坑。
- **其余 loop 语义(maxSteps 护栏、工具异常降级、skills 渐进披露、memory 关键词搜索)**与上游一致 → 见 skill `agentaily-agent-loop`,不重复。
- **CORS**:直连打的是 `api.deepseek.com`(已允许浏览器);换别的 OpenAI 兼容端点时先确认对方允许浏览器 CORS,否则要回退服务端代理。

## 何时建 / 更新这个 skill

包的公开 API 变了 → **同一次改动**里更新本文件(与「文档与代码同步」纪律一致)。软链到全局供所有会话发现:
```bash
ln -s ~/agentaily/agent-loop-client/skill ~/.claude/skills/agentaily-agent-loop-client
```
