import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { SolidFetch } from '../../src/types.js'

vi.mock('../../src/base-url.js', () => ({
  baseUrl: 'https://example.com'
}))

const mockFetch = vi.fn()

describe('sendFollowAccept', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should fetch follower inbox', async () => {
    const { sendFollowAccept } = await import('../../src/services/sendFollowAccept.js')
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ inbox: 'https://other.example/inbox' })
    })
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200
    })

    const followActivity = {
      type: 'Follow',
      actor: 'https://other.example/actor',
      object: 'https://example.com/actor',
      id: 'https://other.example/activities/1'
    }

    await sendFollowAccept(
      followActivity,
      mockFetch as SolidFetch,
      'https://example.com/actor',
      'https://example.com/actor#main-key'
    )

    expect(mockFetch).toHaveBeenCalledWith(
      'https://other.example/actor',
      expect.objectContaining({ headers: expect.objectContaining({ accept: expect.stringContaining('application/activity+json') }) })
    )
  })

  it('should POST Accept activity to follower inbox', async () => {
    const { sendFollowAccept } = await import('../../src/services/sendFollowAccept.js')
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ inbox: 'https://other.example/inbox' })
    })
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200
    })

    const followActivity = {
      type: 'Follow',
      actor: 'https://other.example/actor',
      object: 'https://example.com/actor',
      id: 'https://other.example/activities/1'
    }

    await sendFollowAccept(
      followActivity,
      mockFetch as SolidFetch,
      'https://example.com/actor',
      'https://example.com/actor#main-key'
    )

    const acceptCall = mockFetch.mock.calls[1]
    expect(acceptCall[0]).toBe('https://other.example/inbox')
    expect(acceptCall[1].method).toBe('POST')
    const body = JSON.parse(acceptCall[1].body)
    expect(body.type).toBe('Accept')
    expect(body.object).toEqual(followActivity)
  })

  it('should include correct signatures in Accept', async () => {
    const { sendFollowAccept } = await import('../../src/services/sendFollowAccept.js')
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ inbox: 'https://other.example/inbox' })
    })
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200
    })

    const followActivity = {
      type: 'Follow',
      actor: 'https://other.example/actor',
      object: 'https://example.com/actor',
      id: 'https://other.example/activities/1'
    }

    await sendFollowAccept(
      followActivity,
      mockFetch as SolidFetch,
      'https://example.com/actor',
      'https://example.com/actor#main-key'
    )

    const acceptCall = mockFetch.mock.calls[1]
    const headers = acceptCall[1].headers
    expect(headers['Signature']).toBeDefined()
    expect(headers['Digest']).toBeDefined()
    expect(headers['Content-Type']).toBe('application/activity+json')
  })

  it('should throw if follower inbox not found', async () => {
    const { sendFollowAccept } = await import('../../src/services/sendFollowAccept.js')
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({})
    })

    const followActivity = {
      type: 'Follow',
      actor: 'https://other.example/actor',
      object: 'https://example.com/actor',
      id: 'https://other.example/activities/1'
    }

    await expect(sendFollowAccept(
      followActivity,
      mockFetch as SolidFetch,
      'https://example.com/actor',
      'https://example.com/actor#main-key'
    )).rejects.toThrow('Actor inbox not found')
  })
})