import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { SolidFetch } from '../../src/types.js'

const mockFetch = vi.fn()

describe('updateCollection', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should patch as:first pointer using SPARQL format', async () => {
    const { updateCollectionFirst } = await import('../../src/services/updateInbox.js')
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Map([['link', '<https://example.com/inbox/.meta>; rel="describedby"']])
    })

    await updateCollectionFirst(
      'https://example.com/inbox/',
      'https://example.com/inbox/pages/123',
      mockFetch as SolidFetch
    )

    expect(mockFetch).toHaveBeenCalledTimes(2)
    expect(mockFetch.mock.calls[1][0]).toBe('https://example.com/inbox/.meta')
    expect(mockFetch.mock.calls[1][1]).toMatchObject({
      method: 'PATCH',
      headers: expect.objectContaining({
        'content-type': 'application/sparql-update'
      })
    })
    const patchBody = mockFetch.mock.calls[1][1].body as string
    expect(patchBody).toContain('as:first')
    expect(patchBody).toContain('https://example.com/inbox/pages/123')
    expect(patchBody).toContain('DELETE')
    expect(patchBody).toContain('INSERT')
    expect(patchBody).toContain('WHERE')
  })

  it('should throw on failure', async () => {
    const { updateCollectionFirst } = await import('../../src/services/updateInbox.js')
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Map([['link', '<https://example.com/inbox/.meta>; rel="describedby"']])
    }).mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: () => Promise.resolve('Server error')
    })

    await expect(updateCollectionFirst(
      'https://example.com/inbox/',
      'https://example.com/inbox/pages/123',
      mockFetch as SolidFetch
    )).rejects.toThrow('Failed to update inbox first')
  })

  it('should include response body in error message on failure', async () => {
    const { updateCollectionFirst } = await import('../../src/services/updateInbox.js')
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Map([['link', '<https://example.com/inbox/.meta>; rel="describedby"']])
    }).mockResolvedValueOnce({
      ok: false,
      status: 403,
      text: () => Promise.resolve('Forbidden access')
    })

    await expect(updateCollectionFirst(
      'https://example.com/inbox/',
      'https://example.com/inbox/pages/123',
      mockFetch as SolidFetch
    )).rejects.toThrow('Forbidden access')
  })
})
