import { encryptActorSecret, type EncryptedSecret } from './crypto.js'
import type { ActorRecord } from './registry.js'

export interface RegistrySnapshot {
  schema: 1
  rev: number
  updatedAt: string
  actors: Record<string, ActorRecord>
}

export interface SecretsSnapshot {
  schema: 1
  rev: number
  updatedAt: string
  keys: Record<string, EncryptedSecret>
}

export interface ActorBackup {
  version: 1
  registry: RegistrySnapshot
  secrets: SecretsSnapshot
}

export interface BackupRunner {
  get(store: string, key: string): Promise<string>
  set(store: string, key: string, value: string): Promise<void>
}

export interface BackupIO {
  readFile(path: string): Promise<string>
  writeFile(path: string, data: string): Promise<void>
}

export const REGISTRY_STORE = 'actor-registry'
export const SECRETS_STORE = 'actor-secrets'
export const REGISTRY_KEY = 'registry'
export const SECRETS_KEY = 'secrets'

const BACKUP_VERSION = 1
const SNAPSHOT_SCHEMA = 1
const DEFAULT_ACTOR_KEYS_PATH = 'src/actor-keys.ts'
const PUBLIC_RSA_FIELDS = ['kty', 'n', 'e', 'alg', 'use', 'kid'] as const

export function derivePublicJwk(privateJwk: Record<string, unknown>): Record<string, unknown> {
  const publicJwk: Record<string, unknown> = {}
  for (const field of PUBLIC_RSA_FIELDS) {
    if (privateJwk[field] !== undefined) {
      publicJwk[field] = privateJwk[field]
    }
  }
  return publicJwk
}

export function buildSeedFromActorKeys(
  actorKeys: Record<string, Record<string, unknown>>,
  options: { now?: string; keyBase64?: string } = {}
): ActorBackup {
  const now = options.now ?? new Date().toISOString()
  const actors: Record<string, ActorRecord> = {}
  const keys: Record<string, EncryptedSecret> = {}

  for (const [name, privateJwk] of Object.entries(actorKeys)) {
    actors[name] = {
      name,
      publicKeyJwk: derivePublicJwk(privateJwk),
      createdAt: now,
      updatedAt: now,
      disabled: false
    }
    keys[name] = encryptActorSecret(privateJwk, options.keyBase64)
  }

  return {
    version: BACKUP_VERSION,
    registry: { schema: SNAPSHOT_SCHEMA, rev: 1, updatedAt: now, actors },
    secrets: { schema: SNAPSHOT_SCHEMA, rev: 1, updatedAt: now, keys }
  }
}

export function parseActorKeysFile(content: string): Record<string, Record<string, unknown>> {
  const startIdx = content.indexOf('{')
  if (startIdx === -1) {
    throw new Error('Could not find an object literal in the actor keys file')
  }

  let depth = 0
  let quote: '"' | "'" | '`' | null = null
  let endIdx = -1

  for (let i = startIdx; i < content.length; i += 1) {
    const ch = content[i]
    if (quote !== null) {
      if (ch === '\\') {
        i += 1
        continue
      }
      if (ch === quote) quote = null
      continue
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      quote = ch
      continue
    }
    if (ch === '{') {
      depth += 1
    } else if (ch === '}') {
      depth -= 1
      if (depth === 0) {
        endIdx = i
        break
      }
    }
  }

  if (endIdx === -1) {
    throw new Error('Could not find a balanced object literal in the actor keys file')
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(content.slice(startIdx, endIdx + 1))
  } catch (error) {
    throw new Error(`Could not parse the actor keys object literal: ${(error as Error).message}`)
  }

  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('The actor keys object literal must be a JSON object')
  }

  return parsed as Record<string, Record<string, unknown>>
}

export function serializeBackup(backup: ActorBackup): string {
  return JSON.stringify(backup)
}

function isSnapshot(value: unknown, recordsField: string): boolean {
  if (value === null || typeof value !== 'object') return false
  const snapshot = value as Record<string, unknown>
  const records = snapshot[recordsField]
  return (
    snapshot.schema === SNAPSHOT_SCHEMA &&
    typeof snapshot.rev === 'number' &&
    typeof snapshot.updatedAt === 'string' &&
    records !== null &&
    typeof records === 'object'
  )
}

export function parseBackup(json: string): ActorBackup {
  let parsed: unknown
  try {
    parsed = JSON.parse(json)
  } catch (error) {
    throw new Error(`Invalid actor backup JSON: ${(error as Error).message}`)
  }

  if (parsed === null || typeof parsed !== 'object') {
    throw new Error('Invalid actor backup: expected a JSON object')
  }

  const candidate = parsed as Partial<ActorBackup>
  if (candidate.version !== BACKUP_VERSION) {
    throw new Error(`Unsupported actor backup version: ${String(candidate.version)}`)
  }
  if (!isSnapshot(candidate.registry, 'actors')) {
    throw new Error('Invalid actor backup: missing or malformed registry snapshot')
  }
  if (!isSnapshot(candidate.secrets, 'keys')) {
    throw new Error('Invalid actor backup: missing or malformed secrets snapshot')
  }

  return candidate as ActorBackup
}

export function serializeRegistrySnapshot(snapshot: RegistrySnapshot): string {
  return JSON.stringify(snapshot)
}

export function serializeSecretsSnapshot(snapshot: SecretsSnapshot): string {
  return JSON.stringify(snapshot)
}

export async function runActorsBackup(
  argv: string[],
  runner: BackupRunner,
  io: BackupIO
): Promise<string> {
  const [command, ...rest] = argv

  if (command === 'backup') {
    const dir = rest[0]
    if (dir === undefined || dir.length === 0) {
      throw new Error('backup requires a target directory: backup <dir>')
    }

    const registryJson = await runner.get(REGISTRY_STORE, REGISTRY_KEY)
    const secretsJson = await runner.get(SECRETS_STORE, SECRETS_KEY)

    const registryPath = `${dir}/actor-registry.json`
    const secretsPath = `${dir}/actor-secrets.json`
    await io.writeFile(registryPath, registryJson)
    await io.writeFile(secretsPath, secretsJson)

    return `Backed up ${registryPath} and ${secretsPath}`
  }

  if (command === 'restore') {
    const target = rest[0]

    if (target === '--from-actor-keys') {
      const path = rest[1] ?? DEFAULT_ACTOR_KEYS_PATH
      const content = await io.readFile(path)
      const actorKeys = parseActorKeysFile(content)
      const backup = buildSeedFromActorKeys(actorKeys)

      await runner.set(REGISTRY_STORE, REGISTRY_KEY, serializeRegistrySnapshot(backup.registry))
      await runner.set(SECRETS_STORE, SECRETS_KEY, serializeSecretsSnapshot(backup.secrets))

      return `Seeded ${Object.keys(actorKeys).length} actor(s) into the registry and secrets stores from ${path}`
    }

    if (target === undefined || target.length === 0) {
      throw new Error('restore requires a source directory or --from-actor-keys: restore <dir>')
    }

    const registryJson = await io.readFile(`${target}/actor-registry.json`)
    const secretsJson = await io.readFile(`${target}/actor-secrets.json`)

    await runner.set(REGISTRY_STORE, REGISTRY_KEY, registryJson)
    await runner.set(SECRETS_STORE, SECRETS_KEY, secretsJson)

    return `Restored registry and secrets from ${target}`
  }

  throw new Error(
    `Unknown actors-backup command: ${command ?? '(none)'}. Expected "backup" or "restore"`
  )
}
