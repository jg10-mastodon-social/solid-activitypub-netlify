import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { SolidFetch } from '../../src/types.js'

const mockFetch = vi.fn()

describe('derivePageUrl', () => {
  beforeEach(() => {
    vi.clearAllMocks()
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
})
