import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createPublicKey, generateKeyPairSync, type KeyObject } from 'node:crypto'
import { encryptActorSecret, type EncryptedSecret } from '../../../src/actors/crypto.js'
import {
  ActorNotFoundError,
  type ActorRecord,
  type ActorRegistry
} from '../../../src/actors/registry.js'
import { openActorKeys } from '../../../src/actors/keys.js'

const KEY = Buffer.alloc(32, 7).toString('base64')

function exportJwk(key: KeyObject): Record<string, unknown> {
  return key.export({ format: 'jwk' }) as Record<string, unknown>
}

function pemFor(publicKeyJwk: Record<string, unknown>): string {
  return createPublicKey({ key: publicKeyJwk, format: 'jwk' }).export({
    type: 'spki',
    format: 'pem'
  }) as string
}

interface FakeActor {
  record: ActorRecord
  secret: EncryptedSecret
  privateKeyJwk: Record<string, unknown>
}

function makeActor(name: string, updatedAt = new Date().toISOString()): FakeActor {
  const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
  const publicKeyJwk = exportJwk(publicKey)
  const privateKeyJwk = exportJwk(privateKey)

  return {
    record: {
      name,
      publicKeyJwk,
      createdAt: updatedAt,
      updatedAt,
      disabled: false
    },
    secret: encryptActorSecret(privateKeyJwk, KEY),
    privateKeyJwk
  }
}

function makeFakeRegistry(actors: Map<string, FakeActor>): {
  registry: ActorRegistry
  getActor: ReturnType<typeof vi.fn>
  getEncryptedSecret: ReturnType<typeof vi.fn>
} {
  const getActor = vi.fn(async (name: string) => actors.get(name)?.record ?? null)
  const getEncryptedSecret = vi.fn(async (name: string) => actors.get(name)?.secret ?? null)

  return {
    registry: { getActor, getEncryptedSecret } as unknown as ActorRegistry,
    getActor,
    getEncryptedSecret
  }
}

const originalEnv = process.env

beforeEach(() => {
  process.env = { ...originalEnv }
  process.env.ACTOR_KEY_ENCRYPTION_KEY = KEY
})

afterEach(() => {
  process.env = originalEnv
})

describe('openActorKeys', () => {
  it('returns the record public key jwk', async () => {
    const actors = new Map([['alice', makeActor('alice')]])
    const { registry } = makeFakeRegistry(actors)
    const keys = openActorKeys(registry)

    const jwk = await keys.getPublicKeyJwk('alice')

    expect(jwk).toEqual(actors.get('alice')?.record.publicKeyJwk)
  })

  it('derives an spki pem from the public key jwk', async () => {
    const actors = new Map([['alice', makeActor('alice')]])
    const { registry } = makeFakeRegistry(actors)
    const keys = openActorKeys(registry)

    const pem = await keys.getPublicKeyPem('alice')

    expect(typeof pem).toBe('string')
    expect(pem).toContain('-----BEGIN PUBLIC KEY-----')
    expect(pem).toBe(pemFor(actors.get('alice')?.record.publicKeyJwk as Record<string, unknown>))
  })

  it('returns the decrypted private key jwk', async () => {
    const actors = new Map([['alice', makeActor('alice')]])
    const { registry } = makeFakeRegistry(actors)
    const keys = openActorKeys(registry)

    const jwk = await keys.getPrivateKeyJwk('alice')

    expect(jwk).toEqual(actors.get('alice')?.privateKeyJwk)
  })

  it('decrypts only once per updatedAt', async () => {
    const actors = new Map([['alice', makeActor('alice')]])
    const { registry, getEncryptedSecret } = makeFakeRegistry(actors)
    const keys = openActorKeys(registry)

    await keys.getPrivateKeyJwk('alice')
    await keys.getPrivateKeyJwk('alice')
    await keys.getPublicKeyPem('alice')

    expect(getEncryptedSecret).toHaveBeenCalledTimes(1)
  })

  it('invalidates the cache when updatedAt changes', async () => {
    const actors = new Map([['alice', makeActor('alice')]])
    const { registry, getEncryptedSecret } = makeFakeRegistry(actors)
    const keys = openActorKeys(registry)

    await keys.getPublicKeyPem('alice')
    const rotated = makeActor('alice', new Date(Date.now() + 1000).toISOString())
    actors.set('alice', rotated)

    const pem = await keys.getPublicKeyPem('alice')
    const jwk = await keys.getPrivateKeyJwk('alice')

    expect(pem).toBe(pemFor(rotated.record.publicKeyJwk))
    expect(jwk).toEqual(rotated.privateKeyJwk)
    expect(getEncryptedSecret).toHaveBeenCalledTimes(2)
  })

  it('rejects when the actor is missing', async () => {
    const { registry } = makeFakeRegistry(new Map())
    const keys = openActorKeys(registry)

    await expect(keys.getPublicKeyJwk('ghost')).rejects.toBeInstanceOf(ActorNotFoundError)
    await expect(keys.getPublicKeyPem('ghost')).rejects.toBeInstanceOf(ActorNotFoundError)
    await expect(keys.getPrivateKeyJwk('ghost')).rejects.toBeInstanceOf(ActorNotFoundError)
  })

  it('rejects with a descriptive error when the secret is missing', async () => {
    const actors = new Map([['alice', makeActor('alice')]])
    actors.get('alice')!.secret = null as unknown as EncryptedSecret
    const { registry } = makeFakeRegistry(actors)
    const keys = openActorKeys(registry)

    await expect(keys.getPrivateKeyJwk('alice')).rejects.toThrow(/secret/i)
  })
})
