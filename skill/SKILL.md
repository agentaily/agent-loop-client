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

## key 怎么给:两种正当用法

客户端直连 = **传给 `createClientAgent` 的 key 明文出现在浏览器**(网络请求里能扒到),这是「无服务器」的固有代价。两种正当用法,按产品选:

**① 嵌入 app 自己的 key(默认 · 2bti 就这么用)**
- 在**构建期**注入一把**共享的、app 自己的** DeepSeek key(如 `VITE_DEEPSEEK_KEY` 来自 CI/构建 secret —— **不进 git 源码**,但确实会随公开 bundle ship)。UX 最简:用户直接聊、零配置。
- 你接受 key 暴露,并**缓解**:**用专用低额度 key**(不是主账号大额 key,把盗刷面积框小)+ **监控消耗、设告警** + **定期轮换**(发现异常立刻换)。
- ⚠️ 随公开 bundle ship 的 key 可能被爬,DeepSeek 也可能**自动禁用它检测到已公开泄露的 key** —— 上面的轮换 + 监控正是为此兜底。别用「泄露/被禁了担不起」的 key。

**② 每用户 BYOK(更安全 · 可选)**
- 终端用户**运行时**填**自己的** key(设置项),存进**他自己的 `localStorage`**;没有 app 自己的 key 暴露、没有共享 key 可被盗刷。代价:得让每个用户自备 key。适合不想/不能集中掏钱跑量时。

两种用法**API 完全一样**——都是 `createClientAgent({ apiKey })`,只是 `apiKey` 从哪来不同。真要「key 必须保密、暴露担不起」→ 别放浏览器,回**服务端/代理持有**(CF Worker 跑 `@agentaily/agent-loop`)。配套见 skill **`deepseek-api-key`**。

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

// 默认:app 自己的 key,构建期注入(不进 git 源码)。BYOK 则改从用户的 localStorage 读,调用一样。
const apiKey = import.meta.env.VITE_DEEPSEEK_KEY

const agent = createClientAgent({
  apiKey,                                       // 来源见「key 怎么给」两种用法
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
换来:**去掉服务器 round-trip(国内快)+ 状态本地化**;代价:**key 进浏览器**——按「key 怎么给」选嵌入 app key(专用低额度 key + 监控 + 轮换)或每用户 BYOK。**反向**:凡 key 必须保密、暴露担不起的调用,保留服务端 `/agent` 那条路,别搬进前端。

## 坑 / 注意

- **key 会进浏览器**(见「key 怎么给」)—— 这是本包最重要的取舍;嵌入 app key 就务必配专用低额度 key + 监控 + 轮换(公开 bundle 里的 key 可能被爬 / 被 DeepSeek 检测泄露而禁用,靠轮换兜底)。
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
