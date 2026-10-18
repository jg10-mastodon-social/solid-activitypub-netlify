import { openJsonStore, type JsonStore } from '../blobs.ts'
import type { EncryptedSecret } from './crypto.ts'

export interface ActorRecord {
  name: string
  publicKeyJwk: Record<string, unknown>
  createdAt: string
  updatedAt: string
  disabled: boolean
}

export interface ActorRegistry {
  getActor(name: string): Promise<ActorRecord | null>
  listActors(): Promise<ActorRecord[]>
  createActor(input: {
    name: string
    publicKeyJwk: Record<string, unknown>
    encryptedPrivateKey: EncryptedSecret
  }): Promise<ActorRecord>
  disableActor(name: string): Promise<ActorRecord>
  rotateActorKey(input: {
    name: string
    publicKeyJwk: Record<string, unknown>
    encryptedPrivateKey: EncryptedSecret
  }): Promise<ActorRecord>
  getEncryptedSecret(name: string): Promise<EncryptedSecret | null>
  listOrphanSecretNames(): Promise<string[]>
}

export class ActorAlreadyExistsError extends Error {}
export class ActorNotFoundError extends Error {}

interface BaseDoc {
  schema: number
  rev: number
  updatedAt: string
}

interface RegistryDoc extends BaseDoc {
  schema: 1
  actors: Record<string, ActorRecord>
}

interface SecretsDoc extends BaseDoc {
  schema: 1
  keys: Record<string, EncryptedSecret>
}

interface LoadedDoc<T> {
  doc: T
  etag: string | null
}

const REGISTRY_KEY = 'registry'
const SECRETS_KEY = 'secrets'
const REGISTRY_SCHEMA = 1
const SECRETS_SCHEMA = 1
const DEFAULT_REGISTRY_STORE = 'actor-registry'
const DEFAULT_SECRET_STORE = 'actor-secrets'
const MAX_ATTEMPTS = 5

function emptyRegistryDoc(): RegistryDoc {
  return {
    schema: REGISTRY_SCHEMA,
    rev: 0,
    updatedAt: new Date().toISOString(),
    actors: {}
  }
}

function emptySecretsDoc(): SecretsDoc {
  return {
    schema: SECRETS_SCHEMA,
    rev: 0,
    updatedAt: new Date().toISOString(),
    keys: {}
  }
}

async function readDoc<T extends BaseDoc>(
  store: JsonStore,
  key: string
): Promise<LoadedDoc<T> | null> {
  const result = await store.get<T>(key)
  if (result.data === null) return null
  return { doc: result.data, etag: result.etag }
}

async function updateDoc<T extends BaseDoc>(
  store: JsonStore,
  key: string,
  empty: () => T,
  mutate: (doc: T) => T
): Promise<T> {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    const loaded = await readDoc<T>(store, key)

    if (loaded === null) {
      const bootstrapped = mutate(empty())
      const result = await store.set(key, bootstrapped, { onlyIfNew: true })
      if (result.modified) return bootstrapped
      continue
    }

    const next = mutate(loaded.doc)
    const written: T = {
      ...next,
      rev: loaded.doc.rev + 1,
      updatedAt: new Date().toISOString()
    }
    const result = await store.set(key, written, { onlyIfMatch: loaded.etag ?? undefined })
    if (result.modified) return written
  }

  throw new Error(
    `Failed to update "${key}" after ${MAX_ATTEMPTS} attempts due to concurrent modification`
  )
}

export function openActorRegistry(
  options: {
    registryStore?: JsonStore
    secretStore?: JsonStore
    registryStoreName?: string
    secretStoreName?: string
  } = {}
): ActorRegistry {
  let registryStore = options.registryStore ?? null
  let secretStore = options.secretStore ?? null

  function registry(): JsonStore {
    if (registryStore === null) {
      registryStore = openJsonStore(
        options.registryStoreName ?? process.env.ACTOR_REGISTRY_STORE ?? DEFAULT_REGISTRY_STORE
      )
    }
    return registryStore
  }

  function secrets(): JsonStore {
    if (secretStore === null) {
      secretStore = openJsonStore(
        options.secretStoreName ?? process.env.ACTOR_SECRET_STORE ?? DEFAULT_SECRET_STORE
      )
    }
    return secretStore
  }

  async function loadRegistry(): Promise<RegistryDoc | null> {
    const loaded = await readDoc<RegistryDoc>(registry(), REGISTRY_KEY)
    return loaded?.doc ?? null
  }

  async function loadSecrets(): Promise<SecretsDoc | null> {
    const loaded = await readDoc<SecretsDoc>(secrets(), SECRETS_KEY)
    return loaded?.doc ?? null
  }

  async function getActor(name: string): Promise<ActorRecord | null> {
    const doc = await loadRegistry()
    return doc?.actors[name] ?? null
  }

  async function listActors(): Promise<ActorRecord[]> {
    const doc = await loadRegistry()
    if (doc === null) return []
    return Object.values(doc.actors).sort((a, b) => a.name.localeCompare(b.name))
  }

  async function writeSecret(name: string, encryptedPrivateKey: EncryptedSecret): Promise<void> {
    await updateDoc<SecretsDoc>(secrets(), SECRETS_KEY, emptySecretsDoc, (doc) => ({
      ...doc,
      keys: { ...doc.keys, [name]: encryptedPrivateKey }
    }))
  }

  async function createActor(input: {
    name: string
    publicKeyJwk: Record<string, unknown>
    encryptedPrivateKey: EncryptedSecret
  }): Promise<ActorRecord> {
    const existing = await getActor(input.name)
    if (existing !== null) {
      throw new ActorAlreadyExistsError(`actor "${input.name}" already exists`)
    }

    const now = new Date().toISOString()
    const record: ActorRecord = {
      name: input.name,
      publicKeyJwk: input.publicKeyJwk,
      createdAt: now,
      updatedAt: now,
      disabled: false
    }

    await writeSecret(input.name, input.encryptedPrivateKey)
    await updateDoc<RegistryDoc>(registry(), REGISTRY_KEY, emptyRegistryDoc, (doc) => {
      if (doc.actors[input.name] !== undefined) {
        throw new ActorAlreadyExistsError(`actor "${input.name}" already exists`)
      }
      return {
        ...doc,
        actors: { ...doc.actors, [input.name]: record }
      }
    })

    return record
  }

  async function disableActor(name: string): Promise<ActorRecord> {
    const existing = await getActor(name)
    if (existing === null) {
      throw new ActorNotFoundError(`actor "${name}" not found`)
    }

    const updated = await updateDoc<RegistryDoc>(
      registry(),
      REGISTRY_KEY,
      emptyRegistryDoc,
      (doc) => {
        const current = doc.actors[name]
        if (current === undefined) {
          throw new ActorNotFoundError(`actor "${name}" not found`)
        }
        return {
          ...doc,
          actors: {
            ...doc.actors,
            [name]: { ...current, disabled: true, updatedAt: new Date().toISOString() }
          }
        }
      }
    )

    const record = updated.actors[name]
    if (record === undefined) {
      throw new ActorNotFoundError(`actor "${name}" not found`)
    }
    return record
  }

  async function rotateActorKey(input: {
    name: string
    publicKeyJwk: Record<string, unknown>
    encryptedPrivateKey: EncryptedSecret
  }): Promise<ActorRecord> {
    const existing = await getActor(input.name)
    if (existing === null) {
      throw new ActorNotFoundError(`actor "${input.name}" not found`)
    }

    await writeSecret(input.name, input.encryptedPrivateKey)

    const updated = await updateDoc<RegistryDoc>(
      registry(),
      REGISTRY_KEY,
      emptyRegistryDoc,
      (doc) => {
        const current = doc.actors[input.name]
        if (current === undefined) {
          throw new ActorNotFoundError(`actor "${input.name}" not found`)
        }
        return {
          ...doc,
          actors: {
            ...doc.actors,
            [input.name]: {
              ...current,
              publicKeyJwk: input.publicKeyJwk,
              updatedAt: new Date().toISOString()
            }
          }
        }
      }
    )

    const record = updated.actors[input.name]
    if (record === undefined) {
      throw new ActorNotFoundError(`actor "${input.name}" not found`)
    }
    return record
  }

  async function getEncryptedSecret(name: string): Promise<EncryptedSecret | null> {
    const doc = await loadSecrets()
    return doc?.keys[name] ?? null
  }

  async function listOrphanSecretNames(): Promise<string[]> {
    const [registryDoc, secretsDoc] = await Promise.all([loadRegistry(), loadSecrets()])
    const actors = registryDoc?.actors ?? {}
    const keys = secretsDoc?.keys ?? {}
    return Object.keys(keys)
      .filter((name) => actors[name] === undefined)
      .sort()
  }

  return {
    getActor,
    listActors,
    createActor,
    disableActor,
    rotateActorKey,
    getEncryptedSecret,
    listOrphanSecretNames
  }
}
