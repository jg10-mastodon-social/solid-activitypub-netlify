import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { SolidFetch } from '../../src/types.js'

const mockFetch = vi.fn()

describe('getPageInfo', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return itemCount 0 and isFull false for empty page', async () => {
    const { getPageInfo } = await import('../../src/services/getPageInfo.js')
    const turtle = `
      @prefix as: <https://www.w3.org/ns/activitystreams#>.
      <https://example.com/inbox/pages/123> a as:OrderedCollectionPage.
    `
    mockFetch.mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(turtle)
    })

    const result = await getPageInfo('https://example.com/inbox/pages/123', mockFetch as SolidFetch)
    expect(result.itemCount).toBe(0)
    expect(result.isFull).toBe(false)
  })

  it('should return isFull true when page has 200 items', async () => {
    const { getPageInfo } = await import('../../src/services/getPageInfo.js')
    const items: string[] = []
    for (let i = 0; i < 200; i++) {
      items.push(`<https://example.com/activities/${i}>`)
    }
    const turtle = `
      @prefix as: <https://www.w3.org/ns/activitystreams#>.
      <https://example.com/inbox/pages/123> a as:OrderedCollectionPage;
        as:items ${items.join(', ')} .
    `
    mockFetch.mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(turtle)
    })

    const result = await getPageInfo('https://example.com/inbox/pages/123', mockFetch as SolidFetch)
    expect(result.itemCount).toBe(200)
    expect(result.isFull).toBe(true)
  })

  it('should return isFull false when page has less than 200 items', async () => {
    const { getPageInfo } = await import('../../src/services/getPageInfo.js')
    const turtle = `
      @prefix as: <https://www.w3.org/ns/activitystreams#>.
      <https://example.com/inbox/pages/123> a as:OrderedCollectionPage;
        as:items <https://example.com/activities/1>, <https://example.com/activities/2>.
    `
    mockFetch.mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(turtle)
    })

    const result = await getPageInfo('https://example.com/inbox/pages/123', mockFetch as SolidFetch)
    expect(result.itemCount).toBe(2)
    expect(result.isFull).toBe(false)
  })

  it('should throw on fetch failure', async () => {
    const { getPageInfo } = await import('../../src/services/getPageInfo.js')
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      text: () => Promise.resolve('Server error')
    })

    await expect(getPageInfo('https://example.com/inbox/pages/123', mockFetch as SolidFetch))
      .rejects.toThrow('Failed to fetch page')
  })

  it('should include page URL in error message on failure', async () => {
    const { getPageInfo } = await import('../../src/services/getPageInfo.js')
    mockFetch.mockResolvedValue({
      ok: false,
      status: 403,
      text: () => Promise.resolve('Forbidden')
    })

    await expect(getPageInfo('https://example.com/inbox/pages/123', mockFetch as SolidFetch))
      .rejects.toThrow('https://example.com/inbox/pages/123')
  })
})
