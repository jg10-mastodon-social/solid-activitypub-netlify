import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { SolidFetch } from '../../src/types.js'

const mockFetch = vi.fn()

describe('addToFollowing', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should derive page URL for the following collection', async () => {
    const { addToFollowing } = await import('../../src/services/addToFollowing.js')
    mockFetch.mockImplementation(async (url: string, init?: RequestInit) => {
      if (init?.method === 'HEAD') {
        return {
          ok: true,
          status: 200,
          headers: new Headers({ link: '<https://example.com/actor/following/.meta>; rel="describedby"' })
        }
      }
      return {
        ok: true,
        status: 200,
        text: () => Promise.resolve('')
      }
    })

    await addToFollowing(
      'https://other.example/actor',
      mockFetch as SolidFetch,
      'https://example.com/',
      'actor'
    )

    expect(mockFetch).toHaveBeenCalled()
  })

  it('should patch the following page to add actor as an as:items triple', async () => {
    const { addToFollowing } = await import('../../src/services/addToFollowing.js')
    mockFetch.mockImplementation(async (url: string, init?: RequestInit) => {
      if (init?.method === 'HEAD') {
        return {
          ok: true,
          status: 200,
          headers: new Headers({ link: '<https://example.com/actor/following/.meta>; rel="describedby"' })
        }
      }
      return {
        ok: true,
        status: 200,
        text: () => Promise.resolve('')
      }
    })

    await addToFollowing(
      'https://other.example/actor',
      mockFetch as SolidFetch,
      'https://example.com/',
      'actor'
    )

    const pagePatch = mockFetch.mock.calls.find(call =>
      call[1]?.method === 'PATCH' &&
      !(call[0] as string).endsWith('.meta')
    )
    expect(pagePatch).toBeDefined()
    const patchBody = pagePatch![1].body as string
    expect(patchBody).toContain('https://other.example/actor')
    expect(patchBody).toMatch(/as:items\s+<https:\/\/other\.example\/actor>/)
  })

  it('should use the following URL for the per-actor container', async () => {
    const { addToFollowing } = await import('../../src/services/addToFollowing.js')
    mockFetch.mockImplementation(async (url: string, init?: RequestInit) => {
      if (init?.method === 'HEAD') {
        return {
          ok: true,
          status: 200,
          headers: new Headers({ link: '<https://example.com/actor/following/.meta>; rel="describedby"' })
        }
      }
      return {
        ok: true,
        status: 200,
        text: () => Promise.resolve('')
      }
    })

    await addToFollowing(
      'https://other.example/actor',
      mockFetch as SolidFetch,
      'https://example.com/',
      'actor'
    )

    const derivePageUrlCall = mockFetch.mock.calls.find(call =>
      (call[0] as string).includes('following') &&
      call[1]?.method !== 'HEAD'
    )
    expect(derivePageUrlCall).toBeDefined()
    expect((derivePageUrlCall![0] as string)).toBe('https://example.com/actor/following/')
  })

  it('should patch the following meta resource (via describedby link) to set totalItems=1 on first add', async () => {
    const { addToFollowing } = await import('../../src/services/addToFollowing.js')
    mockFetch.mockImplementation(async (url: string, init?: RequestInit) => {
      if (url === 'https://example.com/actor/following/' && init?.method === 'HEAD') {
        return {
          ok: true,
          status: 200,
          headers: new Headers({ link: '<https://example.com/actor/following/.meta>; rel="describedby"' })
        }
      }
      if (url === 'https://example.com/actor/following/') {
        return {
          ok: true,
          status: 200,
          text: () => Promise.resolve(``)
        }
      }
      return {
        ok: true,
        status: 200,
        text: () => Promise.resolve('')
      }
    })

    await addToFollowing(
      'https://other.example/actor',
      mockFetch as SolidFetch,
      'https://example.com/',
      'actor'
    )

    const rootPatch = mockFetch.mock.calls.find(call =>
      call[1]?.method === 'PATCH' &&
      (call[0] as string) === 'https://example.com/actor/following/.meta' &&
      (call[1]?.headers as Record<string, string> | undefined)?.['content-type'] === 'text/n3'
    )
    expect(rootPatch).toBeDefined()
    const body = rootPatch![1].body as string
    expect(body).toContain('totalItems')
    expect(body).toContain('"1"')
  })

  it('should not PATCH the following container URL directly', async () => {
    const { addToFollowing } = await import('../../src/services/addToFollowing.js')
    mockFetch.mockImplementation(async (url: string, init?: RequestInit) => {
      if (url === 'https://example.com/actor/following/' && init?.method === 'HEAD') {
        return {
          ok: true,
          status: 200,
          headers: new Headers({ link: '<https://example.com/actor/following/.meta>; rel="describedby"' })
        }
      }
      if (url === 'https://example.com/actor/following/') {
        return {
          ok: true,
          status: 200,
          text: () => Promise.resolve(``)
        }
      }
      return {
        ok: true,
        status: 200,
        text: () => Promise.resolve('')
      }
    })

    await addToFollowing(
      'https://other.example/actor',
      mockFetch as SolidFetch,
      'https://example.com/',
      'actor'
    )

    const directPatch = mockFetch.mock.calls.find(call =>
      call[1]?.method === 'PATCH' &&
      (call[0] as string) === 'https://example.com/actor/following/'
    )
    expect(directPatch).toBeUndefined()
  })

  it('should HEAD the following root to discover the meta resource before PATCHing', async () => {
    const { addToFollowing } = await import('../../src/services/addToFollowing.js')
    mockFetch.mockImplementation(async (url: string, init?: RequestInit) => {
      if (url === 'https://example.com/actor/following/' && init?.method === 'HEAD') {
        return {
          ok: true,
          status: 200,
          headers: new Headers({ link: '<https://example.com/actor/following/.meta>; rel="describedby"' })
        }
      }
      if (url === 'https://example.com/actor/following/') {
        return {
          ok: true,
          status: 200,
          text: () => Promise.resolve(``)
        }
      }
      return {
        ok: true,
        status: 200,
        text: () => Promise.resolve('')
      }
    })

    await addToFollowing(
      'https://other.example/actor',
      mockFetch as SolidFetch,
      'https://example.com/',
      'actor'
    )

    const headCall = mockFetch.mock.calls.find(call =>
      call[1]?.method === 'HEAD' &&
      (call[0] as string) === 'https://example.com/actor/following/'
    )
    expect(headCall).toBeDefined()
  })

  it('should fall back to <container>.meta when the Link header is absent', async () => {
    const { addToFollowing } = await import('../../src/services/addToFollowing.js')
    mockFetch.mockImplementation(async (url: string, init?: RequestInit) => {
      if (url === 'https://example.com/actor/following/' && init?.method === 'HEAD') {
        return {
          ok: true,
          status: 200,
          headers: new Headers()
        }
      }
      if (url === 'https://example.com/actor/following/') {
        return {
          ok: true,
          status: 200,
          text: () => Promise.resolve(``)
        }
      }
      return {
        ok: true,
        status: 200,
        text: () => Promise.resolve('')
      }
    })

    await addToFollowing(
      'https://other.example/actor',
      mockFetch as SolidFetch,
      'https://example.com/',
      'actor'
    )

    const rootPatch = mockFetch.mock.calls.find(call =>
      call[1]?.method === 'PATCH' &&
      (call[0] as string) === 'https://example.com/actor/following/.meta'
    )
    expect(rootPatch).toBeDefined()
  })

  it('should increment totalItems when root already has totalItems=5', async () => {
    const { addToFollowing } = await import('../../src/services/addToFollowing.js')
    mockFetch.mockImplementation(async (url: string, init?: RequestInit) => {
      if (url === 'https://example.com/actor/following/' && init?.method === 'HEAD') {
        return {
          ok: true,
          status: 200,
          headers: new Headers({ link: '<https://example.com/actor/following/.meta>; rel="describedby"' })
        }
      }
      if (url === 'https://example.com/actor/following/') {
        return {
          ok: true,
          status: 200,
          text: () => Promise.resolve(`@prefix as: <https://www.w3.org/ns/activitystreams#> .
<https://example.com/actor/following/> as:totalItems "5" .
`)
        }
      }
      return {
        ok: true,
        status: 200,
        text: () => Promise.resolve('')
      }
    })

    await addToFollowing(
      'https://other.example/actor',
      mockFetch as SolidFetch,
      'https://example.com/',
      'actor'
    )

    const rootPatch = mockFetch.mock.calls.find(call =>
      call[1]?.method === 'PATCH' &&
      (call[0] as string) === 'https://example.com/actor/following/.meta' &&
      (call[1]?.headers as Record<string, string> | undefined)?.['content-type'] === 'text/n3'
    )
    expect(rootPatch).toBeDefined()
    const body = rootPatch![1].body as string
    expect(body).toContain('"5"')
    expect(body).toContain('"6"')
  })

  it('should not patch the root if the page PATCH fails', async () => {
    const { addToFollowing } = await import('../../src/services/addToFollowing.js')
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      text: () => Promise.resolve('server error')
    })

    await expect(addToFollowing(
      'https://other.example/actor',
      mockFetch as SolidFetch,
      'https://example.com/',
      'actor'
    )).rejects.toThrow()

    const rootPatch = mockFetch.mock.calls.find(call =>
      call[1]?.method === 'PATCH' &&
      (call[0] as string) === 'https://example.com/actor/following/'
    )
    expect(rootPatch).toBeUndefined()
  })
})
