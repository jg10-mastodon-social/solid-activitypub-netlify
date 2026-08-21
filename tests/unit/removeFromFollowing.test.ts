import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { SolidFetch } from '../../src/types.js'

describe('removeFromFollowing', () => {
  let mockFetch: ReturnType<typeof vi.fn>

  beforeEach(() => {
    mockFetch = vi.fn()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should patch the following page to remove the actor items triple', async () => {
    const { removeFromFollowing } = await import('../../src/services/removeFromFollowing.js')
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () => Promise.resolve(`<https://example.com/actor/following/> <https://www.w3.org/ns/activitystreams#first> <https://example.com/actor/following/pages/123>.`)
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () => Promise.resolve(`<https://example.com/actor/following/pages/123> <https://www.w3.org/ns/activitystreams#items> <https://other.example/actor>.`)
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200
      })

    await removeFromFollowing(
      'https://other.example/actor',
      mockFetch as SolidFetch,
      'https://example.com/',
      'actor'
    )

    const patchCall = mockFetch.mock.calls.find(call => call[1]?.method === 'PATCH')
    expect(patchCall).toBeDefined()
    const patchBody = patchCall![1].body as string
    expect(patchBody).toContain('solid:deletes')
    expect(patchBody).not.toContain('solid:inserts')
    expect(patchBody).toMatch(/as:items\s+<https:\/\/other\.example\/actor>/)
  })

  it('should use the following URL for the per-actor container', async () => {
    const { removeFromFollowing } = await import('../../src/services/removeFromFollowing.js')
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () => Promise.resolve(`<https://example.com/actor/following/> <https://www.w3.org/ns/activitystreams#first> <https://example.com/actor/following/pages/123>.`)
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () => Promise.resolve(`<https://example.com/actor/following/pages/123> <https://www.w3.org/ns/activitystreams#items> <https://other.example/actor>.`)
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200
      })

    await removeFromFollowing(
      'https://other.example/actor',
      mockFetch as SolidFetch,
      'https://example.com/',
      'actor'
    )

    const followingCall = mockFetch.mock.calls.find(call =>
      (call[0] as string).includes('following') &&
      !(call[0] as string).includes('pages')
    )
    expect(followingCall).toBeDefined()
    expect((followingCall![0] as string)).toBe('https://example.com/actor/following/')
  })

  it('should throw when the entry is not found in any page', async () => {
    const { removeFromFollowing } = await import('../../src/services/removeFromFollowing.js')
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () => Promise.resolve(`<https://example.com/actor/following/> <https://www.w3.org/ns/activitystreams#first> <https://example.com/actor/following/pages/123>.`)
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () => Promise.resolve(`<https://example.com/actor/following/pages/123> <https://www.w3.org/ns/activitystreams#items> <https://different.example/actor>.`)
      })

    await expect(removeFromFollowing(
      'https://other.example/actor',
      mockFetch as SolidFetch,
      'https://example.com/',
      'actor'
    )).rejects.toThrow()
  })

  it('should find and remove the entry on the second page', async () => {
    const { removeFromFollowing } = await import('../../src/services/removeFromFollowing.js')
    const page1Turtle = `@prefix as: <https://www.w3.org/ns/activitystreams#>.

<> a as:OrderedCollectionPage;
    as:partOf <../>;
    as:next <https://example.com/actor/following/pages/2>;
    as:items <https://different.example/actor>.`
    const page2Turtle = `@prefix as: <https://www.w3.org/ns/activitystreams#>.

<> a as:OrderedCollectionPage;
    as:partOf <../>;
    as:items <https://other.example/actor>.`
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () => Promise.resolve(`<> <https://www.w3.org/ns/activitystreams#first> <https://example.com/actor/following/pages/1>.`)
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () => Promise.resolve(page1Turtle)
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () => Promise.resolve(page1Turtle)
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () => Promise.resolve(page2Turtle)
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200
      })

    await removeFromFollowing(
      'https://other.example/actor',
      mockFetch as SolidFetch,
      'https://example.com/',
      'actor'
    )

    const patchCall = mockFetch.mock.calls.find(call => call[1]?.method === 'PATCH')
    expect(patchCall).toBeDefined()
    expect(patchCall![0] as string).toBe('https://example.com/actor/following/pages/2')
  })

  it('should patch the following meta resource to decrement totalItems after a successful remove', async () => {
    const { removeFromFollowing } = await import('../../src/services/removeFromFollowing.js')
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () => Promise.resolve(`<https://example.com/actor/following/> <https://www.w3.org/ns/activitystreams#first> <https://example.com/actor/following/pages/123>.`)
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () => Promise.resolve(`<https://example.com/actor/following/pages/123> <https://www.w3.org/ns/activitystreams#items> <https://other.example/actor>.`)
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () => Promise.resolve(`@prefix as: <https://www.w3.org/ns/activitystreams#> .
<https://example.com/actor/following/> as:totalItems "2" .
`)
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ link: '<https://example.com/actor/following/.meta>; rel="describedby"' })
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200
      })

    await removeFromFollowing(
      'https://other.example/actor',
      mockFetch as SolidFetch,
      'https://example.com/',
      'actor'
    )

    const patches = mockFetch.mock.calls.filter(call => call[1]?.method === 'PATCH')
    const rootPatch = patches.find(p => (p[0] as string) === 'https://example.com/actor/following/.meta')
    expect(rootPatch).toBeDefined()
    const body = rootPatch![1].body as string
    expect(body).toContain('totalItems')
    expect(body).toContain('"2"')
    expect(body).toContain('"1"')
  })

  it('should not PATCH the following container URL directly', async () => {
    const { removeFromFollowing } = await import('../../src/services/removeFromFollowing.js')
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () => Promise.resolve(`<https://example.com/actor/following/> <https://www.w3.org/ns/activitystreams#first> <https://example.com/actor/following/pages/123>.`)
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () => Promise.resolve(`<https://example.com/actor/following/pages/123> <https://www.w3.org/ns/activitystreams#items> <https://other.example/actor>.`)
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () => Promise.resolve(`@prefix as: <https://www.w3.org/ns/activitystreams#> .
<https://example.com/actor/following/> as:totalItems "2" .
`)
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ link: '<https://example.com/actor/following/.meta>; rel="describedby"' })
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200
      })

    await removeFromFollowing(
      'https://other.example/actor',
      mockFetch as SolidFetch,
      'https://example.com/',
      'actor'
    )

    const patches = mockFetch.mock.calls.filter(call => call[1]?.method === 'PATCH')
    const directPatch = patches.find(p => (p[0] as string) === 'https://example.com/actor/following/')
    expect(directPatch).toBeUndefined()
  })

  it('should not decrement below 0', async () => {
    const { removeFromFollowing } = await import('../../src/services/removeFromFollowing.js')
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () => Promise.resolve(`<https://example.com/actor/following/> <https://www.w3.org/ns/activitystreams#first> <https://example.com/actor/following/pages/123>.`)
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () => Promise.resolve(`<https://example.com/actor/following/pages/123> <https://www.w3.org/ns/activitystreams#items> <https://other.example/actor>.`)
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () => Promise.resolve(`@prefix as: <https://www.w3.org/ns/activitystreams#> .
<https://example.com/actor/following/> as:totalItems "1" .
`)
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ link: '<https://example.com/actor/following/.meta>; rel="describedby"' })
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200
      })

    await removeFromFollowing(
      'https://other.example/actor',
      mockFetch as SolidFetch,
      'https://example.com/',
      'actor'
    )

    const patches = mockFetch.mock.calls.filter(call => call[1]?.method === 'PATCH')
    const rootPatch = patches.find(p => (p[0] as string) === 'https://example.com/actor/following/.meta')
    expect(rootPatch).toBeDefined()
    const body = rootPatch![1].body as string
    expect(body).toContain('"1"')
    expect(body).toContain('"0"')
  })
})
