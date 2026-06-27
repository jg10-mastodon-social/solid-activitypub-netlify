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
      status: 500
    })

    await expect(updateInboxFirst(
      'https://example.com/inbox/',
      'https://example.com/inbox/pages/123',
      mockFetch as SolidFetch
    )).rejects.toThrow('Failed to update inbox first pointer')
  })
})
