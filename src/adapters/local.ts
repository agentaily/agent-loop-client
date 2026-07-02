import type { MemoryRecord, MemoryStore, Session, SessionStore } from '@agentaily/agent-loop'
import { createSession } from '@agentaily/agent-loop'

/**
 * Minimal subset of the browser `Storage` API (localStorage / sessionStorage)
 * we use. Declared locally so this package needs no DOM lib at the type level
 * and can be driven by an injected fake (tests) or a custom store (SSR/Node).
 * A real `localStorage` satisfies it structurally.
 */
export interface StorageLike {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
  key(index: number): string | null
  readonly length: number
}

/**
 * Resolve the backing store: an explicit `StorageLike`, else
 * `globalThis.localStorage`. Throws a clear error when neither is available
 * (e.g. SSR / Node without a shim) instead of failing obscurely later.
 */
function resolveStorage(storage?: StorageLike): StorageLike {
  const g = globalThis as unknown as { localStorage?: StorageLike }
  const s = storage ?? g.localStorage
  if (!s) {
    throw new Error(
      '@agentaily/agent-loop-client: no localStorage found on globalThis. ' +
        'Pass a StorageLike explicitly (e.g. for SSR / Node, or a custom store).',
    )
  }
  return s
}

/**
 * SessionStore backed by browser `localStorage` (or any `StorageLike`).
 * localStorage is synchronous; the async interface is satisfied by `async`
 * methods that resolve immediately. Conversation history lives entirely on the
 * client — nothing is sent to a server.
 */
export class LocalSessionStore implements SessionStore {
  private readonly storage: StorageLike

  constructor(
    storage?: StorageLike,
    private readonly prefix = 'session:',
  ) {
    this.storage = resolveStorage(storage)
  }

  async load(id: string): Promise<Session | null> {
    const raw = this.storage.getItem(this.prefix + id)
    return raw ? (JSON.parse(raw) as Session) : null
  }

  async save(session: Session): Promise<void> {
    session.updatedAt = Date.now()
    this.storage.setItem(this.prefix + session.id, JSON.stringify(session))
  }

  async create(id?: string, metadata?: Record<string, unknown>): Promise<Session> {
    const s = createSession(id, metadata)
    this.storage.setItem(this.prefix + s.id, JSON.stringify(s))
    return s
  }

  async delete(id: string): Promise<void> {
    this.storage.removeItem(this.prefix + id)
  }
}

/**
 * MemoryStore backed by browser `localStorage` (or any `StorageLike`). `list`
 * walks the store's keys filtered by prefix; `search` loads all records and
 * does keyword-overlap ranking — fine for the modest memory sizes a single
 * client accumulates. All facts stay on the device.
 */
export class LocalMemoryStore implements MemoryStore {
  private readonly storage: StorageLike

  constructor(
    storage?: StorageLike,
    private readonly prefix = 'memory:',
  ) {
    this.storage = resolveStorage(storage)
  }

  async get(key: string): Promise<MemoryRecord | null> {
    const raw = this.storage.getItem(this.prefix + key)
    return raw ? (JSON.parse(raw) as MemoryRecord) : null
  }

  async set(key: string, value: string, meta?: { tags?: string[] }): Promise<MemoryRecord> {
    const existing = await this.get(key)
    const now = Date.now()
    const record: MemoryRecord = {
      key,
      value,
      tags: meta?.tags ?? existing?.tags,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    }
    this.storage.setItem(this.prefix + key, JSON.stringify(record))
    return record
  }

  async list(): Promise<MemoryRecord[]> {
    const records: MemoryRecord[] = []
    for (let i = 0; i < this.storage.length; i++) {
      const name = this.storage.key(i)
      if (!name || !name.startsWith(this.prefix)) continue
      const raw = this.storage.getItem(name)
      if (raw) records.push(JSON.parse(raw) as MemoryRecord)
    }
    return records
  }

  async search(query: string): Promise<MemoryRecord[]> {
    const terms = query
      .toLowerCase()
      .split(/[^\p{L}\p{N}]+/u)
      .filter((t) => t.length > 1)
    const all = await this.list()
    if (terms.length === 0) return all
    return all
      .map((r) => {
        const hay = new Set(
          `${r.key} ${r.value} ${(r.tags ?? []).join(' ')}`
            .toLowerCase()
            .split(/[^\p{L}\p{N}]+/u),
        )
        let score = 0
        for (const t of terms) if (hay.has(t)) score++
        return { r, score }
      })
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((x) => x.r)
  }

  async delete(key: string): Promise<void> {
    this.storage.removeItem(this.prefix + key)
  }
}
