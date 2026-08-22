import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'fs'
import path from 'path'
import { publicDir, privateKeyPath, baseUrlPath, runScript, rootDir } from '../helpers.js'

describe('generate-identity', () => {
  let originalBaseUrlContent: string | null = null
  let originalPrivateKeyContent: string | null = null

  beforeEach(() => {
    // Save original content
    if (fs.existsSync(baseUrlPath)) {
      originalBaseUrlContent = fs.readFileSync(baseUrlPath, 'utf-8')
    } else {
      originalBaseUrlContent = null
    }
    if (fs.existsSync(privateKeyPath)) {
      originalPrivateKeyContent = fs.readFileSync(privateKeyPath, 'utf-8')
    } else {
      originalPrivateKeyContent = null
    }

    // Delete for clean state
    if (fs.existsSync(publicDir)) {
      fs.rmSync(publicDir, { recursive: true, force: true })
    }
    if (fs.existsSync(baseUrlPath)) {
      fs.unlinkSync(baseUrlPath)
    }
    if (fs.existsSync(privateKeyPath)) {
      fs.unlinkSync(privateKeyPath)
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
    if (originalPrivateKeyContent !== null) {
      fs.writeFileSync(privateKeyPath, originalPrivateKeyContent)
    } else if (fs.existsSync(privateKeyPath)) {
      fs.unlinkSync(privateKeyPath)
    }
  })

  describe('with CONTEXT=production', () => {
    it('uses URL env var', async () => {
      const result = await runScript(undefined, 'production')
      expect(result.exitCode).toBe(0)

      const content = fs.readFileSync(baseUrlPath, 'utf-8')
      expect(content).toContain("export const baseUrl = 'https://example.com'")
    })

    it('writes webid using URL', async () => {
      await runScript(undefined, 'production')

      const webidPath = path.join(publicDir, 'webid')
      expect(fs.existsSync(webidPath)).toBe(true)
      const content = fs.readFileSync(webidPath, 'utf-8')
      expect(content).toContain('https://example.com/webid')
    })

    it('writes openid-configuration using URL', async () => {
      await runScript(undefined, 'production')

      const openidPath = path.join(publicDir, '.well-known', 'openid-configuration')
      expect(fs.existsSync(openidPath)).toBe(true)
      const content = JSON.parse(fs.readFileSync(openidPath, 'utf-8'))
      expect(content.issuer).toBe('https://example.com')
      expect(content.authorization_endpoint).toBe('https://example.com/authorize')
      expect(content.token_endpoint).toBe('https://example.com/token')
      expect(content.jwks_uri).toBe('https://example.com/jwks.json')
    })
  })

  describe('with CONTEXT=deploy-preview', () => {
    it('uses DEPLOY_URL env var', async () => {
      const result = await runScript(undefined, 'deploy-preview')
      expect(result.exitCode).toBe(0)

      const content = fs.readFileSync(baseUrlPath, 'utf-8')
      expect(content).toContain("export const baseUrl = 'https://deploy-preview-123.netlify.app'")
    })

    it('writes webid using DEPLOY_URL', async () => {
      await runScript(undefined, 'deploy-preview')

      const webidPath = path.join(publicDir, 'webid')
      expect(fs.existsSync(webidPath)).toBe(true)
      const content = fs.readFileSync(webidPath, 'utf-8')
      expect(content).toContain('https://deploy-preview-123.netlify.app/webid')
    })

    it('writes openid-configuration using DEPLOY_URL', async () => {
      await runScript(undefined, 'deploy-preview')

      const openidPath = path.join(publicDir, '.well-known', 'openid-configuration')
      expect(fs.existsSync(openidPath)).toBe(true)
      const content = JSON.parse(fs.readFileSync(openidPath, 'utf-8'))
      expect(content.issuer).toBe('https://deploy-preview-123.netlify.app')
      expect(content.authorization_endpoint).toBe('https://deploy-preview-123.netlify.app/authorize')
      expect(content.token_endpoint).toBe('https://deploy-preview-123.netlify.app/token')
      expect(content.jwks_uri).toBe('https://deploy-preview-123.netlify.app/jwks.json')
    })
  })

  describe('when JWKS env var is not set', () => {
    it('exits successfully', async () => {
      const result = await runScript()
      expect(result.exitCode).toBe(0)
      expect(result.stderr).not.toContain('Error')
    })

    it('generates new key pair', async () => {
      await runScript()

      expect(fs.existsSync(privateKeyPath)).toBe(true)
      const content = fs.readFileSync(privateKeyPath, 'utf-8')
      expect(content).toContain('export const privateKey')
    })

    it('writes public/jwks.json', async () => {
      await runScript()

      const jwksPath = path.join(publicDir, 'jwks.json')
      expect(fs.existsSync(jwksPath)).toBe(true)

      const jwks = JSON.parse(fs.readFileSync(jwksPath, 'utf-8'))
      expect(jwks).toHaveProperty('keys')
      expect(Array.isArray(jwks.keys)).toBe(true)
      expect(jwks.keys.length).toBe(1)
      expect(jwks.keys[0]).toHaveProperty('kty', 'EC')
      expect(jwks.keys[0]).toHaveProperty('crv', 'P-256')
      expect(jwks.keys[0]).toHaveProperty('x')
      expect(jwks.keys[0]).toHaveProperty('y')
      expect(jwks.keys[0]).not.toHaveProperty('d')
    })

    it('writes public/webid', async () => {
      await runScript()

      const webidPath = path.join(publicDir, 'webid')
      expect(fs.existsSync(webidPath)).toBe(true)
      const content = fs.readFileSync(webidPath, 'utf-8')
      expect(content).toContain('http://localhost:9999/webid')
    })
  })

  describe('when JWKS env var is set', () => {
    it('exits successfully when kid is present', async () => {
      const existingJwks = JSON.stringify({ kty: 'EC', crv: 'P-256', x: 'Ume6Ll4M4KINn10XYvKcRwdowi7P2lYTQpI41aBg3qc', y: '0v4HYYHF-UB61yiS2RxgXnbCaW7C82GvpauQS0ScTBU', d: 'test-d', alg: 'ES256', use: 'sig', kid: 'test-kid' })
      const result = await runScript(existingJwks)
      expect(result.exitCode).toBe(0)
    })

    it('fails when kid is missing', async () => {
      const existingJwks = JSON.stringify({ kty: 'EC', crv: 'P-256', x: 'Ume6Ll4M4KINn10XYvKcRwdowi7P2lYTQpI41aBg3qc', y: '0v4HYYHF-UB61yiS2RxgXnbCaW7C82GvpauQS0ScTBU', d: 'test-d', alg: 'ES256', use: 'sig' })
      const result = await runScript(existingJwks)
      expect(result.exitCode).toBe(1)
      expect(result.stderr).toContain('kid')
    })

    it('writes private key to src/private-key.ts', async () => {
      const existingJwks = JSON.stringify({ kty: 'EC', crv: 'P-256', x: 'Ume6Ll4M4KINn10XYvKcRwdowi7P2lYTQpI41aBg3qc', y: '0v4HYYHF-UB61yiS2RxgXnbCaW7C82GvpauQS0ScTBU', d: 'test-d', alg: 'ES256', use: 'sig', kid: 'my-test-kid' })
      await runScript(existingJwks)

      expect(fs.existsSync(privateKeyPath)).toBe(true)
      const content = fs.readFileSync(privateKeyPath, 'utf-8')
      expect(content).toContain('export const privateKey')
    })

    it('writes public/jwks.json using kid from JWKS', async () => {
      const existingJwks = JSON.stringify({ kty: 'EC', crv: 'P-256', x: 'Ume6Ll4M4KINn10XYvKcRwdowi7P2lYTQpI41aBg3qc', y: '0v4HYYHF-UB61yiS2RxgXnbCaW7C82GvpauQS0ScTBU', d: 'test-d', alg: 'ES256', use: 'sig', kid: 'my-test-kid' })
      await runScript(existingJwks)

      const jwksPath = path.join(publicDir, 'jwks.json')
      expect(fs.existsSync(jwksPath)).toBe(true)

      const jwks = JSON.parse(fs.readFileSync(jwksPath, 'utf-8'))
      expect(jwks.keys[0]).toHaveProperty('x', 'Ume6Ll4M4KINn10XYvKcRwdowi7P2lYTQpI41aBg3qc')
      expect(jwks.keys[0]).toHaveProperty('y', '0v4HYYHF-UB61yiS2RxgXnbCaW7C82GvpauQS0ScTBU')
      expect(jwks.keys[0]).not.toHaveProperty('d')
      expect(jwks.keys[0]).toHaveProperty('kid', 'my-test-kid')
    })
  })

  describe('new key generation', () => {
    it('generates kid as SHA-256 hash of public key', async () => {
      await runScript()

      const jwksPath = path.join(publicDir, 'jwks.json')
      const jwks = JSON.parse(fs.readFileSync(jwksPath, 'utf-8'))

      expect(jwks.keys[0]).toHaveProperty('kid')
      expect(jwks.keys[0].kid).toBeDefined()
      expect(typeof jwks.keys[0].kid).toBe('string')
      expect(jwks.keys[0].kid.length).toBeGreaterThan(10)
    })

    it('writes private key with same kid to src/private-key.ts', async () => {
      await runScript()

      const jwksPath = path.join(publicDir, 'jwks.json')
      const jwks = JSON.parse(fs.readFileSync(jwksPath, 'utf-8'))
      const expectedKid = jwks.keys[0].kid

      const content = fs.readFileSync(privateKeyPath, 'utf-8')
      expect(content).toContain(`"kid":"${expectedKid}"`)
    })
  })

  describe('default UI generation', () => {
    const landingPath = path.join(publicDir, 'index.html')
    const actorPageTemplatePath = path.join(publicDir, 'actor-page.template.html')
    const templatesDir = path.join(publicDir, 'templates')
    const importHtmlPath = path.join(templatesDir, 'ImportHtml.js')
    const outboxFragmentPath = path.join(templatesDir, 'discussion', 'outbox.html')
    const headerFragmentPath = path.join(templatesDir, 'discussion', 'header.html')

    it('writes public/index.html with one link per actor', async () => {
      await runScript(undefined, undefined, 'alice,bob')

      expect(fs.existsSync(landingPath)).toBe(true)
      const content = fs.readFileSync(landingPath, 'utf-8')
      expect(content).toContain('href="/alice"')
      expect(content).toContain('href="/bob"')
      expect(content).toContain('@alice@localhost:9999')
      expect(content).toContain('@bob@localhost:9999')
      expect(content).not.toContain('{{')
    })

    it('wires the login fragment into public/index.html', async () => {
      await runScript(undefined, undefined, 'alice')

      const landingContent = fs.readFileSync(landingPath, 'utf-8')
      expect(landingContent).toContain('<pos-app restore-previous-session>')
      expect(landingContent).toContain('<pos-router mode="pod">')
      expect(landingContent).toContain('<pos-resource uri="http://localhost:9999/">')
      expect(landingContent).toContain('<import-html src="/templates/actor-controls.html">')
      expect(landingContent).toContain('src="/templates/actor-controls.js"')
      expect(landingContent).toContain('<ul id="actors">')
      expect(landingContent).not.toContain('{{')

      const fragmentPath = path.join(publicDir, 'templates', 'actor-controls.html')
      const fragmentContent = fs.readFileSync(fragmentPath, 'utf-8')
      expect(fragmentContent).toContain('<pos-login>')
      expect(fragmentContent).toContain('<pos-type-badges>')
      expect(fragmentContent).toContain('https://www.w3.org/ns/activitystreams#Service')
      expect(fragmentContent).toContain('https://www.w3.org/ns/activitystreams#Person')
      expect(fragmentContent).toContain('https://www.w3.org/ns/activitystreams#Group')
      expect(fragmentContent).toContain('https://www.w3.org/ns/activitystreams#Organization')
      expect(fragmentContent).toContain('https://www.w3.org/ns/activitystreams#Application')

      const jsPath = path.join(publicDir, 'templates', 'actor-controls.js')
      expect(fs.existsSync(jsPath)).toBe(true)
    })

    it('uses production domain in landing links', async () => {
      await runScript(undefined, 'production', 'alice')

      const content = fs.readFileSync(landingPath, 'utf-8')
      expect(content).toContain('@alice@example.com')
    })

    it('copies public/actor-page.template.html with placeholders intact', async () => {
      await runScript()

      expect(fs.existsSync(actorPageTemplatePath)).toBe(true)
      const content = fs.readFileSync(actorPageTemplatePath, 'utf-8')
      expect(content).toContain('{{BASE_URL}}')
      expect(content).toContain('{{ACTOR_NAME}}')
      expect(content).toContain('{{DOMAIN}}')
    })

    it('copies public/templates/ImportHtml.js', async () => {
      await runScript()

      expect(fs.existsSync(importHtmlPath)).toBe(true)
      const content = fs.readFileSync(importHtmlPath, 'utf-8')
      expect(content).toContain('import-html')
    })

    it('copies public/templates/discussion/outbox.html and header.html', async () => {
      await runScript()

      expect(fs.existsSync(outboxFragmentPath)).toBe(true)
      expect(fs.existsSync(headerFragmentPath)).toBe(true)
      const outbox = fs.readFileSync(outboxFragmentPath, 'utf-8')
      expect(outbox).toContain('activitystreams#first')
      const header = fs.readFileSync(headerFragmentPath, 'utf-8')
      expect(header).toContain('Discussion')
    })
  })
})
