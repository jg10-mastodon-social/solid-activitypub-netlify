import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { SolidFetch } from '../../src/types.js'

const mockFetch = vi.fn()

describe('addToFollowers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should derive page URL for followers collection', async () => {
    const { addToFollowers } = await import('../../src/services/addToFollowers.js')
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      text: () => Promise.resolve('')
    })

    await addToFollowers(
      'https://other.example/actor',
      mockFetch as SolidFetch,
      'https://example.com/',
      'actor'
    )

    expect(mockFetch).toHaveBeenCalled()
  })

  it('should patch followers page to add actor', async () => {
    const { addToFollowers } = await import('../../src/services/addToFollowers.js')
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      text: () => Promise.resolve('')
    })

    await addToFollowers(
      'https://other.example/actor',
      mockFetch as SolidFetch,
      'https://example.com/',
      'actor'
    )

    const patchCall = mockFetch.mock.calls.find(call => call[1]?.method === 'PATCH')
    expect(patchCall).toBeDefined()
    const patchBody = patchCall![1].body as string
    expect(patchBody).toContain('https://other.example/actor')
  })

  it('should use correct followers URL for the per-actor container', async () => {
    const { addToFollowers } = await import('../../src/services/addToFollowers.js')
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      text: () => Promise.resolve('')
    })

    await addToFollowers(
      'https://other.example/actor',
      mockFetch as SolidFetch,
      'https://example.com/',
      'actor'
    )

    const derivePageUrlCall = mockFetch.mock.calls.find(call =>
      (call[0] as string).includes('followers')
    )
    expect(derivePageUrlCall).toBeDefined()
    expect((derivePageUrlCall![0] as string)).toBe('https://example.com/actor/followers/')
  })
})