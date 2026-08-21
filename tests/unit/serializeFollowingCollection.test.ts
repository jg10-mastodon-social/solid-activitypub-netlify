import { describe, it, expect, vi } from 'vitest'
import type { SolidFetch } from '../../src/types.js'

describe('serializeFollowingCollection', () => {
  it('returns an OrderedCollection AS2 JSON document', async () => {
    const { serializeFollowingCollection } = await import('../../src/services/serializeFollowingCollection.js')
    const fetchFn = vi.fn<SolidFetch>().mockResolvedValue({
      ok: true,
      status: 200,
      text: () => Promise.resolve(`@prefix as: <https://www.w3.org/ns/activitystreams#> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

<https://pod.example/alice/following/>
  a as:OrderedCollection ;
  as:first <https://pod.example/alice/following/pages/1> ;
  as:totalItems "3"^^xsd:nonNegativeInteger .
`),
      headers: new Headers({ 'content-type': 'text/turtle' })
    } as unknown as Response)

    const res = await serializeFollowingCollection(
      fetchFn,
      'https://pod.example/alice/following/',
      'https://app.example/alice/following'
    )

    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('application/activity+json')
    const body = await res.json() as Record<string, unknown>
    expect(body['@context']).toBe('https://www.w3.org/ns/activitystreams')
    expect(body.id).toBe('https://app.example/alice/following')
    expect(body.type).toBe('OrderedCollection')
    expect(body.totalItems).toBe(3)
    expect(body.first).toBe('https://app.example/alice/following/pages/1')
  })

  it('fetches the pod root with text/turtle Accept', async () => {
    const { serializeFollowingCollection } = await import('../../src/services/serializeFollowingCollection.js')
    const fetchFn = vi.fn<SolidFetch>().mockResolvedValue({
      ok: true,
      status: 200,
      text: () => Promise.resolve(''),
      headers: new Headers()
    } as unknown as Response)

    await serializeFollowingCollection(
      fetchFn,
      'https://pod.example/alice/following/',
      'https://app.example/alice/following'
    )

    expect(fetchFn).toHaveBeenCalledTimes(1)
    const call = fetchFn.mock.calls[0]
    expect(call[0]).toBe('https://pod.example/alice/following/')
    const init = call[1]
    expect(init?.headers).toEqual(expect.objectContaining({ accept: 'text/turtle' }))
  })

  it('returns totalItems: 0 when root has no totalItems triple', async () => {
    const { serializeFollowingCollection } = await import('../../src/services/serializeFollowingCollection.js')
    const fetchFn = vi.fn<SolidFetch>().mockResolvedValue({
      ok: true,
      status: 200,
      text: () => Promise.resolve(`@prefix as: <https://www.w3.org/ns/activitystreams#> .

<https://pod.example/alice/following/>
  a as:OrderedCollection ;
  as:first <https://pod.example/alice/following/pages/1> .
`),
      headers: new Headers()
    } as unknown as Response)

    const res = await serializeFollowingCollection(
      fetchFn,
      'https://pod.example/alice/following/',
      'https://app.example/alice/following'
    )

    const body = await res.json() as Record<string, unknown>
    expect(body.totalItems).toBe(0)
  })

  it('omits first when root has no first triple', async () => {
    const { serializeFollowingCollection } = await import('../../src/services/serializeFollowingCollection.js')
    const fetchFn = vi.fn<SolidFetch>().mockResolvedValue({
      ok: true,
      status: 200,
      text: () => Promise.resolve(''),
      headers: new Headers()
    } as unknown as Response)

    const res = await serializeFollowingCollection(
      fetchFn,
      'https://pod.example/alice/following/',
      'https://app.example/alice/following'
    )

    const body = await res.json() as Record<string, unknown>
    expect('first' in body).toBe(false)
  })
})
