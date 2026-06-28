import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { SolidFetch } from '../../src/types.js'

const mockFetch = vi.fn()

describe('updateInbox', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should patch as:first pointer', async () => {
    const { updateInboxFirst } = await import('../../src/services/updateInbox.js')
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200
    })

    await updateInboxFirst(
      'https://example.com/inbox/',
      'https://example.com/inbox/pages/123',
      mockFetch as SolidFetch
    )

    expect(mockFetch).toHaveBeenCalledWith(
      'https://example.com/inbox/',
      expect.objectContaining({
        method: 'PATCH',
        headers: expect.objectContaining({
          'content-type': 'text/n3'
        })
      })
    )
    const patchBody = mockFetch.mock.calls[0][1].body as string
    expect(patchBody).toContain('as:first')
    expect(patchBody).toContain('https://example.com/inbox/pages/123')
  })

  it('should throw on failure', async () => {
    const { updateInboxFirst } = await import('../../src/services/updateInbox.js')
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      text: () => Promise.resolve('Server error')
    })

    await expect(updateInboxFirst(
      'https://example.com/inbox/',
      'https://example.com/inbox/pages/123',
      mockFetch as SolidFetch
    )).rejects.toThrow('Failed to update inbox first pointer')
  })

  it('should include inbox URL and response body in error message on failure', async () => {
    const { updateInboxFirst } = await import('../../src/services/updateInbox.js')
    mockFetch.mockResolvedValue({
      ok: false,
      status: 403,
      text: () => Promise.resolve('Forbidden access')
    })

    await expect(updateInboxFirst(
      'https://example.com/inbox/',
      'https://example.com/inbox/pages/123',
      mockFetch as SolidFetch
    )).rejects.toThrow('https://example.com/inbox/')
    await expect(updateInboxFirst(
      'https://example.com/inbox/',
      'https://example.com/inbox/pages/123',
      mockFetch as SolidFetch
    )).rejects.toThrow('Forbidden access')
  })
})
