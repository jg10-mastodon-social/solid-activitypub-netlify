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
    process.env.HANDLER_BASE_URL = 'https://mocked.example.com/handlers#'
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
    process.env.HANDLER_BASE_URL = 'https://mocked.example.com/handlers#'
    process.env.SOLID_STORAGE_BASE_URL = 'https://pod.example.com/'

    const { loadConfig } = await import('../../src/config.js')
    const config = loadConfig()

    expect(config.webId).toBe('https://mocked.example.com/webid')
  })

  it('derives issuer from baseUrl if ISSUER is not set', async () => {
    delete process.env.ISSUER
    process.env.WHITELISTED_ISSUERS = 'https://mocked.example.com'
    process.env.HANDLER_BASE_URL = 'https://mocked.example.com/handlers#'
    process.env.SOLID_STORAGE_BASE_URL = 'https://pod.example.com/'

    const { loadConfig } = await import('../../src/config.js')
    const config = loadConfig()

    expect(config.issuer).toBe('https://mocked.example.com')
  })

  it('derives sendToUrl from baseUrl if SEND_TO_URL is not set', async () => {
    delete process.env.SEND_TO_URL
    process.env.WHITELISTED_ISSUERS = 'https://mocked.example.com'
    process.env.HANDLER_BASE_URL = 'https://mocked.example.com/handlers#'
    process.env.SOLID_STORAGE_BASE_URL = 'https://pod.example.com/'

    const { loadConfig } = await import('../../src/config.js')
    const config = loadConfig()

    expect(config.sendToUrl).toBe('https://mocked.example.com/outbox')
  })

  it('throws when WHITELISTED_ISSUERS is missing', async () => {
    delete process.env.WHITELISTED_ISSUERS
    process.env.HANDLER_BASE_URL = 'https://mocked.example.com/handlers#'
    process.env.SOLID_STORAGE_BASE_URL = 'https://pod.example.com/'

    const { loadConfig } = await import('../../src/config.js')

    expect(() => loadConfig()).toThrow('WHITELISTED_ISSUERS is required')
  })

  it('throws when SOLID_STORAGE_BASE_URL is missing', async () => {
    delete process.env.SOLID_STORAGE_BASE_URL
    process.env.WHITELISTED_ISSUERS = 'https://mocked.example.com'
    process.env.HANDLER_BASE_URL = 'https://mocked.example.com/handlers#'

    const { loadConfig } = await import('../../src/config.js')

    expect(() => loadConfig()).toThrow('SOLID_STORAGE_BASE_URL is required')
  })

  it('throws when HANDLER_BASE_URL is missing', async () => {
    delete process.env.HANDLER_BASE_URL
    process.env.WHITELISTED_ISSUERS = 'https://mocked.example.com'
    process.env.SOLID_STORAGE_BASE_URL = 'https://pod.example.com/'

    const { loadConfig } = await import('../../src/config.js')

    expect(() => loadConfig()).toThrow('HANDLER_BASE_URL is required')
  })

  it('parses comma-separated whitelisted issuers', async () => {
    process.env.WHITELISTED_ISSUERS = 'https://issuer1.example.com, https://issuer2.example.com ,https://issuer3.example.com'
    process.env.HANDLER_BASE_URL = 'https://mocked.example.com/handlers#'
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
    process.env.HANDLER_BASE_URL = 'https://mocked.example.com/handlers#'
    process.env.SOLID_STORAGE_BASE_URL = 'https://pod.example.com/'

    const { loadConfig } = await import('../../src/config.js')
    const config = loadConfig()

    expect(config.adminWebId).toBe('https://admin.example.com/webid#me')
  })

  it('defaults adminWebId to empty string if not set', async () => {
    delete process.env.ADMIN_WEBID
    process.env.WHITELISTED_ISSUERS = 'https://mocked.example.com'
    process.env.HANDLER_BASE_URL = 'https://mocked.example.com/handlers#'
    process.env.SOLID_STORAGE_BASE_URL = 'https://pod.example.com/'

    const { loadConfig } = await import('../../src/config.js')
    const config = loadConfig()

    expect(config.adminWebId).toBe('')
  })

  it('returns inboxUrl and outboxUrl when SOLID_STORAGE_BASE_URL is valid', async () => {
    process.env.WHITELISTED_ISSUERS = 'https://mocked.example.com'
    process.env.HANDLER_BASE_URL = 'https://mocked.example.com/handlers#'
    process.env.SOLID_STORAGE_BASE_URL = 'https://pod.example.com/'

    const { loadConfig } = await import('../../src/config.js')
    const config = loadConfig()

    expect(config.inboxUrl).toBe('https://pod.example.com/inbox/')
    expect(config.outboxUrl).toBe('https://pod.example.com/outbox/')
  })

  it('throws when SOLID_STORAGE_BASE_URL is missing', async () => {
    delete process.env.SOLID_STORAGE_BASE_URL
    process.env.WHITELISTED_ISSUERS = 'https://mocked.example.com'
    process.env.HANDLER_BASE_URL = 'https://mocked.example.com/handlers#'

    const { loadConfig } = await import('../../src/config.js')

    expect(() => loadConfig()).toThrow('SOLID_STORAGE_BASE_URL is required')
  })

  it('throws when SOLID_STORAGE_BASE_URL does not end with /', async () => {
    process.env.WHITELISTED_ISSUERS = 'https://mocked.example.com'
    process.env.HANDLER_BASE_URL = 'https://mocked.example.com/handlers#'
    process.env.SOLID_STORAGE_BASE_URL = 'https://pod.example.com'

    const { loadConfig } = await import('../../src/config.js')

    expect(() => loadConfig()).toThrow('SOLID_STORAGE_BASE_URL must end with /')
  })

  it('defaults actorName to actor and actorPath to /actor when ACTOR_NAME is not set', async () => {
    delete process.env.ACTOR_NAME
    process.env.WHITELISTED_ISSUERS = 'https://mocked.example.com'
    process.env.HANDLER_BASE_URL = 'https://mocked.example.com/handlers#'
    process.env.SOLID_STORAGE_BASE_URL = 'https://pod.example.com/'

    const { loadConfig } = await import('../../src/config.js')
    const config = loadConfig()

    expect(config.actorName).toBe('actor')
    expect(config.actorPath).toBe('/actor')
  })

  it('sets actorName and actorPath from ACTOR_NAME env var', async () => {
    process.env.ACTOR_NAME = 'myactor'
    process.env.WHITELISTED_ISSUERS = 'https://mocked.example.com'
    process.env.HANDLER_BASE_URL = 'https://mocked.example.com/handlers#'
    process.env.SOLID_STORAGE_BASE_URL = 'https://pod.example.com/'

    const { loadConfig } = await import('../../src/config.js')
    const config = loadConfig()

    expect(config.actorName).toBe('myactor')
    expect(config.actorPath).toBe('/myactor')
  })
})