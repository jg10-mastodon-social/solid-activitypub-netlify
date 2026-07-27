import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { SolidFetch } from '../../src/types.js'

describe('removeFromFollowers', () => {
  let mockFetch: ReturnType<typeof vi.fn>

  beforeEach(() => {
    mockFetch = vi.fn()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should patch followers page to remove actor', async () => {
    const { removeFromFollowers } = await import('../../src/services/removeFromFollowers.js')
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () => Promise.resolve(`<https://example.com/followers/> <https://www.w3.org/ns/activitystreams#first> <https://example.com/followers/pages/123>.`)
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () => Promise.resolve(`<https://example.com/followers/pages/123> <https://www.w3.org/ns/activitystreams#items> <https://other.example/actor/follow/123>.
<https://other.example/actor/follow/123> a <https://www.w3.org/ns/activitystreams#Follow>.
<https://other.example/actor/follow/123> <https://www.w3.org/ns/activitystreams#actor> <https://other.example/actor>.`)
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () => Promise.resolve('')
      })

    await removeFromFollowers(
      'https://other.example/actor',
      mockFetch as SolidFetch,
      'https://example.com/',
      'https://example.com/actor'
    )

    const patchCall = mockFetch.mock.calls.find(call => call[1]?.method === 'PATCH')
    expect(patchCall).toBeDefined()
    const patchBody = patchCall![1].body as string
    expect(patchBody).toContain('solid:deletes')
    expect(patchBody).not.toContain('solid:inserts')
  })

  it('should use correct followers URL', async () => {
    const { removeFromFollowers } = await import('../../src/services/removeFromFollowers.js')
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () => Promise.resolve(`<https://example.com/followers/> <https://www.w3.org/ns/activitystreams#first> <https://example.com/followers/pages/123>.`)
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () => Promise.resolve(`<https://example.com/followers/pages/123> <https://www.w3.org/ns/activitystreams#items> <https://other.example/actor/follow/123>.
<https://other.example/actor/follow/123> a <https://www.w3.org/ns/activitystreams#Follow>.
<https://other.example/actor/follow/123> <https://www.w3.org/ns/activitystreams#actor> <https://other.example/actor>.`)
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () => Promise.resolve('')
      })

    await removeFromFollowers(
      'https://other.example/actor',
      mockFetch as SolidFetch,
      'https://example.com/',
      'https://example.com/actor'
    )

    const followersCall = mockFetch.mock.calls.find(call =>
      (call[0] as string).includes('followers')
    )
    expect(followersCall).toBeDefined()
    expect((followersCall![0] as string)).toBe('https://example.com/followers/')
  })
})
