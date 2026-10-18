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

  it('returns null for a disabled registered actor even when a fallback exists', async () => {
    hoisted.registry = makeRegistry({ getActor: vi.fn(async (name: string) => makeRecord(name, true)) })
    const resolver = openActorResolver({
      baseUrl: BASE_URL,
      solidStorageBaseUrl: POD_BASE,
      fallbackActorByPath: { '/alice': deriveActorConfig('alice', BASE_URL, POD_BASE) }
    })

    expect(await resolver.resolveActor('alice')).toBeNull()
  })

  it('uses the fallback map for a registry miss', async () => {
    const fallbackActor = deriveActorConfig('legacy', BASE_URL, POD_BASE)
    const resolver = openActorResolver({
      baseUrl: BASE_URL,
      solidStorageBaseUrl: POD_BASE,
      fallbackActorByPath: { '/legacy': fallbackActor }
    })

    expect(await resolver.resolveActor('legacy')).toEqual(fallbackActor)
  })

  it('uses the fallback map when the registry throws', async () => {
    hoisted.registry = makeRegistry({
      getActor: vi.fn(async () => {
        throw new Error('blobs unavailable')
      })
    })
    const fallbackActor = deriveActorConfig('legacy', BASE_URL, POD_BASE)
    const resolver = openActorResolver({
      baseUrl: BASE_URL,
      solidStorageBaseUrl: POD_BASE,
      fallbackActorByPath: { '/legacy': fallbackActor }
    })

    expect(await resolver.resolveActor('legacy')).toEqual(fallbackActor)
  })

  it('returns null when neither the registry nor the fallback resolve the name', async () => {
    const resolver = openActorResolver({ baseUrl: BASE_URL, solidStorageBaseUrl: POD_BASE })

    expect(await resolver.resolveActor('ghost')).toBeNull()
  })
})

describe('openActorResolver.listActors', () => {
  it('merges registry and fallback actors, de-duplicating with registry winning', async () => {
    hoisted.registry = makeRegistry({
      listActors: vi.fn(async () => [
        makeRecord('alice'),
        makeRecord('bob'),
        makeRecord('disabled', true)
      ])
    })
    const resolver = openActorResolver({
      baseUrl: BASE_URL,
      solidStorageBaseUrl: POD_BASE,
      fallbackActorByPath: {
        '/alice': { ...deriveActorConfig('alice', BASE_URL, POD_BASE), url: 'https://legacy.example/alice' },
        '/legacy': deriveActorConfig('legacy', BASE_URL, POD_BASE)
      }
    })

    const actors = await resolver.listActors()

    expect(actors.map((a) => a.name).sort()).toEqual(['alice', 'bob', 'legacy'])
    const alice = actors.find((a) => a.name === 'alice')
    expect(alice).toEqual(deriveActorConfig('alice', BASE_URL, POD_BASE))
  })

  it('returns just the fallback actors when the registry throws', async () => {
    hoisted.registry = makeRegistry({
      listActors: vi.fn(async () => {
        throw new Error('blobs unavailable')
      })
    })
    const fallbackActor = deriveActorConfig('legacy', BASE_URL, POD_BASE)
    const resolver = openActorResolver({
      baseUrl: BASE_URL,
      solidStorageBaseUrl: POD_BASE,
      fallbackActorByPath: { '/legacy': fallbackActor }
    })

    expect(await resolver.listActors()).toEqual([fallbackActor])
  })
})

describe('openActorResolver.getPublicKeyPem', () => {
  it('prefers the registry keys', async () => {
    hoisted.keys = makeKeys({ getPublicKeyPem: vi.fn(async () => 'registry-pem') })
    const fallback = vi.fn(async () => 'fallback-pem')
    const resolver = openActorResolver({
      baseUrl: BASE_URL,
      solidStorageBaseUrl: POD_BASE,
      fallbackPublicKeyPem: fallback
    })

    expect(await resolver.getPublicKeyPem('alice')).toBe('registry-pem')
    expect(fallback).not.toHaveBeenCalled()
  })

  it('falls back to the provided PEM function when the registry keys throw', async () => {
    hoisted.keys = makeKeys({
      getPublicKeyPem: vi.fn(async () => {
        throw new Error('no key')
      })
    })
    const fallback = vi.fn(async () => 'fallback-pem')
    const resolver = openActorResolver({
      baseUrl: BASE_URL,
      solidStorageBaseUrl: POD_BASE,
      fallbackPublicKeyPem: fallback
    })

    expect(await resolver.getPublicKeyPem('alice')).toBe('fallback-pem')
  })

  it('rethrows when the registry keys throw and no fallback is provided', async () => {
    hoisted.keys = makeKeys({
      getPublicKeyPem: vi.fn(async () => {
        throw new Error('no key')
      })
    })
    const resolver = openActorResolver({ baseUrl: BASE_URL, solidStorageBaseUrl: POD_BASE })

    await expect(resolver.getPublicKeyPem('alice')).rejects.toThrow('no key')
  })
})
