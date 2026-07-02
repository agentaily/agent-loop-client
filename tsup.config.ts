import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts', 'src/adapters/local.ts'],
  format: ['esm'],
  target: 'es2022',
  dts: true,
  clean: true,
  sourcemap: true,
  treeshake: true,
  // @agentaily/agent-loop is a runtime dependency — kept external (tsup
  // externalizes anything in `dependencies` by default; declared here for clarity).
  external: ['@agentaily/agent-loop'],
})
