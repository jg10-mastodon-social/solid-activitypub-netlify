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

    it('preserves existing actor keys when actor name already exists', async () => {
      const seedKey = { kty: 'RSA', e: 'AQAB', n: 'seeded-n-value', d: 'seeded-d', p: 'seeded-p', q: 'seeded-q', dp: 'seeded-dp', dq: 'seeded-dq', qi: 'seeded-qi' }
      const seedContent = `export const actorKeys: Record<string, Record<string, unknown>> = ${JSON.stringify({ alice: seedKey }, null, 2)}\n`
      fs.writeFileSync(actorKeysPath, seedContent)

      await runScript(undefined, 'production', 'alice')

      const content = fs.readFileSync(actorKeysPath, 'utf-8')
      expect(content).toContain('"alice"')
      expect(content).toContain('"n": "seeded-n-value"')
      expect(content).toContain('"d": "seeded-d"')
      expect(content).toContain('"p": "seeded-p"')
      expect(content).toContain('"q": "seeded-q"')
      expect(content).toContain('"qi": "seeded-qi"')
    })

    it('generates a fresh key for a newly-added actor name', async () => {
      const seedKey = { kty: 'RSA', e: 'AQAB', n: 'seeded-n-value', d: 'seeded-d', p: 'seeded-p', q: 'seeded-q', dp: 'seeded-dp', dq: 'seeded-dq', qi: 'seeded-qi' }
      const seedContent = `export const actorKeys: Record<string, Record<string, unknown>> = ${JSON.stringify({ alice: seedKey }, null, 2)}\n`
      fs.writeFileSync(actorKeysPath, seedContent)

      await runScript(undefined, 'production', 'alice,bob')

      const content = fs.readFileSync(actorKeysPath, 'utf-8')
      expect(content).toContain('"alice"')
      expect(content).toContain('"bob"')
      expect(content).toContain('"n": "seeded-n-value"')
      expect(content).not.toContain('"n": "seeded-bob"')
    })

    it('keeps actor keys for names no longer listed in ACTOR_NAME', async () => {
      const seedKey = { kty: 'RSA', e: 'AQAB', n: 'seeded-n-value', d: 'seeded-d', p: 'seeded-p', q: 'seeded-q', dp: 'seeded-dp', dq: 'seeded-dq', qi: 'seeded-qi' }
      const seedContent = `export const actorKeys: Record<string, Record<string, unknown>> = ${JSON.stringify({ retired: seedKey }, null, 2)}\n`
      fs.writeFileSync(actorKeysPath, seedContent)

      await runScript(undefined, 'production', 'alice')

      const content = fs.readFileSync(actorKeysPath, 'utf-8')
      expect(content).toContain('"alice"')
      expect(content).toContain('"retired"')
      expect(content).toContain('"n": "seeded-n-value"')
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

    it('regenerates webfinger entries for currently-configured actors under current BASE_URL', async () => {
      const seedEntry = { subject: 'acct:alice@example.com', aliases: ['https://old.example/alice'], links: [{ rel: 'self', type: 'application/activity+json', href: 'https://old.example/alice' }] }
      const seedContent = `export const webfingerEntries: Record<string, unknown> = ${JSON.stringify({ 'acct:alice@example.com': seedEntry }, null, 2)}\n`
      fs.writeFileSync(webfingerDataPath, seedContent)

      await runScript(undefined, 'production', 'alice')

      const content = fs.readFileSync(webfingerDataPath, 'utf-8')
      expect(content).toContain('acct:alice@example.com')
      expect(content).toContain('https://example.com/alice')
      expect(content).not.toContain('https://old.example/alice')
    })

    it('preserves webfinger entries for actors no longer in ACTOR_NAME', async () => {
      const seedEntry = { subject: 'acct:retired@old.example', aliases: ['https://old.example/retired'], links: [{ rel: 'self', type: 'application/activity+json', href: 'https://old.example/retired' }] }
      const seedContent = `export const webfingerEntries: Record<string, unknown> = ${JSON.stringify({ 'acct:retired@old.example': seedEntry }, null, 2)}\n`
      fs.writeFileSync(webfingerDataPath, seedContent)

      await runScript(undefined, 'production', 'alice')

      const content = fs.readFileSync(webfingerDataPath, 'utf-8')
      expect(content).toContain('acct:retired@old.example')
      expect(content).toContain('acct:alice@example.com')
    })
  })

  describe('with ACTOR_NAME env var', () => {
    it('records webfinger entry using actorName', async () => {
      await runScript(undefined, 'production', 'myactor')
      const content = fs.readFileSync(webfingerDataPath, 'utf-8')
      expect(content).toContain('acct:myactor@example.com')
      expect(content).toContain('https://example.com/myactor')
    })
  })
})