import { createPublicKey } from 'node:crypto'
import { decryptActorSecret } from './crypto.js'
import { ActorNotFoundError, type ActorRegistry } from './registry.js'

export interface ActorKeys {
  getPublicKeyJwk(name: string): Promise<Record<string, unknown>>
  getPublicKeyPem(name: string): Promise<string>
  getPrivateKeyJwk(name: string): Promise<Record<string, unknown>>
}

interface CachedKeys {
  updatedAt: string
  publicKeyJwk: Record<string, unknown>
  publicKeyPem: string
  privateKeyJwk: Record<string, unknown>
}

function derivePem(publicKeyJwk: Record<string, unknown>): string {
  return createPublicKey({ key: publicKeyJwk, format: 'jwk' }).export({
    type: 'spki',
    format: 'pem'
  }) as string
}

export function openActorKeys(registry: ActorRegistry): ActorKeys {
  const cache = new Map<string, CachedKeys>()

  async function load(name: string): Promise<CachedKeys> {
    const record = await registry.getActor(name)
    if (record === null) {
      throw new ActorNotFoundError(`actor "${name}" not found`)
    }

    const cached = cache.get(name)
    if (cached !== undefined && cached.updatedAt === record.updatedAt) {
      return cached
    }

    const secret = await registry.getEncryptedSecret(name)
    if (secret === null) {
      throw new Error(`no encrypted secret found for actor "${name}"`)
    }

    const entry: CachedKeys = {
      updatedAt: record.updatedAt,
      publicKeyJwk: record.publicKeyJwk,
      publicKeyPem: derivePem(record.publicKeyJwk),
      privateKeyJwk: decryptActorSecret<Record<string, unknown>>(secret)
    }
    cache.set(name, entry)
    return entry
  }

  return {
    async getPublicKeyJwk(name: string): Promise<Record<string, unknown>> {
      return (await load(name)).publicKeyJwk
    },
    async getPublicKeyPem(name: string): Promise<string> {
      return (await load(name)).publicKeyPem
    },
    async getPrivateKeyJwk(name: string): Promise<Record<string, unknown>> {
      return (await load(name)).privateKeyJwk
    }
  }
}
