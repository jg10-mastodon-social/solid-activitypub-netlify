import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { devServerUrl, getMockSolidServer } from '../helpers/dev-server.js'
import { mintAdminSession } from '../helpers/admin-session.js'

describe('runtime actor collection provisioning e2e', () => {
  beforeEach(() => {
    const mockServer = getMockSolidServer()
    mockServer?.setRequireCollectionRoot(true)
    mockServer?.setError(false)
  })

  afterEach(() => {
    getMockSolidServer()?.setRequireCollectionRoot(false)
  })

  // RED until the outbox handler provisions a missing per-actor collection root:
  // the mock is configured to 404 the outbox root, so the first activity for a
  // brand-new runtime actor cannot be persisted.
  it("provisions the actor's outbox collection root on first activity", async () => {
    const session = await mintAdminSession()
    const actorName = `provision${Date.now()}`

    const adminUrl = `${devServerUrl}/admin/actors`
    const createRes = await fetch(adminUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(await session.headers('POST', adminUrl)) },
      body: JSON.stringify({ name: actorName })
    })
    expect(createRes.status).toBe(200)

    const outboxUrl = `${devServerUrl}/${actorName}/outbox`
    const outboxRes = await fetch(outboxUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(await session.headers('POST', outboxUrl)) },
      body: JSON.stringify({
        '@context': 'https://www.w3.org/ns/activitystreams',
        type: 'Create',
        actor: `${devServerUrl}/${actorName}`,
        to: ['https://www.w3.org/ns/activitystreams#Public'],
        object: { type: 'Note', content: 'first activity for a new runtime actor' }
      })
    })

    expect(outboxRes.status).toBe(200)

    const mockServer = getMockSolidServer()
    expect(mockServer).not.toBeNull()
    const createdCollections = mockServer!.getCreatedCollections()
    expect(createdCollections.some(url => url.endsWith(`/${actorName}/outbox/`))).toBe(true)
  }, 30000)
})
