import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { SolidFetch } from '../../src/types.js'

const mockFetch = vi.fn()

describe('getFollowers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('fetches followers from collection first page', async () => {
    const { getFollowers } = await import('../../src/services/getFollowers.js')

    mockFetch.mockImplementation(async (url: string) => {
      if (url === 'https://example.com/storage/followers/') {
        return {
          ok: true,
          status: 200,
          text: () => Promise.resolve(`
@prefix as: <https://www.w3.org/ns/activitystreams#> .

<https://example.com/storage/followers/>
  a as:OrderedCollection ;
  as:first <https://example.com/storage/followers/pages/1> .
`)
        }
      }
      if (url === 'https://example.com/storage/followers/pages/1') {
        return {
          ok: true,
          status: 200,
          text: () => Promise.resolve(`
@prefix as: <https://www.w3.org/ns/activitystreams#> .

<https://example.com/storage/followers/pages/1>
  a as:OrderedCollectionPage ;
  as:items [
    a as:Follow ;
    as:actor <https://follower1.example/actor> ;
    as:object <https://example.com/actor>
  ] .
`)
        }
      }
      throw new Error('Unexpected URL: ' + url)
    })

    const followers = await getFollowers('https://example.com/storage/', mockFetch as SolidFetch)
    expect(followers).toContain('https://follower1.example/actor')
  })

  it('iterates through multiple pages via next links', async () => {
    const { getFollowers } = await import('../../src/services/getFollowers.js')

    mockFetch.mockImplementation(async (url: string) => {
      if (url === 'https://example.com/storage/followers/') {
        return {
          ok: true,
          status: 200,
          text: () => Promise.resolve(`
@prefix as: <https://www.w3.org/ns/activitystreams#> .

<https://example.com/storage/followers/>
  a as:OrderedCollection ;
  as:first <https://example.com/storage/followers/pages/1> .
`)
        }
      }
      if (url === 'https://example.com/storage/followers/pages/1') {
        return {
          ok: true,
          status: 200,
          text: () => Promise.resolve(`
@prefix as: <https://www.w3.org/ns/activitystreams#> .
@prefix asx: <https://example.com/ns/example#> .

<https://example.com/storage/followers/pages/1>
  a as:OrderedCollectionPage ;
  as:next <https://example.com/storage/followers/pages/2> ;
  as:items [
    a as:Follow ;
    as:actor <https://follower1.example/actor> ;
    as:object <https://example.com/actor>
  ] .
`)
        }
      }
      if (url === 'https://example.com/storage/followers/pages/2') {
        return {
          ok: true,
          status: 200,
          text: () => Promise.resolve(`
@prefix as: <https://www.w3.org/ns/activitystreams#> .

<https://example.com/storage/followers/pages/2>
  a as:OrderedCollectionPage ;
  as:items [
    a as:Follow ;
    as:actor <https://follower2.example/actor> ;
    as:object <https://example.com/actor>
  ] .
`)
        }
      }
      throw new Error('Unexpected URL')
    })

    const followers = await getFollowers('https://example.com/storage/', mockFetch as SolidFetch)
    expect(followers).toContain('https://follower1.example/actor')
    expect(followers).toContain('https://follower2.example/actor')
    expect(followers.length).toBe(2)
  })

  it('returns empty array when no followers', async () => {
    const { getFollowers } = await import('../../src/services/getFollowers.js')

    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      text: () => Promise.resolve(`
@prefix as: <https://www.w3.org/ns/activitystreams#> .

<https://example.com/followers/>
  a as:OrderedCollection ;
  as:first <https://example.com/followers/pages/1> .
`)
    })

    const followers = await getFollowers('https://example.com/storage/', mockFetch as SolidFetch)
    expect(followers).toEqual([])
  })

  it('extracts actor URLs from Follow entries', async () => {
    const { getFollowers } = await import('../../src/services/getFollowers.js')

    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      text: () => Promise.resolve(`
@prefix as: <https://www.w3.org/ns/activitystreams#> .

<https://example.com/storage/followers/>
  a as:OrderedCollection ;
  as:first <https://example.com/storage/followers/pages/1> .

<https://example.com/storage/followers/pages/1>
  a as:OrderedCollectionPage ;
  as:items (
    [
      a as:Follow ;
      as:actor <https://follower1.example/actor> ;
      as:object <https://example.com/actor>
    ]
    [
      a as:Follow ;
      as:actor <https://follower2.example/actor> ;
      as:object <https://example.com/actor>
    ]
  ) .
`)
    })

    const followers = await getFollowers('https://example.com/storage/', mockFetch as SolidFetch)
    expect(followers.length).toBe(2)
    expect(followers).toContain('https://follower1.example/actor')
    expect(followers).toContain('https://follower2.example/actor')
  })

  it('returns empty array when followers collection fetch fails', async () => {
    const { getFollowers } = await import('../../src/services/getFollowers.js')

    mockFetch.mockResolvedValue({
      ok: false,
      status: 500
    })

    const followers = await getFollowers('https://example.com/storage/', mockFetch as SolidFetch)
    expect(followers).toEqual([])
  })
})