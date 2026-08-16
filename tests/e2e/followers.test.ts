import { describe, it, expect, beforeEach } from 'vitest'
import { devServerUrl } from '../helpers/dev-server.js'
import { getMockSolidServer } from '../helpers/mock-solid-server.js'

describe('followers e2e', () => {
  beforeEach(() => {
    const mockServer = getMockSolidServer()
    if (mockServer) {
      mockServer.setError(false)
      mockServer.setFollowerActors(['https://bob.example/bob'])
    }
  })

  it('GET /actor/followers with Accept: application/activity+json returns OrderedCollection', async () => {
    const res = await fetch(`${devServerUrl}/actor/followers`, {
      headers: { 'accept': 'application/activity+json' }
    })
    expect(res.status).toBe(200)
    const body = await res.json() as Record<string, unknown>
    expect(body['@context']).toBe('https://www.w3.org/ns/activitystreams')
    expect(body.type).toBe('OrderedCollection')
    expect(body.id).toBe(`${devServerUrl}/actor/followers`)
    expect(body.totalItems).toBe(1)
    expect(body.first).toBe(`${devServerUrl}/actor/followers/pages/1`)
  })

  it('GET /actor/followers with Accept: text/turtle proxies Turtle', async () => {
    const res = await fetch(`${devServerUrl}/actor/followers`, {
      headers: { 'accept': 'text/turtle' }
    })
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toMatch(/text\/turtle/)
    const body = await res.text()
    expect(body).toContain('OrderedCollection')
  })

  it('GET /actor/followers with no Accept header proxies Turtle', async () => {
    const res = await fetch(`${devServerUrl}/actor/followers`)
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toMatch(/text\/turtle/)
  })

  it('GET /actor/followers/pages/1 with AS2 Accept returns OrderedCollectionPage', async () => {
    const res = await fetch(`${devServerUrl}/actor/followers/pages/1`, {
      headers: { 'accept': 'application/activity+json' }
    })
    expect(res.status).toBe(200)
    const body = await res.json() as Record<string, unknown>
    expect(body.type).toBe('OrderedCollectionPage')
    expect(body.partOf).toBe(`${devServerUrl}/actor/followers`)
    expect(body.orderedItems).toEqual(['https://bob.example/bob'])
  })

  it('OPTIONS preflight returns 204 with CORS headers', async () => {
    const res = await fetch(`${devServerUrl}/actor/followers`, {
      method: 'OPTIONS',
      headers: {
        'origin': 'https://app.example',
        'access-control-request-method': 'GET'
      }
    })
    expect(res.status).toBe(204)
    expect(res.headers.get('access-control-allow-origin')).toBe('https://app.example')
    expect(res.headers.get('access-control-allow-methods')).toContain('GET')
  })

  it('GET /actor/followers with Origin echoes Origin in CORS header', async () => {
    const res = await fetch(`${devServerUrl}/actor/followers`, {
      headers: {
        'accept': 'application/activity+json',
        'origin': 'https://app.example'
      }
    })
    expect(res.status).toBe(200)
    expect(res.headers.get('access-control-allow-origin')).toBe('https://app.example')
  })
})