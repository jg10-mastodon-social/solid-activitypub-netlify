import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { SolidFetch } from '../../src/types.js'

const collectionUrl = 'https://example.com/actor/outbox/'

describe('ensureCollectionRoot', () => {
  let mockFetch: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.clearAllMocks()
    mockFetch = vi.fn()
  })

  it('does not write when the collection root already exists', async () => {
    const { ensureCollectionRoot } = await import('../../src/services/ensureCollectionRoot.js')
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      text: () => Promise.resolve('')
    })

    await ensureCollectionRoot(collectionUrl, mockFetch as SolidFetch)

    expect(mockFetch).toHaveBeenCalledTimes(1)
    expect(mockFetch).toHaveBeenCalledWith(
      collectionUrl,
      expect.objectContaining({ headers: { accept: 'text/turtle' } })
    )
    const putCall = mockFetch.mock.calls.find(call => call[1]?.method === 'PUT')
    expect(putCall).toBeUndefined()
  })

  it('PUTs a Turtle root document when the collection root is missing', async () => {
    const { ensureCollectionRoot } = await import('../../src/services/ensureCollectionRoot.js')
    mockFetch
      .mockResolvedValueOnce({ ok: false, status: 404 })
      .mockResolvedValueOnce({ ok: true, status: 201 })

    await ensureCollectionRoot(collectionUrl, mockFetch as SolidFetch)

    const putCall = mockFetch.mock.calls.find(call => call[1]?.method === 'PUT')
    expect(putCall).toBeDefined()
    expect(putCall![0]).toBe(collectionUrl)
    expect(putCall![1]!.headers).toEqual({ 'content-type': 'text/turtle' })
    const body = putCall![1]!.body as string
    expect(body).toContain('@prefix as: <https://www.w3.org/ns/activitystreams#>.')
    expect(body).toContain(`<${collectionUrl}> a as:OrderedCollection;`)
    expect(body).toContain('as:totalItems 0.')
  })

  it('treats a 409 PUT as success', async () => {
    const { ensureCollectionRoot } = await import('../../src/services/ensureCollectionRoot.js')
    mockFetch
      .mockResolvedValueOnce({ ok: false, status: 404 })
      .mockResolvedValueOnce({ ok: false, status: 409 })

    await expect(ensureCollectionRoot(collectionUrl, mockFetch as SolidFetch)).resolves.toBeUndefined()
  })

  it('treats a 412 PUT as success', async () => {
    const { ensureCollectionRoot } = await import('../../src/services/ensureCollectionRoot.js')
    mockFetch
      .mockResolvedValueOnce({ ok: false, status: 404 })
      .mockResolvedValueOnce({ ok: false, status: 412 })

    await expect(ensureCollectionRoot(collectionUrl, mockFetch as SolidFetch)).resolves.toBeUndefined()
  })

  it('rejects with a descriptive error when the PUT fails', async () => {
    const { ensureCollectionRoot } = await import('../../src/services/ensureCollectionRoot.js')
    mockFetch
      .mockResolvedValueOnce({ ok: false, status: 404 })
      .mockResolvedValueOnce({ ok: false, status: 500, text: () => Promise.resolve('Server Error') })

    await expect(ensureCollectionRoot(collectionUrl, mockFetch as SolidFetch))
      .rejects.toThrow(new RegExp(`Failed to create collection root ${collectionUrl.replace(/\//g, '\\/')}: 500`))
  })

  it('rejects on a non-404 GET error without attempting a PUT', async () => {
    const { ensureCollectionRoot } = await import('../../src/services/ensureCollectionRoot.js')
    mockFetch.mockResolvedValue({ ok: false, status: 500 })

    await expect(ensureCollectionRoot(collectionUrl, mockFetch as SolidFetch))
      .rejects.toThrow(/500/)

    const putCall = mockFetch.mock.calls.find(call => call[1]?.method === 'PUT')
    expect(putCall).toBeUndefined()
  })
})
