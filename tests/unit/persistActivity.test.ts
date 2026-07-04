import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { SolidFetch } from '../../src/types.js'

const mockFetch = vi.fn()
const mockJsonLd = {
  expand: vi.fn(),
  toRDF: vi.fn()
}

vi.mock('jsonld', () => ({
  default: mockJsonLd
}))

describe('persistActivity', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockJsonLd.expand.mockResolvedValue([])
    mockJsonLd.toRDF.mockResolvedValue('')
  })

  it('should send PATCH request to pageUrl', async () => {
    const { persistActivityItem } = await import('../../src/services/persistActivity.js')
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200
    })

    const activity = {
      type: 'Create',
      actor: 'https://example.com/actor',
      '@context': 'https://www.w3.org/ns/activitystreams'
    }

    await persistActivityItem(
      activity,
      'https://example.com/inbox/pages/123',
      mockFetch as SolidFetch,
      { skolemizeBase: 'https://example.com/.well-known/genid/' }
    )

    expect(mockFetch).toHaveBeenCalledWith(
      'https://example.com/inbox/pages/123',
      expect.objectContaining({
        method: 'PATCH',
        headers: expect.objectContaining({
          'content-type': 'text/n3'
        })
      })
    )
  })

  it('should throw on non-OK response', async () => {
    const { persistActivityItem } = await import('../../src/services/persistActivity.js')
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      text: () => Promise.resolve('Server error')
    })

    const activity = {
      type: 'Create',
      actor: 'https://example.com/actor',
      '@context': 'https://www.w3.org/ns/activitystreams'
    }

    await expect(persistActivityItem(
      activity,
      'https://example.com/inbox/pages/123',
      mockFetch as SolidFetch,
      { skolemizeBase: 'https://example.com/.well-known/genid/' }
    )).rejects.toThrow('Failed to persist activity item')
  })

  it('should add @context if missing', async () => {
    const { persistActivityItem } = await import('../../src/services/persistActivity.js')
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200
    })

    const activity = {
      type: 'Create',
      actor: 'https://example.com/actor'
    }

    await persistActivityItem(
      activity,
      'https://example.com/inbox/pages/123',
      mockFetch as SolidFetch,
      { skolemizeBase: 'https://example.com/.well-known/genid/' }
    )

    expect(mockJsonLd.expand).toHaveBeenCalledWith(
      expect.objectContaining({
        '@context': expect.arrayContaining(['https://www.w3.org/ns/activitystreams'])
      })
    )
  })
})
