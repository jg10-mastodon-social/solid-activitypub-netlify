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

  it('should patch followers page to add actor as an as:items triple', async () => {
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
    expect(patchBody).toMatch(/as:items\s+<https:\/\/other\.example\/actor>/)
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

  it('should patch the followers root to set totalItems=1 on first add', async () => {
    const { addToFollowers } = await import('../../src/services/addToFollowers.js')
    mockFetch.mockImplementation(async (url: string) => {
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
      (call[0] as string) === 'https://example.com/actor/followers/'
    )
    expect(rootPatch).toBeDefined()
    const body = rootPatch![1].body as string
    expect(body).toContain('totalItems')
    expect(body).toContain('"1"')
  })

  it('should increment totalItems when root already has totalItems=5', async () => {
    const { addToFollowers } = await import('../../src/services/addToFollowers.js')
    mockFetch.mockImplementation(async (url: string) => {
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
      (call[0] as string) === 'https://example.com/actor/followers/'
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
