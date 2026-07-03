import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { SolidFetch } from '../../src/types.js'

const mockFetch = vi.fn()
const consoleMock = { log: vi.fn(), warn: vi.fn(), error: vi.fn() }

describe('derivePageUrl', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  it('should return existing page URL when first page exists and has capacity', async () => {
    const { derivePageUrl } = await import('../../src/services/derivePageUrl.js')
    const inboxTurtle = `
      @prefix as: <https://www.w3.org/ns/activitystreams#>.
      <https://example.com/inbox/> a as:OrderedCollection;
        as:first <https://example.com/inbox/pages/123>.
    `
    const pageTurtle = `
      @prefix as: <https://www.w3.org/ns/activitystreams#>.
      <https://example.com/inbox/pages/123> a as:OrderedCollectionPage;
        as:items <https://example.com/activities/1>, <https://example.com/activities/2>.
    `
    mockFetch.mockImplementation((url: string) => {
      if (url === 'https://example.com/inbox/') {
        return Promise.resolve({ ok: true, text: () => Promise.resolve(inboxTurtle) })
      }
      if (url === 'https://example.com/inbox/pages/123') {
        return Promise.resolve({ ok: true, text: () => Promise.resolve(pageTurtle) })
      }
      return Promise.resolve({ ok: false })
    })

    const result = await derivePageUrl('https://example.com/inbox/', mockFetch as SolidFetch)
    expect(result).toBe('https://example.com/inbox/pages/123')
  })

  it('should return first page URL when not full', async () => {
    const { derivePageUrl } = await import('../../src/services/derivePageUrl.js')
    const inboxTurtle = `
      @prefix as: <https://www.w3.org/ns/activitystreams#>.
      <https://example.com/inbox/> a as:OrderedCollection;
        as:first <https://example.com/inbox/pages/123>.
    `
    const pageTurtle = `
      @prefix as: <https://www.w3.org/ns/activitystreams#>.
      <https://example.com/inbox/pages/123> a as:OrderedCollectionPage;
        as:items <https://example.com/activities/1>.
    `
    mockFetch.mockImplementation((url: string) => {
      if (url === 'https://example.com/inbox/') {
        return Promise.resolve({ ok: true, text: () => Promise.resolve(inboxTurtle) })
      }
      if (url === 'https://example.com/inbox/pages/123') {
        return Promise.resolve({ ok: true, text: () => Promise.resolve(pageTurtle) })
      }
      return Promise.resolve({ ok: false })
    })

    const result = await derivePageUrl('https://example.com/inbox/', mockFetch as SolidFetch)
    expect(result).toBe('https://example.com/inbox/pages/123')
  })

  it('should throw error when inbox URL does not end with /', async () => {
    const { derivePageUrl } = await import('../../src/services/derivePageUrl.js')
    await expect(derivePageUrl('https://example.com/inbox', mockFetch as SolidFetch))
      .rejects.toThrow('Inbox url should end with /')
  })

  it('should log when creating new page', async () => {
    const { derivePageUrl } = await import('../../src/services/derivePageUrl.js')
    const inboxTurtle = `
      @prefix as: <https://www.w3.org/ns/activitystreams#>.
      <https://example.com/inbox/> a as:OrderedCollection.
    `
    const pageTurtle = `
      @prefix as: <https://www.w3.org/ns/activitystreams#>.
      <https://example.com/inbox/pages/123> a as:OrderedCollectionPage;
        as:items <https://example.com/activities/1>.
    `
    mockFetch.mockImplementation((url: string) => {
      if (url === 'https://example.com/inbox/') {
        return Promise.resolve({ ok: true, text: () => Promise.resolve(inboxTurtle) })
      }
      if (url === 'https://example.com/inbox/pages/123') {
        return Promise.resolve({ ok: true, text: () => Promise.resolve(pageTurtle) })
      }
      return Promise.resolve({ ok: true, status: 201 })
    })

    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    await derivePageUrl('https://example.com/inbox/', mockFetch as SolidFetch)

    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('Created new page')
    )
  })

  it('should log when updating page next link', async () => {
    const { derivePageUrl } = await import('../../src/services/derivePageUrl.js')
    const inboxTurtle = `
      @prefix as: <https://www.w3.org/ns/activitystreams#>.
      <https://example.com/inbox/> a as:OrderedCollection;
        as:first <https://example.com/inbox/pages/123>.
    `
    const items: string[] = []
    for (let i = 0; i < 200; i++) {
      items.push(`<https://example.com/activities/${i}>`)
    }
    const pageTurtle = `
      @prefix as: <https://www.w3.org/ns/activitystreams#>.
      <https://example.com/inbox/pages/123> a as:OrderedCollectionPage;
        as:items ${items.join(', ')}.
    `
    mockFetch.mockImplementation((url: string) => {
      if (url === 'https://example.com/inbox/') {
        return Promise.resolve({ ok: true, text: () => Promise.resolve(inboxTurtle) })
      }
      if (url === 'https://example.com/inbox/pages/123') {
        return Promise.resolve({ ok: true, text: () => Promise.resolve(pageTurtle) })
      }
      return Promise.resolve({ ok: true, status: 201 })
    })

    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    await derivePageUrl('https://example.com/inbox/', mockFetch as SolidFetch)

    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('Added next link on')
    )
  })

  it('should log when updating inbox first link', async () => {
    const { derivePageUrl } = await import('../../src/services/derivePageUrl.js')
    const inboxTurtle = `
      @prefix as: <https://www.w3.org/ns/activitystreams#>.
      <https://example.com/inbox/> a as:OrderedCollection.
    `
    const items: string[] = []
    for (let i = 0; i < 200; i++) {
      items.push(`<https://example.com/activities/${i}>`)
    }
    const pageTurtle = `
      @prefix as: <https://www.w3.org/ns/activitystreams#>.
      <https://example.com/inbox/pages/123> a as:OrderedCollectionPage;
        as:items ${items.join(', ')}.
    `
    mockFetch.mockImplementation((url: string, init?: RequestInit) => {
      if (url === 'https://example.com/inbox/') {
        if (init?.method === 'HEAD') {
          return Promise.resolve({
            ok: true,
            headers: new Map([['link', '<https://example.com/inbox/.meta>; rel="describedby"']])
          })
        }
        return Promise.resolve({ ok: true, text: () => Promise.resolve(inboxTurtle) })
      }
      if (url === 'https://example.com/inbox/pages/123') {
        return Promise.resolve({ ok: true, text: () => Promise.resolve(pageTurtle) })
      }
      if (url === 'https://example.com/inbox/.meta') {
        return Promise.resolve({ ok: true, status: 200 })
      }
      return Promise.resolve({ ok: true, status: 201 })
    })

    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    await derivePageUrl('https://example.com/inbox/', mockFetch as SolidFetch)

    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('Updated inbox first link to')
    )
  })

  it('should include page URL in error when createPage fails', async () => {
    const { derivePageUrl } = await import('../../src/services/derivePageUrl.js')
    const inboxTurtle = `
      @prefix as: <https://www.w3.org/ns/activitystreams#>.
      <https://example.com/inbox/> a as:OrderedCollection.
    `
    mockFetch.mockImplementation((url: string) => {
      if (url === 'https://example.com/inbox/') {
        return Promise.resolve({ ok: true, text: () => Promise.resolve(inboxTurtle) })
      }
      return Promise.resolve({ ok: false, status: 403 })
    })

    await expect(derivePageUrl('https://example.com/inbox/', mockFetch as SolidFetch))
      .rejects.toThrow(/https:\/\/example\.com\/inbox\/pages\/\d+/)
  })
})
