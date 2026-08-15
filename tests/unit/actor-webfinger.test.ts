import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'fs'
import path from 'path'
import { publicDir, baseUrlPath, actorKeysPath, webfingerDataPath, runScript } from '../helpers.js'

describe('actor and webfinger', () => {
  let originalBaseUrlContent: string | null = null
  let originalActorKeysContent: string | null = null
  let originalWebfingerDataContent: string | null = null

  beforeEach(() => {
    if (fs.existsSync(baseUrlPath)) {
      originalBaseUrlContent = fs.readFileSync(baseUrlPath, 'utf-8')
    } else {
      originalBaseUrlContent = null
    }
    if (fs.existsSync(actorKeysPath)) {
      originalActorKeysContent = fs.readFileSync(actorKeysPath, 'utf-8')
    } else {
      originalActorKeysContent = null
    }
    if (fs.existsSync(webfingerDataPath)) {
      originalWebfingerDataContent = fs.readFileSync(webfingerDataPath, 'utf-8')
    } else {
      originalWebfingerDataContent = null
    }

    if (fs.existsSync(publicDir)) {
      fs.rmSync(publicDir, { recursive: true, force: true })
    }
    if (fs.existsSync(baseUrlPath)) {
      fs.unlinkSync(baseUrlPath)
    }
    if (fs.existsSync(actorKeysPath)) {
      fs.unlinkSync(actorKeysPath)
    }
    if (fs.existsSync(webfingerDataPath)) {
      fs.unlinkSync(webfingerDataPath)
    }
  })

  afterEach(() => {
    if (fs.existsSync(publicDir)) {
      fs.rmSync(publicDir, { recursive: true, force: true })
    }
    if (originalBaseUrlContent !== null) {
      fs.writeFileSync(baseUrlPath, originalBaseUrlContent)
    } else if (fs.existsSync(baseUrlPath)) {
      fs.unlinkSync(baseUrlPath)
    }
    if (originalActorKeysContent !== null) {
      fs.writeFileSync(actorKeysPath, originalActorKeysContent)
    } else if (fs.existsSync(actorKeysPath)) {
      fs.unlinkSync(actorKeysPath)
    }
    if (originalWebfingerDataContent !== null) {
      fs.writeFileSync(webfingerDataPath, originalWebfingerDataContent)
    } else if (fs.existsSync(webfingerDataPath)) {
      fs.unlinkSync(webfingerDataPath)
    }
  })

  describe('actor file', () => {
    it('creates actor file', async () => {
      await runScript(undefined, 'production')
      const actorPath = path.join(publicDir, 'actor')
      expect(fs.existsSync(actorPath)).toBe(true)
    })

    it('has ActivityStreams context', async () => {
      await runScript(undefined, 'production')
      const actorPath = path.join(publicDir, 'actor')
      const actor = JSON.parse(fs.readFileSync(actorPath, 'utf-8'))
      expect(actor['@context']).toContain('https://www.w3.org/ns/activitystreams')
      expect(actor['@context']).toContain('https://w3id.org/security/v1')
    })

    it('sets type to Service', async () => {
      await runScript(undefined, 'production')
      const actorPath = path.join(publicDir, 'actor')
      const actor = JSON.parse(fs.readFileSync(actorPath, 'utf-8'))
      expect(actor.type).toBe('Service')
    })

    it('sets id to baseUrl/actor', async () => {
      await runScript(undefined, 'production')
      const actorPath = path.join(publicDir, 'actor')
      const actor = JSON.parse(fs.readFileSync(actorPath, 'utf-8'))
      expect(actor.id).toBe('https://example.com/actor')
    })

    it('sets preferredUsername to actor', async () => {
      await runScript(undefined, 'production')
      const actorPath = path.join(publicDir, 'actor')
      const actor = JSON.parse(fs.readFileSync(actorPath, 'utf-8'))
      expect(actor.preferredUsername).toBe('actor')
    })

    it('sets inbox and outbox endpoints', async () => {
      await runScript(undefined, 'production')
      const actorPath = path.join(publicDir, 'actor')
      const actor = JSON.parse(fs.readFileSync(actorPath, 'utf-8'))
      expect(actor.inbox).toBe('https://example.com/actor/inbox')
      expect(actor.outbox).toBe('https://example.com/actor/outbox')
    })

    it('sets followers, following, liked collections', async () => {
      await runScript(undefined, 'production')
      const actorPath = path.join(publicDir, 'actor')
      const actor = JSON.parse(fs.readFileSync(actorPath, 'utf-8'))
      expect(actor.followers).toBe('https://example.com/actor/followers')
      expect(actor.following).toBe('https://example.com/actor/following')
      expect(actor.liked).toBe('https://example.com/actor/liked')
    })

    it('includes publicKey with PEM format', async () => {
      await runScript(undefined, 'production')
      const actorPath = path.join(publicDir, 'actor')
      const actor = JSON.parse(fs.readFileSync(actorPath, 'utf-8'))
      expect(actor.publicKey).toBeDefined()
      expect(actor.publicKey.id).toBe('https://example.com/actor#main-key')
      expect(actor.publicKey.owner).toBe('https://example.com/actor')
      expect(actor.publicKey.publicKeyPem).toMatch(/-----BEGIN PUBLIC KEY-----[\s\S]+-----END PUBLIC KEY-----/)
    })

    it('sets manuallyApprovesFollowers to false', async () => {
      await runScript(undefined, 'production')
      const actorPath = path.join(publicDir, 'actor')
      const actor = JSON.parse(fs.readFileSync(actorPath, 'utf-8'))
      expect(actor.manuallyApprovesFollowers).toBe(false)
    })
  })

  describe('actor keys', () => {
    it('creates actor keys file', async () => {
      await runScript(undefined, 'production')
      expect(fs.existsSync(actorKeysPath)).toBe(true)
    })

    it('exports actorKeys const', async () => {
      await runScript(undefined, 'production')
      const content = fs.readFileSync(actorKeysPath, 'utf-8')
      expect(content).toContain('export const actorKeys')
    })

    it('generates RSA key type', async () => {
      await runScript(undefined, 'production')
      const content = fs.readFileSync(actorKeysPath, 'utf-8')
      expect(content).toContain('"kty": "RSA"')
    })

    it('contains an entry per configured actor', async () => {
      await runScript(undefined, 'production', 'alice,bob')
      const content = fs.readFileSync(actorKeysPath, 'utf-8')
      expect(content).toContain('"alice"')
      expect(content).toContain('"bob"')
    })
  })

  describe('webfinger data', () => {
    it('creates webfinger data file', async () => {
      await runScript(undefined, 'production')
      expect(fs.existsSync(webfingerDataPath)).toBe(true)
    })

    it('exports webfingerEntries const', async () => {
      await runScript(undefined, 'production')
      const content = fs.readFileSync(webfingerDataPath, 'utf-8')
      expect(content).toContain('export const webfingerEntries')
    })

    it('contains an entry per configured actor', async () => {
      await runScript(undefined, 'production', 'alice,bob')
      const content = fs.readFileSync(webfingerDataPath, 'utf-8')
      expect(content).toContain('acct:alice@example.com')
      expect(content).toContain('acct:bob@example.com')
    })

    it('contains self link with application/activity+json type', async () => {
      await runScript(undefined, 'production', 'myactor')
      const content = fs.readFileSync(webfingerDataPath, 'utf-8')
      expect(content).toContain('https://example.com/myactor')
      expect(content).toContain('application/activity+json')
    })
  })

  describe('with ACTOR_NAME env var', () => {
    it('sets actor id to baseUrl/actorName', async () => {
      await runScript(undefined, 'production', 'myactor')
      const actorPath = path.join(publicDir, 'myactor')
      const actor = JSON.parse(fs.readFileSync(actorPath, 'utf-8'))
      expect(actor.id).toBe('https://example.com/myactor')
    })

    it('sets preferredUsername to actorName', async () => {
      await runScript(undefined, 'production', 'myactor')
      const actorPath = path.join(publicDir, 'myactor')
      const actor = JSON.parse(fs.readFileSync(actorPath, 'utf-8'))
      expect(actor.preferredUsername).toBe('myactor')
    })

    it('sets publicKey id using actorName', async () => {
      await runScript(undefined, 'production', 'myactor')
      const actorPath = path.join(publicDir, 'myactor')
      const actor = JSON.parse(fs.readFileSync(actorPath, 'utf-8'))
      expect(actor.publicKey.id).toBe('https://example.com/myactor#main-key')
      expect(actor.publicKey.owner).toBe('https://example.com/myactor')
    })

    it('records webfinger entry using actorName', async () => {
      await runScript(undefined, 'production', 'myactor')
      const content = fs.readFileSync(webfingerDataPath, 'utf-8')
      expect(content).toContain('acct:myactor@example.com')
      expect(content).toContain('https://example.com/myactor')
    })

    it('emits one public/<name> file per actor when ACTOR_NAME lists multiple', async () => {
      await runScript(undefined, 'production', 'alice,bob')
      expect(fs.existsSync(path.join(publicDir, 'alice'))).toBe(true)
      expect(fs.existsSync(path.join(publicDir, 'bob'))).toBe(true)
      const alice = JSON.parse(fs.readFileSync(path.join(publicDir, 'alice'), 'utf-8'))
      const bob = JSON.parse(fs.readFileSync(path.join(publicDir, 'bob'), 'utf-8'))
      expect(alice.id).toBe('https://example.com/alice')
      expect(bob.id).toBe('https://example.com/bob')
    })
  })
})