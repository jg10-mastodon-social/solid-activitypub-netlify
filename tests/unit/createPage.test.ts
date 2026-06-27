import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { SolidFetch } from '../../src/types.js'

const mockFetch = vi.fn()

describe('createPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should create page with correct RDF types', async () => {
    const { createPage } = await import('../../src/services/createPage.js')
    mockFetch.mockResolvedValue({
      ok: true,
      status: 201
    })

    await createPage(
      'https://example.com/inbox/pages/123',
      'https://example.com/inbox/',
      mockFetch as SolidFetch
    )

    expect(mockFetch).toHaveBeenCalledWith(
      'https://example.com/inbox/pages/123',
      expect.objectContaining({
        method: 'PUT',
        headers: expect.objectContaining({
          'content-type': 'text/turtle'
        })
      })
    )
  })

  it('should set type to OrderedCollectionPage', async () => {
    const { createPage } = await import('../../src/services/createPage.js')
    mockFetch.mockResolvedValue({
      ok: true,
      status: 201
    })

    await createPage(
      'https://example.com/inbox/pages/123',
      'https://example.com/inbox/',
      mockFetch as SolidFetch
    )

    const putCall = mockFetch.mock.calls[0]
    const body = putCall[1].body as string
    expect(body).toContain('as:OrderedCollectionPage')
  })

  it('should set partOf to inboxUrl', async () => {
    const { createPage } = await import('../../src/services/createPage.js')
    mockFetch.mockResolvedValue({
      ok: true,
      status: 201
    })

    await createPage(
      'https://example.com/inbox/pages/123',
      'https://example.com/inbox/',
      mockFetch as SolidFetch
    )

    const putCall = mockFetch.mock.calls[0]
    const body = putCall[1].body as string
    expect(body).toContain('as:partOf <https://example.com/inbox/>')
  })

  it('should link to prevPageUrl when provided', async () => {
    const { createPage } = await import('../../src/services/createPage.js')
    mockFetch.mockResolvedValue({
      ok: true,
      status: 201
    })

    await createPage(
      'https://example.com/inbox/pages/123',
      'https://example.com/inbox/',
      mockFetch as SolidFetch,
      'https://example.com/inbox/pages/122'
    )

    const putCall = mockFetch.mock.calls[0]
    const body = putCall[1].body as string
    expect(body).toContain('as:prev <https://example.com/inbox/pages/122>')
  })

  it('should throw "Already exists" on 409 conflict', async () => {
    const { createPage } = await import('../../src/services/createPage.js')
    mockFetch.mockResolvedValue({
      ok: false,
      status: 409
    })

    await expect(createPage(
      'https://example.com/inbox/pages/123',
      'https://example.com/inbox/',
      mockFetch as SolidFetch
    )).rejects.toThrow('Already exists')
  })
})
