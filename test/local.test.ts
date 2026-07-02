import { describe, it, expect } from 'vitest'
import { LocalSessionStore, LocalMemoryStore, type StorageLike } from '../src/adapters/local.js'

/** A Map-backed StorageLike — mirrors the Web Storage API for tests / SSR. */
function fakeStorage(): StorageLike {
  const map = new Map<string, string>()
  return {
    getItem: (k) => (map.has(k) ? map.get(k)! : null),
    setItem: (k, v) => {
      map.set(k, v)
    },
    removeItem: (k) => {
      map.delete(k)
    },
    key: (i) => [...map.keys()][i] ?? null,
    get length() {
      return map.size
    },
  }
}

describe('LocalSessionStore', () => {
  it('creates, saves, loads and deletes sessions', async () => {
    const store = new LocalSessionStore(fakeStorage())
    const s = await store.create('sess_1')
    expect(s.id).toBe('sess_1')

    s.messages.push({ role: 'user', content: 'hi' })
    await store.save(s)

    const loaded = await store.load('sess_1')
    expect(loaded?.messages.length).toBe(1)
    expect(loaded?.messages[0]?.content).toBe('hi')

    await store.delete('sess_1')
    expect(await store.load('sess_1')).toBeNull()
  })

  it('writes under the given prefix', async () => {
    const storage = fakeStorage()
    const store = new LocalSessionStore(storage, 'sess:')
    await store.create('a')
    expect(storage.getItem('sess:a')).toBeTruthy()
    expect(storage.getItem('session:a')).toBeNull()
  })

  it('throws a clear error when no storage is available', () => {
    // vitest runs with environment: 'node' → no globalThis.localStorage.
    expect(() => new LocalSessionStore()).toThrow(/localStorage/)
  })
})

describe('LocalMemoryStore', () => {
  it('sets, gets, and preserves createdAt on update', async () => {
    const mem = new LocalMemoryStore(fakeStorage())
    const a = await mem.set('fav-color', 'blue')
    expect((await mem.get('fav-color'))?.value).toBe('blue')

    const b = await mem.set('fav-color', 'green')
    expect(b.createdAt).toBe(a.createdAt)
    expect(b.value).toBe('green')
    expect((await mem.list()).length).toBe(1)
  })

  it('list() returns only its own prefix, ignoring session keys in the same store', async () => {
    const storage = fakeStorage()
    const sessions = new LocalSessionStore(storage)
    await sessions.create('s1')

    const mem = new LocalMemoryStore(storage)
    await mem.set('k1', 'v1')
    await mem.set('k2', 'v2')

    const keys = (await mem.list()).map((r) => r.key).sort()
    expect(keys).toEqual(['k1', 'k2'])
  })

  it('keyword search ranks matching records and drops non-matches', async () => {
    const mem = new LocalMemoryStore(fakeStorage())
    await mem.set('pet', 'the user has a cat named Milo')
    await mem.set('car', 'the user drives a red truck')

    const hits = await mem.search('cat')
    expect(hits.length).toBe(1)
    expect(hits[0]!.key).toBe('pet')
  })

  it('deletes records', async () => {
    const mem = new LocalMemoryStore(fakeStorage())
    await mem.set('k', 'v')
    await mem.delete('k')
    expect(await mem.get('k')).toBeNull()
  })
})
