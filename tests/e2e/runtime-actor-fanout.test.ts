import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { devServerUrl, getMockSolidServer } from '../helpers/dev-server.js'
import { mintAdminSession } from '../helpers/admin-session.js'
import { buildActorDocument, createRemoteActorKeys } from '../helpers/http-signature.js'
import {
  clearRemoteActors,
  getRemoteInboxActivities,
  remoteActorUrl,
  setRemoteActor
} from '../helpers/remote-actor-server.js'

const remoteActor = remoteActorUrl('remote')
const remoteKeys = createRemoteActorKeys(remoteActor)

describe('runtime actor fan-out e2e', () => {
  beforeEach(() => {
    clearRemoteActors()
    setRemoteActor('/remote', buildActorDocument(remoteKeys))
    const mockServer = getMockSolidServer()
    if (mockServer) {
      mockServer.setError(false)
    }
  })

  afterEach(() => {
    clearRemoteActors()
  })

  // RED until cycle 11: outbound signing still reads build-time actor keys, so a
  // runtime-registry actor has no key and the follower delivery fails.
  it("delivers a public activity to a runtime actor's followers with the actor signature", async () => {
    const session = await mintAdminSession()
    const actorName = `fanout${Date.now()}`

    const adminUrl = `${devServerUrl}/admin/actors`
    const createRes = await fetch(adminUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(await session.headers('POST', adminUrl)) },
      body: JSON.stringify({ name: actorName })
    })
    expect(createRes.status).toBe(200)

    const mockServer = getMockSolidServer()
    expect(mockServer).not.toBeNull()
    mockServer!.setFollowerActors([remoteActor], actorName)

    const outboxUrl = `${devServerUrl}/${actorName}/outbox`
    const outboxRes = await fetch(outboxUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(await session.headers('POST', outboxUrl)) },
      body: JSON.stringify({
        '@context': 'https://www.w3.org/ns/activitystreams',
        type: 'Create',
        actor: `${devServerUrl}/${actorName}`,
        to: ['https://www.w3.org/ns/activitystreams#Public'],
        object: { type: 'Note', content: 'fan-out to followers' }
      })
    })

    expect(outboxRes.status).toBe(200)
    const result = await outboxRes.json() as { delivered: number; failed: number }
    expect(result.delivered).toBe(1)

    const deliveries = getRemoteInboxActivities().filter((entry) => entry.path === '/remote/inbox')
    expect(deliveries).toHaveLength(1)
    const signature = deliveries[0].headers.signature ?? ''
    expect(signature).toContain(`keyId="${devServerUrl}/${actorName}#main-key"`)
  }, 30000)
})
