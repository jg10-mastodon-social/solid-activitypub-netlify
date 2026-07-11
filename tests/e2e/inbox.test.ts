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

  it('returns 200 for GET /inbox/pages/:id (routing test)', async () => {
    const mockServer = getMockSolidServer()
    expect(mockServer).not.toBeNull()

    const activity = {
      type: 'Create',
      '@context': 'https://www.w3.org/ns/activitystreams',
      actor: 'https://other.example/actor',
      object: { type: 'Note', content: 'Test page content' }
    }

    const postRes = await fetch(`${devServerUrl}/inbox`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(activity)
    })
    expect(postRes.status).toBe(200)

    const pages = mockServer!.getCreatedPages()
    expect(pages.length).toBeGreaterThan(0)
    const pageUrl = pages[pages.length - 1]
    const pagePath = pageUrl.replace('http://localhost:9998', '')

    const res = await fetch(`${devServerUrl}${pagePath}`, {
      method: 'GET',
      headers: { accept: 'text/turtle' }
    })

    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toMatch(/text\/turtle/)
    const body = await res.text()
    expect(body).toContain('OrderedCollectionPage')
  })
})