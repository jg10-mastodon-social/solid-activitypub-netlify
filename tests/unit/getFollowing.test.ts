import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { SolidFetch } from '../../src/types.js'

const mockFetch = vi.fn()

describe('getFollowing', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('fetches followed actors from the first page', async () => {
    const { getFollowing } = await import('../../src/services/getFollowing.js')

    mockFetch.mockImplementation(async (url: string) => {
      if (url === 'https://example.com/storage/actor/following/') {
        return {
          ok: true,
          status: 200,
          text: () => Promise.resolve(`
@prefix as: <https://www.w3.org/ns/activitystreams#> .

<https://example.com/storage/actor/following/>
  a as:OrderedCollection ;
  as:first <https://example.com/storage/actor/following/pages/1> .
`)
        }
      }
      if (url === 'https://example.com/storage/actor/following/pages/1') {
        return {
          ok: true,
          status: 200,
          text: () => Promise.resolve(`
@prefix as: <https://www.w3.org/ns/activitystreams#> .

<https://example.com/storage/actor/following/pages/1>
  a as:OrderedCollectionPage ;
  as:items <https://followed1.example/actor> .
`)
        }
      }
      throw new Error('Unexpected URL: ' + url)
    })

    const following = await getFollowing('https://example.com/storage/', 'actor', mockFetch as SolidFetch)
    expect(following).toEqual(['https://followed1.example/actor'])
  })

  it('iterates through multiple pages via next links', async () => {
    const { getFollowing } = await import('../../src/services/getFollowing.js')

    mockFetch.mockImplementation(async (url: string) => {
      if (url === 'https://example.com/storage/actor/following/') {
        return {
          ok: true,
          status: 200,
          text: () => Promise.resolve(`
@prefix as: <https://www.w3.org/ns/activitystreams#> .

<https://example.com/storage/actor/following/>
  a as:OrderedCollection ;
  as:first <https://example.com/storage/actor/following/pages/1> .
`)
        }
      }
      if (url === 'https://example.com/storage/actor/following/pages/1') {
        return {
          ok: true,
          status: 200,
          text: () => Promise.resolve(`
@prefix as: <https://www.w3.org/ns/activitystreams#> .

<https://example.com/storage/actor/following/pages/1>
  a as:OrderedCollectionPage ;
  as:next <https://example.com/storage/actor/following/pages/2> ;
  as:items <https://followed1.example/actor> .
`)
        }
      }
      if (url === 'https://example.com/storage/actor/following/pages/2') {
        return {
          ok: true,
          status: 200,
          text: () => Promise.resolve(`
@prefix as: <https://www.w3.org/ns/activitystreams#> .

<https://example.com/storage/actor/following/pages/2>
  a as:OrderedCollectionPage ;
  as:items <https://followed2.example/actor> .
`)
        }
      }
      throw new Error('Unexpected URL')
    })

    const following = await getFollowing('https://example.com/storage/', 'actor', mockFetch as SolidFetch)
    expect(following).toContain('https://followed1.example/actor')
    expect(following).toContain('https://followed2.example/actor')
    expect(following.length).toBe(2)
  })

  it('returns empty array when page has no items', async () => {
    const { getFollowing } = await import('../../src/services/getFollowing.js')

    mockFetch.mockImplementation(async (url: string) => {
      if (url === 'https://example.com/storage/actor/following/') {
        return {
          ok: true,
          status: 200,
          text: () => Promise.resolve(`
@prefix as: <https://www.w3.org/ns/activitystreams#> .

<https://example.com/storage/actor/following/>
  a as:OrderedCollection ;
  as:first <https://example.com/storage/actor/following/pages/1> .
`)
        }
      }
      if (url === 'https://example.com/storage/actor/following/pages/1') {
        return {
          ok: true,
          status: 200,
          text: () => Promise.resolve(`
@prefix as: <https://www.w3.org/ns/activitystreams#> .

<https://example.com/storage/actor/following/pages/1>
  a as:OrderedCollectionPage .
`)
        }
      }
      throw new Error('Unexpected URL: ' + url)
    })

    const following = await getFollowing('https://example.com/storage/', 'actor', mockFetch as SolidFetch)
    expect(following).toEqual([])
  })

  it('extracts multiple actor URIs from a single page', async () => {
    const { getFollowing } = await import('../../src/services/getFollowing.js')

    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      text: () => Promise.resolve(`
@prefix as: <https://www.w3.org/ns/activitystreams#> .

<https://example.com/storage/actor/following/>
  a as:OrderedCollection ;
  as:first <https://example.com/storage/actor/following/pages/1> .

<https://example.com/storage/actor/following/pages/1>
  a as:OrderedCollectionPage ;
  as:items <https://followed1.example/actor> ,
           <https://followed2.example/actor> .
`)
    })

    const following = await getFollowing('https://example.com/storage/', 'actor', mockFetch as SolidFetch)
    expect(following.length).toBe(2)
    expect(following).toContain('https://followed1.example/actor')
    expect(following).toContain('https://followed2.example/actor')
  })

  it('returns empty array when following collection fetch fails', async () => {
    const { getFollowing } = await import('../../src/services/getFollowing.js')

    mockFetch.mockResolvedValue({
      ok: false,
      status: 500
    })

    const following = await getFollowing('https://example.com/storage/', 'actor', mockFetch as SolidFetch)
    expect(following).toEqual([])
  })
})
