import { describe, it, expect, beforeEach } from 'vitest'
import { devServerUrl, getMockSolidServer } from '../helpers/dev-server.js'

describe('inbox e2e tests', () => {
  beforeEach(() => {
    const mockServer = getMockSolidServer()
    if (mockServer) {
      mockServer.setError(false)
    }
  })

  it('returns 204 for OPTIONS preflight with CORS headers', async () => {
    const res = await fetch(`${devServerUrl}/inbox`, {
      method: 'OPTIONS',
      headers: {
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'Authorization, DPoP, Content-Type'
      }
    })

    expect(res.status).toBe(204)
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*')
    expect(res.headers.get('Access-Control-Allow-Methods')).toBe('POST, GET, OPTIONS')
  })

  it('returns 400 for invalid JSON body', async () => {
    const res = await fetch(`${devServerUrl}/inbox`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: 'not json'
    })

    expect(res.status).toBe(400)
    expect(await res.text()).toBe('Invalid JSON body')
  })

  it('returns 200 when activity received and persisted to Solid pod', async () => {
    const mockServer = getMockSolidServer()
    expect(mockServer).not.toBeNull()

    const activity = {
      type: 'Create',
      '@context': 'https://www.w3.org/ns/activitystreams',
      actor: 'https://other.example/actor',
      object: { type: 'Note', content: 'Hello world' }
    }

    const res = await fetch(`${devServerUrl}/inbox`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(activity)
    })

    expect(res.status).toBe(200)
    expect(await res.text()).toBe('ok')

    const patchedPages = mockServer!.getPatchedPages()
    expect(patchedPages.length).toBe(1)
    expect(patchedPages[0].body).toContain('Create')
    expect(patchedPages[0].body).toContain('Hello world')
  })

  it('returns 500 when Solid pod is unreachable', async () => {
    const mockServer = getMockSolidServer()
    expect(mockServer).not.toBeNull()

    mockServer!.setError(true, 'unreachable')

    const activity = {
      type: 'Create',
      '@context': 'https://www.w3.org/ns/activitystreams',
      actor: 'https://other.example/actor'
    }

    const res = await fetch(`${devServerUrl}/inbox`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(activity)
    })

    expect(res.status).toBe(500)
  })
})