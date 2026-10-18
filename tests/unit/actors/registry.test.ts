import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { JsonStore, BlobValue, SetOptions, WriteResult, StoreEntry } from '../../../src/blobs.js'
import type { EncryptedSecret } from '../../../src/actors/crypto.js'
import type { ActorRecord } from '../../../src/actors/registry.js'
import {
  openActorRegistry,
  ActorAlreadyExistsError,
  ActorNotFoundError
} from '../../../src/actors/registry.js'

interface Entry {
  data: unknown
  etag: string
  metadata: Record<string, unknown> | null
}

class MemoryBlobStore {
  entries = new Map<string, Entry>()
  private counter = 0

  private nextEtag(): string {
    this.counter += 1
    return `etag-${this.counter}`
  }

  async getWithMetadata(key: string, _options: { type: 'json' }): Promise<unknown> {
    const entry = this.entries.get(key)
    if (entry === undefined) return null
    return { data: entry.data, etag: entry.etag, metadata: entry.metadata }
  }

  async setJSON(
    key: string,
    value: unknown,
    options?: { metadata?: Record<string, unknown>; onlyIfNew?: boolean; onlyIfMatch?: string }
  ): Promise<{ modified: boolean }> {
    const existing = this.entries.get(key)
    if (options?.onlyIfNew === true && existing !== undefined) return { modified: false }
    if (
      options?.onlyIfMatch !== undefined &&
      (existing === undefined || existing.etag !== options.onlyIfMatch)
    ) {
      return { modified: false }
    }
    this.entries.set(key, {
      data: value,
      etag: this.nextEtag(),
      metadata: options?.metadata ?? null
    })
    return { modified: true }
  }

  async list(options?: {
    prefix?: string
  }): Promise<{ blobs: Array<{ key: string; etag: string; metadata: Entry['metadata'] }> }> {
    const prefix = options?.prefix
    return {
      blobs: [...this.entries.entries()]
        .filter(([key]) => prefix === undefined || key.startsWith(prefix))
        .map(([key, entry]) => ({ key, etag: entry.etag, metadata: entry.metadata }))
    }
  }
}

class MemoryJsonStore implements JsonStore {
  entries = new Map<string, Entry>()
  setCalls: Array<{ key: string; options?: SetOptions }> = []
  failNextMatchWrite = false
  private counter = 0

  private nextEtag(): string {
    this.counter += 1
    return `etag-${this.counter}`
  }

  async get<T>(key: string): Promise<BlobValue<T>> {
    const entry = this.entries.get(key)
    if (entry === undefined) return { data: null, etag: null, metadata: null }
    return { data: entry.data as T, etag: entry.etag, metadata: entry.metadata }
  }

  async set<T>(key: string, value: T, options?: SetOptions): Promise<WriteResult> {
    this.setCalls.push({ key, options })
    if (this.failNextMatchWrite && options?.onlyIfMatch !== undefined) {
      this.failNextMatchWrite = false
      return { modified: false }
    }
    const existing = this.entries.get(key)
    if (options?.onlyIfNew === true && existing !== undefined) return { modified: false }
    if (
      options?.onlyIfMatch !== undefined &&
      (existing === undefined || existing.etag !== options.onlyIfMatch)
    ) {
      return { modified: false }
    }
    this.entries.set(key, {
      data: value,
      etag: this.nextEtag(),
      metadata: options?.metadata ?? null
    })
    return { modified: true }
  }

  async list(prefix?: string): Promise<StoreEntry[]> {
    return [...this.entries.entries()]
      .filter(([key]) => prefix === undefined || key.startsWith(prefix))
      .map(([key, entry]) => ({ key, etag: entry.etag, metadata: entry.metadata }))
  }
}

class BootstrapRaceStore extends MemoryJsonStore {
  competing: ActorRecord | null = null

  async set<T>(key: string, value: T, options?: SetOptions): Promise<WriteResult> {
    if (options?.onlyIfNew === true && this.entries.get(key) === undefined && this.competing !== null) {
      const competing = this.competing
      this.entries.set(key, {
        data: {
          schema: 1,
          rev: 1,
          updatedAt: competing.updatedAt,
          actors: { [competing.name]: competing }
        },
        etag: 'etag-race',
        metadata: null
      })
      return { modified: false }
    }

    return super.set(key, value, options)
  }
}

const hoisted = vi.hoisted(() => {
  const calls: Array<Record<string, unknown>> = []
  const stores = new Map<string, MemoryBlobStore>()

  function getStore(options: { name: string }): MemoryBlobStore {
    calls.push(options)
    let store = stores.get(options.name)
    if (store === undefined) {
      store = new MemoryBlobStore()
      stores.set(options.name, store)
    }
    return store
  }

  function reset(): void {
    calls.length = 0
    stores.clear()
  }

  return { calls, getStore, reset }
})

vi.mock('@netlify/blobs', () => ({
  getStore: (options: unknown) => hoisted.getStore(options as { name: string })
}))

function jwk(label: string): Record<string, unknown> {
  return { kty: 'EC', crv: 'P-256', kid: `https://example.com/${label}#main-key` }
}

function secret(label: string): EncryptedSecret {
  return { v: 1, iv: `iv-${label}`, ciphertext: `ciphertext-${label}`, tag: `tag-${label}` }
}

function readSecrets(store: MemoryJsonStore): Record<string, EncryptedSecret> {
  const doc = store.entries.get('secrets')?.data as { keys: Record<string, EncryptedSecret> } | undefined
  return doc?.keys ?? {}
}

function makeRegistry(): {
  registry: ReturnType<typeof openActorRegistry>
  registryStore: MemoryJsonStore
  secretStore: MemoryJsonStore
} {
  const registryStore = new MemoryJsonStore()
  const secretStore = new MemoryJsonStore()
  const registry = openActorRegistry({ registryStore, secretStore })
  return { registry, registryStore, secretStore }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

const ORIGINAL_ENV = process.env

beforeEach(() => {
  process.env = { ...ORIGINAL_ENV }
  delete process.env.ACTOR_REGISTRY_STORE
  delete process.env.ACTOR_SECRET_STORE
  hoisted.reset()
})

afterEach(() => {
  process.env = ORIGINAL_ENV
})

describe('getActor', () => {
  it('returns null on an empty registry', async () => {
    const { registry } = makeRegistry()

    expect(await registry.getActor('alice')).toBeNull()
  })
})

describe('createActor', () => {
  it('stores the registry record and the encrypted secret', async () => {
    const { registry, secretStore } = makeRegistry()

    const record = await registry.createActor({
      name: 'alice',
      publicKeyJwk: jwk('alice'),
      encryptedPrivateKey: secret('alice')
    })

    expect(record.name).toBe('alice')
    expect(record.publicKeyJwk).toEqual(jwk('alice'))
    expect(record.disabled).toBe(false)
    expect(record.createdAt).toBe(record.updatedAt)
    expect(record.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)

    expect(await registry.getActor('alice')).toEqual(record)
    expect(await registry.listActors()).toEqual([record])
    expect(readSecrets(secretStore).alice).toEqual(secret('alice'))
  })

  it('seeds a registry document and a secrets document', async () => {
    const { registry, registryStore, secretStore } = makeRegistry()

    await registry.createActor({
      name: 'alice',
      publicKeyJwk: jwk('alice'),
      encryptedPrivateKey: secret('alice')
    })

    const registryDoc = registryStore.entries.get('registry')?.data as {
      schema: number
      rev: number
      actors: Record<string, ActorRecord>
    }
    expect(registryDoc.schema).toBe(1)
    expect(Object.keys(registryDoc.actors)).toEqual(['alice'])

    const secretsDoc = secretStore.entries.get('secrets')?.data as { schema: number }
    expect(secretsDoc.schema).toBe(1)
  })

  it('throws ActorAlreadyExistsError and does not overwrite the existing record', async () => {
    const { registry, secretStore } = makeRegistry()
    const first = await registry.createActor({
      name: 'alice',
      publicKeyJwk: jwk('alice'),
      encryptedPrivateKey: secret('alice')
    })

    await expect(
      registry.createActor({
        name: 'alice',
        publicKeyJwk: jwk('other'),
        encryptedPrivateKey: secret('other')
      })
    ).rejects.toBeInstanceOf(ActorAlreadyExistsError)

    expect(await registry.getActor('alice')).toEqual(first)
    expect(readSecrets(secretStore).alice).toEqual(secret('alice'))
  })

  it('does not overwrite an actor created by a concurrent writer', async () => {
    const registryStore = new BootstrapRaceStore()
    const secretStore = new MemoryJsonStore()
    const registry = openActorRegistry({ registryStore, secretStore })
    registryStore.competing = {
      name: 'alice',
      publicKeyJwk: jwk('competing'),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      disabled: false
    }

    await expect(
      registry.createActor({
        name: 'alice',
        publicKeyJwk: jwk('loser'),
        encryptedPrivateKey: secret('loser')
      })
    ).rejects.toBeInstanceOf(ActorAlreadyExistsError)

    expect((await registry.getActor('alice'))?.publicKeyJwk).toEqual(jwk('competing'))
  })

  it('lists actors sorted by name ascending', async () => {
    const { registry } = makeRegistry()
    for (const name of ['carol', 'alice', 'bob']) {
      await registry.createActor({
        name,
        publicKeyJwk: jwk(name),
        encryptedPrivateKey: secret(name)
      })
    }

    expect((await registry.listActors()).map((actor) => actor.name)).toEqual([
      'alice',
      'bob',
      'carol'
    ])
  })
})

describe('disableActor', () => {
  it('sets disabled true and returns the updated record', async () => {
    const { registry } = makeRegistry()
    await registry.createActor({
      name: 'alice',
      publicKeyJwk: jwk('alice'),
      encryptedPrivateKey: secret('alice')
    })

    const disabled = await registry.disableActor('alice')

    expect(disabled.disabled).toBe(true)
    expect(await registry.getActor('alice')).toEqual(disabled)
  })

  it('throws ActorNotFoundError for an unknown name', async () => {
    const { registry } = makeRegistry()

    await expect(registry.disableActor('ghost')).rejects.toBeInstanceOf(ActorNotFoundError)
  })
})

describe('rotateActorKey', () => {
  it('replaces the public key and stored secret and updates updatedAt', async () => {
    const { registry, secretStore } = makeRegistry()
    const created = await registry.createActor({
      name: 'alice',
      publicKeyJwk: jwk('alice'),
      encryptedPrivateKey: secret('alice')
    })

    await delay(10)

    const rotated = await registry.rotateActorKey({
      name: 'alice',
      publicKeyJwk: jwk('alice-rotated'),
      encryptedPrivateKey: secret('alice-rotated')
    })

    expect(rotated.publicKeyJwk).toEqual(jwk('alice-rotated'))
    expect(rotated.createdAt).toBe(created.createdAt)
    expect(rotated.updatedAt).not.toBe(created.updatedAt)
    expect(rotated.disabled).toBe(false)
    expect(readSecrets(secretStore).alice).toEqual(secret('alice-rotated'))
    expect(await registry.getActor('alice')).toEqual(rotated)
  })

  it('throws ActorNotFoundError for an unknown name', async () => {
    const { registry } = makeRegistry()

    await expect(
      registry.rotateActorKey({
        name: 'ghost',
        publicKeyJwk: jwk('ghost'),
        encryptedPrivateKey: secret('ghost')
      })
    ).rejects.toBeInstanceOf(ActorNotFoundError)
  })
})

describe('compare-and-swap retry', () => {
  it('retries after a conflicting onlyIfMatch write without losing data', async () => {
    const { registry, registryStore } = makeRegistry()
    await registry.createActor({
      name: 'alice',
      publicKeyJwk: jwk('alice'),
      encryptedPrivateKey: secret('alice')
    })
    await registry.createActor({
      name: 'bob',
      publicKeyJwk: jwk('bob'),
      encryptedPrivateKey: secret('bob')
    })

    registryStore.failNextMatchWrite = true
    registryStore.setCalls = []

    const disabled = await registry.disableActor('alice')

    expect(disabled.disabled).toBe(true)
    const actors = await registry.listActors()
    expect(actors.map((actor) => actor.name)).toEqual(['alice', 'bob'])
    expect(actors.find((actor) => actor.name === 'alice')?.disabled).toBe(true)
    expect(actors.find((actor) => actor.name === 'bob')?.disabled).toBe(false)

    const matchWrites = registryStore.setCalls.filter(
      (call) => call.options?.onlyIfMatch !== undefined
    )
    expect(matchWrites).toHaveLength(2)
  })
})

describe('getEncryptedSecret', () => {
  it('returns the stored secret for a known name', async () => {
    const { registry } = makeRegistry()
    await registry.createActor({
      name: 'alice',
      publicKeyJwk: jwk('alice'),
      encryptedPrivateKey: secret('alice')
    })

    expect(await registry.getEncryptedSecret('alice')).toEqual(secret('alice'))
  })

  it('returns null for an unknown name', async () => {
    const { registry } = makeRegistry()

    expect(await registry.getEncryptedSecret('ghost')).toBeNull()
  })

  it('returns null when the secrets document does not exist', async () => {
    const { registry } = makeRegistry()

    expect(await registry.getEncryptedSecret('alice')).toBeNull()
  })
})

describe('listOrphanSecretNames', () => {
  it('returns secret names without a corresponding registry record', async () => {
    const { registry, registryStore } = makeRegistry()
    await registry.createActor({
      name: 'alice',
      publicKeyJwk: jwk('alice'),
      encryptedPrivateKey: secret('alice')
    })
    await registry.createActor({
      name: 'bob',
      publicKeyJwk: jwk('bob'),
      encryptedPrivateKey: secret('bob')
    })

    registryStore.entries.delete('registry')

    expect(await registry.listOrphanSecretNames()).toEqual(['alice', 'bob'])
  })

  it('returns an empty array when every secret has a record', async () => {
    const { registry } = makeRegistry()
    await registry.createActor({
      name: 'alice',
      publicKeyJwk: jwk('alice'),
      encryptedPrivateKey: secret('alice')
    })

    expect(await registry.listOrphanSecretNames()).toEqual([])
  })
})

describe('store names', () => {
  it('uses the default actor-registry and actor-secrets stores', async () => {
    const registry = openActorRegistry()

    await registry.listOrphanSecretNames()

    expect(hoisted.calls).toContainEqual({ name: 'actor-registry', consistency: 'strong' })
    expect(hoisted.calls).toContainEqual({ name: 'actor-secrets', consistency: 'strong' })
  })

  it('honours ACTOR_REGISTRY_STORE and ACTOR_SECRET_STORE overrides', async () => {
    process.env.ACTOR_REGISTRY_STORE = 'custom-registry'
    process.env.ACTOR_SECRET_STORE = 'custom-secrets'

    const registry = openActorRegistry()

    await registry.listOrphanSecretNames()

    expect(hoisted.calls).toContainEqual({ name: 'custom-registry', consistency: 'strong' })
    expect(hoisted.calls).toContainEqual({ name: 'custom-secrets', consistency: 'strong' })
    expect(hoisted.calls).not.toContainEqual({ name: 'actor-registry', consistency: 'strong' })
    expect(hoisted.calls).not.toContainEqual({ name: 'actor-secrets', consistency: 'strong' })
  })
})
