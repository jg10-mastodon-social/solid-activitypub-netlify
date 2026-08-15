import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// Mock the base-url module
vi.mock('../../src/base-url.js', () => ({
  baseUrl: 'https://mocked.example.com'
}))

describe('loadConfig', () => {
  const originalEnv = process.env

  beforeEach(() => {
    process.env = { ...originalEnv }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it('uses baseUrl from base-url module', async () => {
    process.env.WHITELISTED_ISSUERS = 'https://mocked.example.com'
    process.env.SOLID_STORAGE_BASE_URL = 'https://pod.example.com/'

    const { loadConfig } = await import('../../src/config.js')
    const config = loadConfig()

    expect(config.baseUrl).toBe('https://mocked.example.com')
    expect(config.webId).toBe('https://mocked.example.com/webid')
    expect(config.issuer).toBe('https://mocked.example.com')
    expect(config.sendToUrl).toBe('https://mocked.example.com/outbox')
  })

  it('derives webId from baseUrl if WEBID is not set', async () => {
    delete process.env.WEBID
    process.env.WHITELISTED_ISSUERS = 'https://mocked.example.com'
    process.env.SOLID_STORAGE_BASE_URL = 'https://pod.example.com/'

    const { loadConfig } = await import('../../src/config.js')
    const config = loadConfig()

    expect(config.webId).toBe('https://mocked.example.com/webid')
  })

  it('derives issuer from baseUrl if ISSUER is not set', async () => {
    delete process.env.ISSUER
    process.env.WHITELISTED_ISSUERS = 'https://mocked.example.com'
    process.env.SOLID_STORAGE_BASE_URL = 'https://pod.example.com/'

    const { loadConfig } = await import('../../src/config.js')
    const config = loadConfig()

    expect(config.issuer).toBe('https://mocked.example.com')
  })

  it('derives sendToUrl from baseUrl if SEND_TO_URL is not set', async () => {
    delete process.env.SEND_TO_URL
    process.env.WHITELISTED_ISSUERS = 'https://mocked.example.com'
    process.env.SOLID_STORAGE_BASE_URL = 'https://pod.example.com/'

    const { loadConfig } = await import('../../src/config.js')
    const config = loadConfig()

    expect(config.sendToUrl).toBe('https://mocked.example.com/outbox')
  })

  it('throws when WHITELISTED_ISSUERS is missing', async () => {
    delete process.env.WHITELISTED_ISSUERS
    process.env.SOLID_STORAGE_BASE_URL = 'https://pod.example.com/'

    const { loadConfig } = await import('../../src/config.js')

    expect(() => loadConfig()).toThrow('WHITELISTED_ISSUERS is required')
  })

  it('throws when SOLID_STORAGE_BASE_URL is missing', async () => {
    delete process.env.SOLID_STORAGE_BASE_URL
    process.env.WHITELISTED_ISSUERS = 'https://mocked.example.com'

    const { loadConfig } = await import('../../src/config.js')

    expect(() => loadConfig()).toThrow('SOLID_STORAGE_BASE_URL is required')
  })

  it('parses comma-separated whitelisted issuers', async () => {
    process.env.WHITELISTED_ISSUERS = 'https://issuer1.example.com, https://issuer2.example.com ,https://issuer3.example.com'
    process.env.SOLID_STORAGE_BASE_URL = 'https://pod.example.com/'

    const { loadConfig } = await import('../../src/config.js')
    const config = loadConfig()

    expect(config.whitelistedIssuers).toEqual([
      'https://issuer1.example.com',
      'https://issuer2.example.com',
      'https://issuer3.example.com',
    ])
  })

  it('sets adminWebId from ADMIN_WEBID env var', async () => {
    process.env.ADMIN_WEBID = 'https://admin.example.com/webid#me'
    process.env.WHITELISTED_ISSUERS = 'https://mocked.example.com'
    process.env.SOLID_STORAGE_BASE_URL = 'https://pod.example.com/'

    const { loadConfig } = await import('../../src/config.js')
    const config = loadConfig()

    expect(config.adminWebId).toBe('https://admin.example.com/webid#me')
  })

  it('defaults adminWebId to empty string if not set', async () => {
    delete process.env.ADMIN_WEBID
    process.env.WHITELISTED_ISSUERS = 'https://mocked.example.com'
    process.env.SOLID_STORAGE_BASE_URL = 'https://pod.example.com/'

    const { loadConfig } = await import('../../src/config.js')
    const config = loadConfig()

    expect(config.adminWebId).toBe('')
  })

  it('returns inboxUrl and outboxUrl when SOLID_STORAGE_BASE_URL is valid', async () => {
    process.env.WHITELISTED_ISSUERS = 'https://mocked.example.com'
    process.env.SOLID_STORAGE_BASE_URL = 'https://pod.example.com/'

    const { loadConfig } = await import('../../src/config.js')
    const config = loadConfig()

    expect(config.inboxUrl).toBe('https://pod.example.com/inbox/')
    expect(config.outboxUrl).toBe('https://pod.example.com/outbox/')
  })

  it('throws when SOLID_STORAGE_BASE_URL is missing', async () => {
    delete process.env.SOLID_STORAGE_BASE_URL
    process.env.WHITELISTED_ISSUERS = 'https://mocked.example.com'

    const { loadConfig } = await import('../../src/config.js')

    expect(() => loadConfig()).toThrow('SOLID_STORAGE_BASE_URL is required')
  })

  it('throws when SOLID_STORAGE_BASE_URL does not end with /', async () => {
    process.env.WHITELISTED_ISSUERS = 'https://mocked.example.com'
    process.env.SOLID_STORAGE_BASE_URL = 'https://pod.example.com'

    const { loadConfig } = await import('../../src/config.js')

    expect(() => loadConfig()).toThrow('SOLID_STORAGE_BASE_URL must end with /')
  })

  it('defaults actorNames to ["actor"] when ACTOR_NAME is not set', async () => {
    delete process.env.ACTOR_NAME
    process.env.WHITELISTED_ISSUERS = 'https://mocked.example.com'
    process.env.SOLID_STORAGE_BASE_URL = 'https://pod.example.com/'

    const { loadConfig } = await import('../../src/config.js')
    const config = loadConfig()

    expect(config.actorNames).toEqual(['actor'])
    expect(config.actorByPath['/actor']).toBeDefined()
    expect(config.actorByPath['/actor'].url).toBe('https://mocked.example.com/actor')
    expect(config.actorByPath['/actor'].keyId).toBe('https://mocked.example.com/actor#main-key')
  })

  it('parses comma-separated ACTOR_NAME and builds actorByPath entries', async () => {
    process.env.ACTOR_NAME = 'alice,bob'
    process.env.WHITELISTED_ISSUERS = 'https://mocked.example.com'
    process.env.SOLID_STORAGE_BASE_URL = 'https://pod.example.com/'

    const { loadConfig } = await import('../../src/config.js')
    const config = loadConfig()

    expect(config.actorNames).toEqual(['alice', 'bob'])
    expect(config.actorByPath['/alice'].url).toBe('https://mocked.example.com/alice')
    expect(config.actorByPath['/bob'].url).toBe('https://mocked.example.com/bob')
  })

  it('trims whitespace and rejects empty ACTOR_NAME entries', async () => {
    process.env.ACTOR_NAME = '  alice , , bob  '
    process.env.WHITELISTED_ISSUERS = 'https://mocked.example.com'
    process.env.SOLID_STORAGE_BASE_URL = 'https://pod.example.com/'

    const { loadConfig } = await import('../../src/config.js')
    const config = loadConfig()

    expect(config.actorNames).toEqual(['alice', 'bob'])
  })
})