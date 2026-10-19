import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { ActorRecord, ActorRegistry } from '../../../src/actors/registry.js'
import type { ActorKeys } from '../../../src/actors/keys.js'
import { deriveActorConfig } from '../../../src/actors/config.js'
import { openActorResolver } from '../../../src/actors/resolve.js'

const hoisted = vi.hoisted(() => ({
  registry: {} as ActorRegistry,
  keys: {} as ActorKeys
}))

vi.mock('../../../src/actors/registry.js', () => ({
  openActorRegistry: () => hoisted.registry
}))

vi.mock('../../../src/actors/keys.js', () => ({
  openActorKeys: () => hoisted.keys
}))

const BASE_URL = 'https://example.netlify.app'
const POD_BASE = 'https://pod.example/'

function makeRecord(name: string, disabled = false): ActorRecord {
  const now = new Date().toISOString()
  return { name, publicKeyJwk: {}, createdAt: now, updatedAt: now, disabled }
}

function makeRegistry(overrides: Partial<ActorRegistry> = {}): ActorRegistry {
  return {
    getActor: vi.fn(async () => null),
    listActors: vi.fn(async () => []),
    createActor: vi.fn(),
    disableActor: vi.fn(),
    rotateActorKey: vi.fn(),
    getEncryptedSecret: vi.fn(async () => null),
    listOrphanSecretNames: vi.fn(async () => []),
    ...overrides
  } as unknown as ActorRegistry
}

function makeKeys(overrides: Partial<ActorKeys> = {}): ActorKeys {
  return {
    getPublicKeyJwk: vi.fn(async () => ({})),
    getPublicKeyPem: vi.fn(async () => 'registry-pem'),
    getPrivateKeyJwk: vi.fn(async () => ({})),
    ...overrides
  } as unknown as ActorKeys
}

beforeEach(() => {
  hoisted.registry = makeRegistry()
  hoisted.keys = makeKeys()
})

describe('openActorResolver.resolveActor', () => {
  it('returns the derived config for a registry hit', async () => {
    hoisted.registry = makeRegistry({ getActor: vi.fn(async (name: string) => makeRecord(name)) })
    const resolver = openActorResolver({ baseUrl: BASE_URL, solidStorageBaseUrl: POD_BASE })

    const actor = await resolver.resolveActor('alice')

    expect(actor).toEqual(deriveActorConfig('alice', BASE_URL, POD_BASE))
  })

  it('returns null for a disabled registered actor', async () => {
    hoisted.registry = makeRegistry({ getActor: vi.fn(async (name: string) => makeRecord(name, true)) })
    const resolver = openActorResolver({ baseUrl: BASE_URL, solidStorageBaseUrl: POD_BASE })

    expect(await resolver.resolveActor('alice')).toBeNull()
  })

  it('returns null when the registry has no matching actor', async () => {
    const resolver = openActorResolver({ baseUrl: BASE_URL, solidStorageBaseUrl: POD_BASE })

    expect(await resolver.resolveActor('ghost')).toBeNull()
  })

  it('propagates registry errors instead of falling back', async () => {
    hoisted.registry = makeRegistry({
      getActor: vi.fn(async () => {
        throw new Error('blobs unavailable')
      })
    })
    const resolver = openActorResolver({ baseUrl: BASE_URL, solidStorageBaseUrl: POD_BASE })

    await expect(resolver.resolveActor('alice')).rejects.toThrow('blobs unavailable')
  })
})

describe('openActorResolver.listActors', () => {
  it('returns derived configs for enabled registry actors only', async () => {
    hoisted.registry = makeRegistry({
      listActors: vi.fn(async () => [
        makeRecord('alice'),
        makeRecord('bob'),
        makeRecord('disabled', true)
      ])
    })
    const resolver = openActorResolver({ baseUrl: BASE_URL, solidStorageBaseUrl: POD_BASE })

    const actors = await resolver.listActors()

    expect(actors).toEqual([
      deriveActorConfig('alice', BASE_URL, POD_BASE),
      deriveActorConfig('bob', BASE_URL, POD_BASE)
    ])
  })

  it('propagates registry errors instead of falling back', async () => {
    hoisted.registry = makeRegistry({
      listActors: vi.fn(async () => {
        throw new Error('blobs unavailable')
      })
    })
    const resolver = openActorResolver({ baseUrl: BASE_URL, solidStorageBaseUrl: POD_BASE })

    await expect(resolver.listActors()).rejects.toThrow('blobs unavailable')
  })
})

describe('openActorResolver.getPublicKeyPem', () => {
  it('returns the registry public key', async () => {
    hoisted.keys = makeKeys({ getPublicKeyPem: vi.fn(async () => 'registry-pem') })
    const resolver = openActorResolver({ baseUrl: BASE_URL, solidStorageBaseUrl: POD_BASE })

    expect(await resolver.getPublicKeyPem('alice')).toBe('registry-pem')
  })

  it('propagates registry key errors instead of falling back', async () => {
    hoisted.keys = makeKeys({
      getPublicKeyPem: vi.fn(async () => {
        throw new Error('no key')
      })
    })
    const resolver = openActorResolver({ baseUrl: BASE_URL, solidStorageBaseUrl: POD_BASE })

    await expect(resolver.getPublicKeyPem('alice')).rejects.toThrow('no key')
  })
})
