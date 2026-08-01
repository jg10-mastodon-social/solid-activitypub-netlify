import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'fs'
import path from 'path'
import { publicDir, actorPrivateKeyPath, baseUrlPath, runScript, rootDir } from '../helpers.js'

describe('actor and webfinger', () => {
  let originalBaseUrlContent: string | null = null
  let originalActorPrivateKeyContent: string | null = null

  beforeEach(() => {
    // Save original content
    if (fs.existsSync(baseUrlPath)) {
      originalBaseUrlContent = fs.readFileSync(baseUrlPath, 'utf-8')
    } else {
      originalBaseUrlContent = null
    }
    if (fs.existsSync(actorPrivateKeyPath)) {
      originalActorPrivateKeyContent = fs.readFileSync(actorPrivateKeyPath, 'utf-8')
    } else {
      originalActorPrivateKeyContent = null
    }

    // Delete for clean state
    if (fs.existsSync(publicDir)) {
      fs.rmSync(publicDir, { recursive: true, force: true })
    }
    if (fs.existsSync(baseUrlPath)) {
      fs.unlinkSync(baseUrlPath)
    }
    if (fs.existsSync(actorPrivateKeyPath)) {
      fs.unlinkSync(actorPrivateKeyPath)
    }
  })

  afterEach(() => {
    // Clean up generated files
    if (fs.existsSync(publicDir)) {
      fs.rmSync(publicDir, { recursive: true, force: true })
    }

    // Restore original content
    if (originalBaseUrlContent !== null) {
      fs.writeFileSync(baseUrlPath, originalBaseUrlContent)
    } else if (fs.existsSync(baseUrlPath)) {
      fs.unlinkSync(baseUrlPath)
    }
    if (originalActorPrivateKeyContent !== null) {
      fs.writeFileSync(actorPrivateKeyPath, originalActorPrivateKeyContent)
    } else if (fs.existsSync(actorPrivateKeyPath)) {
      fs.unlinkSync(actorPrivateKeyPath)
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
      expect(actor.inbox).toBe('https://example.com/inbox')
      expect(actor.outbox).toBe('https://example.com/outbox')
    })

    it('sets followers, following, liked collections', async () => {
      await runScript(undefined, 'production')
      const actorPath = path.join(publicDir, 'actor')
      const actor = JSON.parse(fs.readFileSync(actorPath, 'utf-8'))
      expect(actor.followers).toBe('https://example.com/followers')
      expect(actor.following).toBe('https://example.com/following')
      expect(actor.liked).toBe('https://example.com/liked')
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

  describe('webfinger file', () => {
    it('creates webfinger file', async () => {
      await runScript(undefined, 'production')
      const webfingerPath = path.join(publicDir, '.well-known', 'webfinger')
      expect(fs.existsSync(webfingerPath)).toBe(true)
    })

    it('sets subject to acct:actor@domain', async () => {
      await runScript(undefined, 'production')
      const webfingerPath = path.join(publicDir, '.well-known', 'webfinger')
      const webfinger = JSON.parse(fs.readFileSync(webfingerPath, 'utf-8'))
      expect(webfinger.subject).toBe('acct:actor@example.com')
    })

    it('includes alias to actor URL', async () => {
      await runScript(undefined, 'production')
      const webfingerPath = path.join(publicDir, '.well-known', 'webfinger')
      const webfinger = JSON.parse(fs.readFileSync(webfingerPath, 'utf-8'))
      expect(webfinger.aliases).toContain('https://example.com/actor')
    })

    it('has self link with application/activity+json type', async () => {
      await runScript(undefined, 'production')
      const webfingerPath = path.join(publicDir, '.well-known', 'webfinger')
      const webfinger = JSON.parse(fs.readFileSync(webfingerPath, 'utf-8'))
      const selfLink = webfinger.links.find((l: any) => l.rel === 'self')
      expect(selfLink).toBeDefined()
      expect(selfLink.type).toBe('application/activity+json')
      expect(selfLink.href).toBe('https://example.com/actor')
    })
  })

  describe('actor private key', () => {
    it('creates actor private key file', async () => {
      await runScript(undefined, 'production')
      expect(fs.existsSync(actorPrivateKeyPath)).toBe(true)
    })

    it('exports actorPrivateKey const', async () => {
      await runScript(undefined, 'production')
      const content = fs.readFileSync(actorPrivateKeyPath, 'utf-8')
      expect(content).toContain('export const actorPrivateKey')
    })

    it('generates RSA key type', async () => {
      await runScript(undefined, 'production')
      const content = fs.readFileSync(actorPrivateKeyPath, 'utf-8')
      expect(content).toContain('"kty":"RSA"')
    })
  })

  describe('with ACTOR_NAME env var', () => {
    it('sets actor id to baseUrl/actorName', async () => {
      await runScript(undefined, 'production', 'myactor')
      const actorPath = path.join(publicDir, 'actor')
      const actor = JSON.parse(fs.readFileSync(actorPath, 'utf-8'))
      expect(actor.id).toBe('https://example.com/myactor')
    })

    it('sets preferredUsername to actorName', async () => {
      await runScript(undefined, 'production', 'myactor')
      const actorPath = path.join(publicDir, 'actor')
      const actor = JSON.parse(fs.readFileSync(actorPath, 'utf-8'))
      expect(actor.preferredUsername).toBe('myactor')
    })

    it('sets publicKey id using actorName', async () => {
      await runScript(undefined, 'production', 'myactor')
      const actorPath = path.join(publicDir, 'actor')
      const actor = JSON.parse(fs.readFileSync(actorPath, 'utf-8'))
      expect(actor.publicKey.id).toBe('https://example.com/myactor#main-key')
      expect(actor.publicKey.owner).toBe('https://example.com/myactor')
    })

    it('sets webfinger subject using actorName', async () => {
      await runScript(undefined, 'production', 'myactor')
      const webfingerPath = path.join(publicDir, '.well-known', 'webfinger')
      const webfinger = JSON.parse(fs.readFileSync(webfingerPath, 'utf-8'))
      expect(webfinger.subject).toBe('acct:myactor@example.com')
      expect(webfinger.aliases).toContain('https://example.com/myactor')
      const selfLink = webfinger.links.find((l: any) => l.rel === 'self')
      expect(selfLink.href).toBe('https://example.com/myactor')
    })
  })
})
