import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  buildSeedFromActorKeys,
  parseActorKeysFile,
  serializeBackup,
  parseBackup,
  runActorsBackup,
  REGISTRY_STORE,
  SECRETS_STORE,
  REGISTRY_KEY,
  SECRETS_KEY,
  type ActorBackup,
  type BackupRunner,
  type BackupIO
} from '../../../src/actors/backup.js'
import { decryptActorSecret } from '../../../src/actors/crypto.js'

const KEY = Buffer.alloc(32, 7).toString('base64')

const PRIVATE_JWK: Record<string, unknown> = {
  kty: 'RSA',
  n: 'sXchDaQevY3KTo1M_hK0b1cW6v0HfG8K9x2pQ',
  e: 'AQAB',
  d: 'private-exponent',
  p: 'prime-p',
  q: 'prime-q',
  dp: 'exponent-p',
  dq: 'exponent-q',
  qi: 'coefficient',
  alg: 'RS256',
  use: 'sig',
  kid: 'alice'
}

const SEED_KEYS: Record<string, Record<string, unknown>> = {
  alice: { ...PRIVATE_JWK, kid: 'alice' },
  bob: { ...PRIVATE_JWK, kid: 'bob', n: 'another-modulus' }
}

const PUBLIC_FIELDS = ['kty', 'n', 'e', 'alg', 'use', 'kid']
const PRIVATE_FIELDS = ['d', 'p', 'q', 'dp', 'dq', 'qi']

function actorKeysFile(keys: Record<string, Record<string, unknown>>): string {
  return `export const actorKeys: Record<string, Record<string, unknown>> = ${JSON.stringify(keys, null, 2)}\n`
}

class FakeRunner implements BackupRunner {
  store = new Map<string, string>()
  getCalls: Array<{ store: string; key: string }> = []
  setCalls: Array<{ store: string; key: string; value: string }> = []

  private slot(store: string, key: string): string {
    return `${store}/${key}`
  }

  async get(store: string, key: string): Promise<string> {
    this.getCalls.push({ store, key })
    const value = this.store.get(this.slot(store, key))
    if (value === undefined) throw new Error(`missing ${store}/${key}`)
    return value
  }

  async set(store: string, key: string, value: string): Promise<void> {
    this.setCalls.push({ store, key, value })
    this.store.set(this.slot(store, key), value)
  }
}

class FakeIO implements BackupIO {
  files = new Map<string, string>()

  async readFile(path: string): Promise<string> {
    const value = this.files.get(path)
    if (value === undefined) throw new Error(`missing file ${path}`)
    return value
  }

  async writeFile(path: string, data: string): Promise<void> {
    this.files.set(path, data)
  }
}

function seedRunner(backup: ActorBackup): FakeRunner {
  const runner = new FakeRunner()
  runner.store.set(`${REGISTRY_STORE}/${REGISTRY_KEY}`, JSON.stringify(backup.registry))
  runner.store.set(`${SECRETS_STORE}/${SECRETS_KEY}`, JSON.stringify(backup.secrets))
  return runner
}

describe('actors backup', () => {
  const originalEnv = process.env

  beforeEach(() => {
    process.env = { ...originalEnv, ACTOR_KEY_ENCRYPTION_KEY: KEY }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  describe('buildSeedFromActorKeys', () => {
    it('builds a registry and secret record for each actor', () => {
      const now = '2026-01-01T00:00:00.000Z'
      const backup = buildSeedFromActorKeys(SEED_KEYS, { now })

      expect(backup.version).toBe(1)
      expect(backup.registry.schema).toBe(1)
      expect(backup.registry.rev).toBe(1)
      expect(backup.registry.updatedAt).toBe(now)
      expect(backup.secrets.schema).toBe(1)
      expect(backup.secrets.rev).toBe(1)
      expect(backup.secrets.updatedAt).toBe(now)

      expect(Object.keys(backup.registry.actors).sort()).toEqual(['alice', 'bob'])
      expect(Object.keys(backup.secrets.keys).sort()).toEqual(['alice', 'bob'])

      for (const name of ['alice', 'bob']) {
        const record = backup.registry.actors[name]
        expect(record.name).toBe(name)
        expect(record.createdAt).toBe(now)
        expect(record.updatedAt).toBe(now)
        expect(record.disabled).toBe(false)
      }
    })

    it('derives a public JWK that omits every private RSA field', () => {
      const backup = buildSeedFromActorKeys(SEED_KEYS, { now: '2026-01-01T00:00:00.000Z' })
      const publicJwk = backup.registry.actors.alice.publicKeyJwk

      for (const field of PRIVATE_FIELDS) {
        expect(publicJwk[field]).toBeUndefined()
      }

      expect(Object.keys(publicJwk).sort()).toEqual([...PUBLIC_FIELDS].sort())
      expect(publicJwk).toEqual({
        kty: 'RSA',
        n: PRIVATE_JWK.n,
        e: 'AQAB',
        alg: 'RS256',
        use: 'sig',
        kid: 'alice'
      })
    })

    it('stores the private JWK envelope-encrypted and decrypts back to the original', () => {
      const backup = buildSeedFromActorKeys(SEED_KEYS, { now: '2026-01-01T00:00:00.000Z' })

      const secret = backup.secrets.keys.alice
      expect(secret.v).toBe(1)

      const decrypted = decryptActorSecret<Record<string, unknown>>(secret)
      expect(decrypted).toEqual(SEED_KEYS.alice)
    })

    it('honours an explicit keyBase64 option', () => {
      delete process.env.ACTOR_KEY_ENCRYPTION_KEY
      const otherKey = Buffer.alloc(32, 3).toString('base64')

      const backup = buildSeedFromActorKeys(SEED_KEYS, {
        now: '2026-01-01T00:00:00.000Z',
        keyBase64: otherKey
      })

      const decrypted = decryptActorSecret<Record<string, unknown>>(
        backup.secrets.keys.bob,
        otherKey
      )
      expect(decrypted).toEqual(SEED_KEYS.bob)
    })
  })

  describe('parseActorKeysFile', () => {
    it('parses a realistic actor-keys module', () => {
      const parsed = parseActorKeysFile(actorKeysFile(SEED_KEYS))
      expect(parsed).toEqual(SEED_KEYS)
    })

    it('throws when no object literal is present', () => {
      expect(() => parseActorKeysFile('const nope = 1\n')).toThrow(/object/i)
    })

    it('throws when the object literal is not valid JSON', () => {
      expect(() => parseActorKeysFile('export const actorKeys = { alice: notJson }\n')).toThrow(
        /parse/i
      )
    })
  })

  describe('serializeBackup / parseBackup', () => {
    it('round-trips a backup', () => {
      const backup = buildSeedFromActorKeys(SEED_KEYS, { now: '2026-01-01T00:00:00.000Z' })
      expect(parseBackup(serializeBackup(backup))).toEqual(backup)
    })

    it('rejects a wrong version', () => {
      const backup = buildSeedFromActorKeys(SEED_KEYS, { now: '2026-01-01T00:00:00.000Z' })
      const tampered = { ...backup, version: 2 }
      expect(() => parseBackup(JSON.stringify(tampered))).toThrow(/version/i)
    })

    it('rejects a missing registry snapshot', () => {
      const backup = buildSeedFromActorKeys(SEED_KEYS, { now: '2026-01-01T00:00:00.000Z' })
      const { version: _version, registry: _registry, ...rest } = backup
      expect(() => parseBackup(JSON.stringify({ version: 1, ...rest }))).toThrow(/registry/i)
    })

    it('rejects a missing secrets snapshot', () => {
      const backup = buildSeedFromActorKeys(SEED_KEYS, { now: '2026-01-01T00:00:00.000Z' })
      const { version: _version, secrets: _secrets, ...rest } = backup
      expect(() => parseBackup(JSON.stringify({ version: 1, ...rest }))).toThrow(/secrets/i)
    })

    it('rejects non-JSON input', () => {
      expect(() => parseBackup('not json')).toThrow()
    })
  })

  describe('runActorsBackup', () => {
    it('backup <dir> writes both store snapshots to files', async () => {
      const backup = buildSeedFromActorKeys(SEED_KEYS, { now: '2026-01-01T00:00:00.000Z' })
      const runner = seedRunner(backup)
      const io = new FakeIO()

      const message = await runActorsBackup(['backup', '/tmp/out'], runner, io)

      expect(io.files.get('/tmp/out/actor-registry.json')).toBe(JSON.stringify(backup.registry))
      expect(io.files.get('/tmp/out/actor-secrets.json')).toBe(JSON.stringify(backup.secrets))
      expect(message).toContain('actor-registry.json')
      expect(message).toContain('actor-secrets.json')
      expect(runner.getCalls).toEqual([
        { store: REGISTRY_STORE, key: REGISTRY_KEY },
        { store: SECRETS_STORE, key: SECRETS_KEY }
      ])
    })

    it('restore <dir> writes both store values back via the runner', async () => {
      const backup = buildSeedFromActorKeys(SEED_KEYS, { now: '2026-01-01T00:00:00.000Z' })
      const io = new FakeIO()
      io.files.set('/tmp/in/actor-registry.json', JSON.stringify(backup.registry))
      io.files.set('/tmp/in/actor-secrets.json', JSON.stringify(backup.secrets))
      const runner = new FakeRunner()

      const message = await runActorsBackup(['restore', '/tmp/in'], runner, io)

      expect(runner.store.get(`${REGISTRY_STORE}/${REGISTRY_KEY}`)).toBe(
        JSON.stringify(backup.registry)
      )
      expect(runner.store.get(`${SECRETS_STORE}/${SECRETS_KEY}`)).toBe(
        JSON.stringify(backup.secrets)
      )
      expect(message).toContain('/tmp/in')
    })

    it('restore --from-actor-keys writes bare snapshot documents that decrypt', async () => {
      const io = new FakeIO()
      io.files.set('src/actor-keys.ts', actorKeysFile(SEED_KEYS))
      const runner = new FakeRunner()

      const message = await runActorsBackup(['restore', '--from-actor-keys'], runner, io)

      const registryDoc = JSON.parse(runner.store.get(`${REGISTRY_STORE}/${REGISTRY_KEY}`) ?? '')
      expect(registryDoc.schema).toBe(1)
      expect(registryDoc.actors.alice.publicKeyJwk.d).toBeUndefined()
      expect(registryDoc.actors.alice.publicKeyJwk.n).toBe(PRIVATE_JWK.n)
      expect(registryDoc.actors.alice.disabled).toBe(false)

      const secretsDoc = JSON.parse(runner.store.get(`${SECRETS_STORE}/${SECRETS_KEY}`) ?? '')
      const decrypted = decryptActorSecret<Record<string, unknown>>(secretsDoc.keys.alice)
      expect(decrypted).toEqual(SEED_KEYS.alice)
      expect(message).toContain('src/actor-keys.ts')
    })

    it('restore --from-actor-keys accepts an explicit path', async () => {
      const io = new FakeIO()
      io.files.set('/tmp/keys.ts', actorKeysFile(SEED_KEYS))
      const runner = new FakeRunner()

      await runActorsBackup(['restore', '--from-actor-keys', '/tmp/keys.ts'], runner, io)

      const secretsDoc = JSON.parse(runner.store.get(`${SECRETS_STORE}/${SECRETS_KEY}`) ?? '')
      expect(decryptActorSecret<Record<string, unknown>>(secretsDoc.keys.bob)).toEqual(SEED_KEYS.bob)
    })

    it('throws on unknown or missing arguments', async () => {
      const runner = new FakeRunner()
      const io = new FakeIO()

      await expect(runActorsBackup([], runner, io)).rejects.toThrow()
      await expect(runActorsBackup(['frobnicate'], runner, io)).rejects.toThrow()
      await expect(runActorsBackup(['restore'], runner, io)).rejects.toThrow()
    })
  })
})
