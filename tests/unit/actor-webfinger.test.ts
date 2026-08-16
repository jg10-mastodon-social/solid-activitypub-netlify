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
    it('records webfinger entry using actorName', async () => {
      await runScript(undefined, 'production', 'myactor')
      const content = fs.readFileSync(webfingerDataPath, 'utf-8')
      expect(content).toContain('acct:myactor@example.com')
      expect(content).toContain('https://example.com/myactor')
    })
  })
})