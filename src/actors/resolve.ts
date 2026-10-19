import type { ActorConfig } from '../types.js'
import { deriveActorConfig } from './config.js'
import { openActorKeys, type ActorKeys } from './keys.js'
import { openActorRegistry, type ActorRegistry } from './registry.js'

export interface ActorResolver {
  resolveActor(name: string): Promise<ActorConfig | null>
  listActors(): Promise<ActorConfig[]>
  getPublicKeyPem(name: string): Promise<string>
}

export function openActorResolver(options: {
  baseUrl: string
  solidStorageBaseUrl: string
}): ActorResolver {
  // Opened lazily so environments without configured Netlify Blobs (unit and
  // integration tests) do not fail at construction time.
  let registry: ActorRegistry | null = null
  let keys: ActorKeys | null = null

  function getRegistry(): ActorRegistry {
    if (registry === null) {
      registry = openActorRegistry()
    }
    return registry
  }

  function getKeys(): ActorKeys {
    if (keys === null) {
      keys = openActorKeys(getRegistry())
    }
    return keys
  }

  async function resolveActor(name: string): Promise<ActorConfig | null> {
    const record = await getRegistry().getActor(name)
    if (record === null || record.disabled) return null
    return deriveActorConfig(record.name, options.baseUrl, options.solidStorageBaseUrl)
  }

  async function listActors(): Promise<ActorConfig[]> {
    const records = await getRegistry().listActors()
    return records
      .filter((record) => !record.disabled)
      .map((record) =>
        deriveActorConfig(record.name, options.baseUrl, options.solidStorageBaseUrl)
      )
  }

  async function getPublicKeyPem(name: string): Promise<string> {
    return getKeys().getPublicKeyPem(name)
  }

  return { resolveActor, listActors, getPublicKeyPem }
}
