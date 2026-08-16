import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { SolidFetch } from '../../src/types.js'

const mockFetch = vi.fn()

describe('addToFollowers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should derive page URL for followers collection', async () => {
    const { addToFollowers } = await import('../../src/services/addToFollowers.js')
    mockFetch.mockImplementation(async (url: string, init?: RequestInit) => {
      if (init?.method === 'HEAD') {
        return {
          ok: true,
          status: 200,
          headers: new Headers({ link: '<https://example.com/actor/followers/.meta>; rel="describedby"' })
        }
      }
      return {
        ok: true,
        status: 200,
        text: () => Promise.resolve('')
      }
    })

    await addToFollowers(
      'https://other.example/actor',
      mockFetch as SolidFetch,
      'https://example.com/',
      'actor'
    )

    expect(mockFetch).toHaveBeenCalled()
  })

  it('should patch followers page to add actor as an as:items triple', async () => {
    const { addToFollowers } = await import('../../src/services/addToFollowers.js')
    mockFetch.mockImplementation(async (url: string, init?: RequestInit) => {
      if (init?.method === 'HEAD') {
        return {
          ok: true,
          status: 200,
          headers: new Headers({ link: '<https://example.com/actor/followers/.meta>; rel="describedby"' })
        }
      }
      return {
        ok: true,
        status: 200,
        text: () => Promise.resolve('')
      }
    })

    await addToFollowers(
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

  it('should use correct followers URL for the per-actor container', async () => {
    const { addToFollowers } = await import('../../src/services/addToFollowers.js')
    mockFetch.mockImplementation(async (url: string, init?: RequestInit) => {
      if (init?.method === 'HEAD') {
        return {
          ok: true,
          status: 200,
          headers: new Headers({ link: '<https://example.com/actor/followers/.meta>; rel="describedby"' })
        }
      }
      return {
        ok: true,
        status: 200,
        text: () => Promise.resolve('')
      }
    })

    await addToFollowers(
      'https://other.example/actor',
      mockFetch as SolidFetch,
      'https://example.com/',
      'actor'
    )

    const derivePageUrlCall = mockFetch.mock.calls.find(call =>
      (call[0] as string).includes('followers') &&
      call[1]?.method !== 'HEAD'
    )
    expect(derivePageUrlCall).toBeDefined()
    expect((derivePageUrlCall![0] as string)).toBe('https://example.com/actor/followers/')
  })

  it('should patch the followers meta resource (via describedby link) to set totalItems=1 on first add', async () => {
    const { addToFollowers } = await import('../../src/services/addToFollowers.js')
    mockFetch.mockImplementation(async (url: string, init?: RequestInit) => {
      if (url === 'https://example.com/actor/followers/' && init?.method === 'HEAD') {
        return {
          ok: true,
          status: 200,
          headers: new Headers({ link: '<https://example.com/actor/followers/.meta>; rel="describedby"' })
        }
      }
      if (url === 'https://example.com/actor/followers/') {
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

    await addToFollowers(
      'https://other.example/actor',
      mockFetch as SolidFetch,
      'https://example.com/',
      'actor'
    )

    const rootPatch = mockFetch.mock.calls.find(call =>
      call[1]?.method === 'PATCH' &&
      (call[0] as string) === 'https://example.com/actor/followers/.meta' &&
      (call[1]?.headers as Record<string, string> | undefined)?.['content-type'] === 'text/n3'
    )
    expect(rootPatch).toBeDefined()
    const body = rootPatch![1].body as string
    expect(body).toContain('totalItems')
    expect(body).toContain('"1"')
  })

  it('should not PATCH the followers container URL directly', async () => {
    const { addToFollowers } = await import('../../src/services/addToFollowers.js')
    mockFetch.mockImplementation(async (url: string, init?: RequestInit) => {
      if (url === 'https://example.com/actor/followers/' && init?.method === 'HEAD') {
        return {
          ok: true,
          status: 200,
          headers: new Headers({ link: '<https://example.com/actor/followers/.meta>; rel="describedby"' })
        }
      }
      if (url === 'https://example.com/actor/followers/') {
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

    await addToFollowers(
      'https://other.example/actor',
      mockFetch as SolidFetch,
      'https://example.com/',
      'actor'
    )

    const directPatch = mockFetch.mock.calls.find(call =>
      call[1]?.method === 'PATCH' &&
      (call[0] as string) === 'https://example.com/actor/followers/'
    )
    expect(directPatch).toBeUndefined()
  })

  it('should HEAD the followers root to discover the meta resource before PATCHing', async () => {
    const { addToFollowers } = await import('../../src/services/addToFollowers.js')
    mockFetch.mockImplementation(async (url: string, init?: RequestInit) => {
      if (url === 'https://example.com/actor/followers/' && init?.method === 'HEAD') {
        return {
          ok: true,
          status: 200,
          headers: new Headers({ link: '<https://example.com/actor/followers/.meta>; rel="describedby"' })
        }
      }
      if (url === 'https://example.com/actor/followers/') {
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

    await addToFollowers(
      'https://other.example/actor',
      mockFetch as SolidFetch,
      'https://example.com/',
      'actor'
    )

    const headCall = mockFetch.mock.calls.find(call =>
      call[1]?.method === 'HEAD' &&
      (call[0] as string) === 'https://example.com/actor/followers/'
    )
    expect(headCall).toBeDefined()
  })

  it('should fall back to <container>.meta when the Link header is absent', async () => {
    const { addToFollowers } = await import('../../src/services/addToFollowers.js')
    mockFetch.mockImplementation(async (url: string, init?: RequestInit) => {
      if (url === 'https://example.com/actor/followers/' && init?.method === 'HEAD') {
        return {
          ok: true,
          status: 200,
          headers: new Headers()
        }
      }
      if (url === 'https://example.com/actor/followers/') {
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

    await addToFollowers(
      'https://other.example/actor',
      mockFetch as SolidFetch,
      'https://example.com/',
      'actor'
    )

    const rootPatch = mockFetch.mock.calls.find(call =>
      call[1]?.method === 'PATCH' &&
      (call[0] as string) === 'https://example.com/actor/followers/.meta'
    )
    expect(rootPatch).toBeDefined()
  })

  it('should increment totalItems when root already has totalItems=5', async () => {
    const { addToFollowers } = await import('../../src/services/addToFollowers.js')
    mockFetch.mockImplementation(async (url: string, init?: RequestInit) => {
      if (url === 'https://example.com/actor/followers/' && init?.method === 'HEAD') {
        return {
          ok: true,
          status: 200,
          headers: new Headers({ link: '<https://example.com/actor/followers/.meta>; rel="describedby"' })
        }
      }
      if (url === 'https://example.com/actor/followers/') {
        return {
          ok: true,
          status: 200,
          text: () => Promise.resolve(`@prefix as: <https://www.w3.org/ns/activitystreams#> .
<https://example.com/actor/followers/> as:totalItems "5" .
`)
        }
      }
      return {
        ok: true,
        status: 200,
        text: () => Promise.resolve('')
      }
    })

    await addToFollowers(
      'https://other.example/actor',
      mockFetch as SolidFetch,
      'https://example.com/',
      'actor'
    )

    const rootPatch = mockFetch.mock.calls.find(call =>
      call[1]?.method === 'PATCH' &&
      (call[0] as string) === 'https://example.com/actor/followers/.meta' &&
      (call[1]?.headers as Record<string, string> | undefined)?.['content-type'] === 'text/n3'
    )
    expect(rootPatch).toBeDefined()
    const body = rootPatch![1].body as string
    expect(body).toContain('"5"')
    expect(body).toContain('"6"')
  })

  it('should not patch the root if the page PATCH fails', async () => {
    const { addToFollowers } = await import('../../src/services/addToFollowers.js')
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      text: () => Promise.resolve('server error')
    })

    await expect(addToFollowers(
      'https://other.example/actor',
      mockFetch as SolidFetch,
      'https://example.com/',
      'actor'
    )).rejects.toThrow()

    const rootPatch = mockFetch.mock.calls.find(call =>
      call[1]?.method === 'PATCH' &&
      (call[0] as string) === 'https://example.com/actor/followers/'
    )
    expect(rootPatch).toBeUndefined()
  })
})
