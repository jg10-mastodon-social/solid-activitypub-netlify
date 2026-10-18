import type { ActorConfig } from '../types.js'
import { deriveActorConfig } from './config.js'
import { openActorKeys, type ActorKeys } from './keys.js'
import { openActorRegistry, type ActorRecord, type ActorRegistry } from './registry.js'

export interface ActorResolver {
  resolveActor(name: string): Promise<ActorConfig | null>
  listActors(): Promise<ActorConfig[]>
  getPublicKeyPem(name: string): Promise<string>
}

export function openActorResolver(options: {
  baseUrl: string
  solidStorageBaseUrl: string
  fallbackActorByPath?: Record<string, ActorConfig>
  fallbackPublicKeyPem?: (name: string) => Promise<string>
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

  function fallbackActor(name: string): ActorConfig | null {
    return options.fallbackActorByPath?.[`/${name}`] ?? null
  }

  async function resolveActor(name: string): Promise<ActorConfig | null> {
    try {
      const record = await getRegistry().getActor(name)
      if (record !== null) {
        if (record.disabled) return null
        return deriveActorConfig(record.name, options.baseUrl, options.solidStorageBaseUrl)
      }
    } catch {
      // Transitional fallback: the build-time actorByPath keeps requests working
      // when the registry is unreachable. Remove at cutover.
    }
    return fallbackActor(name)
  }

  async function listActors(): Promise<ActorConfig[]> {
    let records: ActorRecord[]
    try {
      records = await getRegistry().listActors()
    } catch {
      // Transitional fallback: registry unreachable, serve build-time actors only.
      return Object.values(options.fallbackActorByPath ?? {})
    }

    const byName = new Map<string, ActorConfig>()
    for (const record of records) {
      if (record.disabled) continue
      byName.set(
        record.name,
        deriveActorConfig(record.name, options.baseUrl, options.solidStorageBaseUrl)
      )
    }
    // Transitional fallback: build-time actors fill gaps, registry entries win.
    for (const actor of Object.values(options.fallbackActorByPath ?? {})) {
      if (!byName.has(actor.name)) {
        byName.set(actor.name, actor)
      }
    }
    return Array.from(byName.values())
  }

  async function getPublicKeyPem(name: string): Promise<string> {
    try {
      return await getKeys().getPublicKeyPem(name)
    } catch (error) {
      // Transitional fallback to build-time keys. Remove at cutover.
      if (options.fallbackPublicKeyPem) {
        return options.fallbackPublicKeyPem(name)
      }
      throw error
    }
  }

  return { resolveActor, listActors, getPublicKeyPem }
}
