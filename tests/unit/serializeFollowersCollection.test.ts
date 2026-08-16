import { describe, it, expect, vi } from 'vitest'
import type { SolidFetch } from '../../src/types.js'

describe('serializeFollowersCollection', () => {
  it('returns an OrderedCollection AS2 JSON document', async () => {
    const { serializeFollowersCollection } = await import('../../src/services/serializeFollowersCollection.js')
    const fetchFn = vi.fn<SolidFetch>().mockResolvedValue({
      ok: true,
      status: 200,
      text: () => Promise.resolve(`@prefix as: <https://www.w3.org/ns/activitystreams#> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

<https://pod.example/alice/followers/>
  a as:OrderedCollection ;
  as:first <https://pod.example/alice/followers/pages/1> ;
  as:totalItems "3"^^xsd:nonNegativeInteger .
`),
      headers: new Headers({ 'content-type': 'text/turtle' })
    } as unknown as Response)

    const res = await serializeFollowersCollection(
      fetchFn,
      'https://pod.example/alice/followers/',
      'https://app.example/alice/followers'
    )

    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('application/activity+json')
    const body = await res.json() as Record<string, unknown>
    expect(body['@context']).toBe('https://www.w3.org/ns/activitystreams')
    expect(body.id).toBe('https://app.example/alice/followers')
    expect(body.type).toBe('OrderedCollection')
    expect(body.totalItems).toBe(3)
    expect(body.first).toBe('https://app.example/alice/followers/pages/1')
  })

  it('fetches the pod root with text/turtle Accept', async () => {
    const { serializeFollowersCollection } = await import('../../src/services/serializeFollowersCollection.js')
    const fetchFn = vi.fn<SolidFetch>().mockResolvedValue({
      ok: true,
      status: 200,
      text: () => Promise.resolve(''),
      headers: new Headers()
    } as unknown as Response)

    await serializeFollowersCollection(
      fetchFn,
      'https://pod.example/alice/followers/',
      'https://app.example/alice/followers'
    )

    expect(fetchFn).toHaveBeenCalledTimes(1)
    const call = fetchFn.mock.calls[0]
    expect(call[0]).toBe('https://pod.example/alice/followers/')
    const init = call[1]
    expect(init?.headers).toEqual(expect.objectContaining({ accept: 'text/turtle' }))
  })

  it('returns totalItems: 0 when root has no totalItems triple', async () => {
    const { serializeFollowersCollection } = await import('../../src/services/serializeFollowersCollection.js')
    const fetchFn = vi.fn<SolidFetch>().mockResolvedValue({
      ok: true,
      status: 200,
      text: () => Promise.resolve(`@prefix as: <https://www.w3.org/ns/activitystreams#> .

<https://pod.example/alice/followers/>
  a as:OrderedCollection ;
  as:first <https://pod.example/alice/followers/pages/1> .
`),
      headers: new Headers()
    } as unknown as Response)

    const res = await serializeFollowersCollection(
      fetchFn,
      'https://pod.example/alice/followers/',
      'https://app.example/alice/followers'
    )

    const body = await res.json() as Record<string, unknown>
    expect(body.totalItems).toBe(0)
  })

  it('omits first when root has no first triple', async () => {
    const { serializeFollowersCollection } = await import('../../src/services/serializeFollowersCollection.js')
    const fetchFn = vi.fn<SolidFetch>().mockResolvedValue({
      ok: true,
      status: 200,
      text: () => Promise.resolve(''),
      headers: new Headers()
    } as unknown as Response)

    const res = await serializeFollowersCollection(
      fetchFn,
      'https://pod.example/alice/followers/',
      'https://app.example/alice/followers'
    )

    const body = await res.json() as Record<string, unknown>
    expect('first' in body).toBe(false)
  })
})