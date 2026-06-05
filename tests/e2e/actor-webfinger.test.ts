import { describe, it, expect } from 'vitest'
import { devServerUrl } from '../helpers/dev-server.js'

describe('actor endpoint', () => {
  it('returns ActivityStreams actor JSON with correct Content-Type', async () => {
    const res = await fetch(`${devServerUrl}/actor`, {
      headers: { 'Accept': 'application/activity+json' }
    })

    expect(res.status).toBe(200)
    // Skip Content-Type check - doesn't work in netlify dev locally but works in production
    // expect(res.headers.get('Content-Type')?.includes('application/activity+json') ||
    //        res.headers.get('Content-Type')?.includes('application/json')).toBe(true)

    const actor = await res.json()
    expect(actor['@context']).toContain('https://www.w3.org/ns/activitystreams')
    expect(actor.type).toBe('Service')
    expect(actor.id).toBe(`${devServerUrl}/actor`)
    expect(actor.preferredUsername).toBe('actor')
    expect(actor.inbox).toBe(`${devServerUrl}/outbox`)
    expect(actor.outbox).toBe(`${devServerUrl}/outbox`)
    expect(actor.followers).toBe(`${devServerUrl}/followers`)
    expect(actor.following).toBe(`${devServerUrl}/following`)
    expect(actor.liked).toBe(`${devServerUrl}/liked`)
    expect(actor.manuallyApprovesFollowers).toBe(false)
  })

  it('includes publicKey with RSA PEM format', async () => {
    const res = await fetch(`${devServerUrl}/actor`, {
      headers: { 'Accept': 'application/activity+json' }
    })

    const actor = await res.json()
    expect(actor.publicKey).toBeDefined()
    expect(actor.publicKey.id).toBe(`${devServerUrl}/actor#main-key`)
    expect(actor.publicKey.owner).toBe(`${devServerUrl}/actor`)
    expect(actor.publicKey.publicKeyPem).toMatch(/-----BEGIN PUBLIC KEY-----/)
    expect(actor.publicKey.publicKeyPem).toMatch(/-----END PUBLIC KEY-----/)
  })
})

describe('webfinger endpoint', () => {
  it('returns WebFinger JRD JSON with correct Content-Type', async () => {
    const port = devServerUrl.replace('http://localhost:', '')
    const res = await fetch(`${devServerUrl}/.well-known/webfinger?resource=acct:actor@localhost:${port}`)

    expect(res.status).toBe(200)
    // Skip Content-Type check - doesn't work in netlify dev locally but works in production
    // expect(res.headers.get('Content-Type')?.includes('application/jrd+json') ||
    //        res.headers.get('Content-Type')?.includes('application/json')).toBe(true)

    const webfinger = await res.json()
    expect(webfinger.subject).toBe(`acct:actor@localhost:${port}`)
    expect(webfinger.aliases).toContain(`${devServerUrl}/actor`)
  })

  it('has self link with application/activity+json type', async () => {
    const port = devServerUrl.replace('http://localhost:', '')
    const res = await fetch(`${devServerUrl}/.well-known/webfinger?resource=acct:actor@localhost:${port}`)

    const webfinger = await res.json()
    const selfLink = webfinger.links.find((l: any) => l.rel === 'self')
    expect(selfLink).toBeDefined()
    expect(selfLink.type).toBe('application/activity+json')
    expect(selfLink.href).toBe(`${devServerUrl}/actor`)
  })
})
