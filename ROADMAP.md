# ROADMAP · @agentaily/agent-loop-client

以**能力**为粒度跟踪。谁 ship 一个能力就在同一次改动里更新这里。细节链到 README / 各 PR。

本包是 [`@agentaily/agent-loop`](https://github.com/agentaily/agent-loop) 的**客户端伴生包**:让同一套 agent loop 直接跑在浏览器里,直连 DeepSeek、状态存 localStorage、不经服务器。

## ✅ 已完成 (v0.1.0)

- **脚手架**:镜像 `@agentaily/agent-loop` —— TS + tsup(ESM + d.ts)+ vitest;`@agentaily/agent-loop` 作运行时依赖(tsup external,不 bundle)。`npm test/typecheck/build` 全绿。
- **localStorage 存储适配器**:`LocalSessionStore` / `LocalMemoryStore`(`@agentaily/agent-loop-client/adapters/local`),实现核心 `SessionStore` / `MemoryStore` 接口;`StorageLike`(Web Storage 子集)可注入(测试 / SSR);缺 `globalThis.localStorage` 时构造即抛清晰错误。`memory.list()` 按 prefix 遍历 storage key,与 session key 隔离。
- **客户端便捷封装**:`createClientAgent(opts)` —— 一把梭把 `provider: deepseek` + `sessions/memory: Local*Store` 接好,返回原生 `Agent`;透传 `instructions / tools / skills / builtins / maxSteps / temperature / maxTokens / onStep`。
- **一站式再导出**:从 `@agentaily/agent-loop` re-export `Agent / deepseek / defineTool / parseSkill / …` + 全部类型,消费方只 import 本包即可。
- **文档**:README(直连动机 / key 暴露警示 / API 表 / 从服务端迁移)+ 用法 skill(`skill/SKILL.md`)。
- **changesets 自动发版**:镜像 agent-loop —— `.changeset` 配置 + `release.yml`(agentaily-release-bot App token 开 Version PR + auto-merge)+ npm 发布走 vault 的 `npm-yarnovo-publish` token(`NPM_TOKEN` 仓 secret,含 provenance)。首发 0.1.0 走完整条链。

## 🚧 进行中 / 待办

- **被 2bti(前端 SPA)消费**:把 2bti 从「服务端 /agent 端点」切到「客户端直连 DeepSeek」,绕开 CF Worker 在国内的慢/限速(在 2bti 仓开 PR)。**key 方案已定 = 嵌入 app 自己的 key**(构建期注入、不进 git 源码;接受暴露风险,缓解 = 专用低额度 key + 监控 + 轮换)。`createClientAgent({apiKey})` 也支持每用户 BYOK 作为更安全可选项,但 2bti 走嵌入。
- **可选 sessionStorage / 自定义 store 预设**:除 localStorage 外,给 sessionStorage(会话级)与 IndexedDB 适配器留口子。
- **流式输出**:随上游 `@agentaily/agent-loop` 的 `agent.stream()` 落地后,补客户端打字机示例。
- **用法 skill 软链**:`ln -s ~/agentaily/agent-loop-client/skill ~/.claude/skills/agentaily-agent-loop-client`(见 skill 内说明)。

## 📎 关联

- 上游内核:`@agentaily/agent-loop`(runtime 无关的 agent loop 内核;本包只加客户端接线)。
- 消费方(首个):`2bti`(前端 SPA,https://2bti.agentaily.com)。
- 生态:`@agentaily/design-system`(UI 上游);SOP 见全局 `~/.claude/SOP.md`。
