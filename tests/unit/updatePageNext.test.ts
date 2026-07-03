import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { SolidFetch } from '../../src/types.js'

const mockFetch = vi.fn()

describe('updatePageNext', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should patch as:next link using SPARQL INSERT DATA', async () => {
    const { updatePageNext } = await import('../../src/services/updatePageNext.js')
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200
    })

    await updatePageNext(
      'https://example.com/inbox/pages/123',
      'https://example.com/inbox/pages/124',
      mockFetch as SolidFetch
    )

    expect(mockFetch).toHaveBeenCalledWith(
      'https://example.com/inbox/pages/123',
      expect.objectContaining({
        method: 'PATCH',
        headers: expect.objectContaining({
          'content-type': 'application/sparql-update'
        })
      })
    )
    const patchBody = mockFetch.mock.calls[0][1].body as string
    expect(patchBody).toContain('as:next')
    expect(patchBody).toContain('https://example.com/inbox/pages/124')
    expect(patchBody).toContain('INSERT DATA')
  })

  it('should throw on failure', async () => {
    const { updatePageNext } = await import('../../src/services/updatePageNext.js')
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      text: () => Promise.resolve('Server error')
    })

    await expect(updatePageNext(
      'https://example.com/inbox/pages/123',
      'https://example.com/inbox/pages/124',
      mockFetch as SolidFetch
    )).rejects.toThrow('Failed to update page next')
  })

  it('should include response body in error message on failure', async () => {
    const { updatePageNext } = await import('../../src/services/updatePageNext.js')
    mockFetch.mockResolvedValue({
      ok: false,
      status: 403,
      text: () => Promise.resolve('Forbidden access')
    })

    await expect(updatePageNext(
      'https://example.com/inbox/pages/123',
      'https://example.com/inbox/pages/124',
      mockFetch as SolidFetch
    )).rejects.toThrow('Forbidden access')
  })
})
