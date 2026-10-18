import { describe, it, expect } from 'vitest'
import { devServerUrl, getMockSolidServer } from '../helpers/dev-server.js'
import { mintAdminSession } from '../helpers/admin-session.js'

// Master acceptance test for runtime actor identity.
//
// Prerequisites provided by the implementation cycles:
// - ADMIN_WEBID is set for the dev context to `${BASE_URL}/webid`
// - ACTOR_KEY_ENCRYPTION_KEY is set for the dev context
// - admin writes are allowed in the dev deploy context
//
// The test is intentionally written before the implementation; it is expected
// to fail red until the registry, admin API, edge webfinger, and registry-backed
// actor router land.

// Unique per run: the local Blobs sandbox persists across test runs, so a fixed
// name would 409 on the second run and stay disabled from the first.
const ACTOR_NAME = `runtimeactor${Date.now()}`

describe('runtime actor lifecycle e2e', () => {
  it('adds, discovers, serves, and disables an actor without a redeploy', async () => {
    // Master lifecycle test: several cold paths plus edge routing.
    // Vitest default is 5s; give the full lifecycle room to run.
    const session = await mintAdminSession()

    // 1. Create the actor through the admin API.
    const adminUrl = `${devServerUrl}/admin/actors`
    const createRes = await fetch(adminUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(await session.headers('POST', adminUrl)) },
      body: JSON.stringify({ name: ACTOR_NAME })
    })
    expect(createRes.status).toBe(200)
    const created = await createRes.json() as { name: string; publicKeyJwk?: unknown }
    expect(created.name).toBe(ACTOR_NAME)
    expect(created.publicKeyJwk).toBeTruthy()

    // 2. The edge WebFinger handler resolves it from the registry.
    const webfingerRes = await fetch(
      `${devServerUrl}/.well-known/webfinger?resource=acct:${ACTOR_NAME}@localhost:9999`
    )
    expect(webfingerRes.status).toBe(200)
    const jrd = await webfingerRes.json() as {
      subject: string
      aliases: string[]
      links: Array<{ rel: string; type: string; href: string }>
    }
    expect(jrd.subject).toBe(`acct:${ACTOR_NAME}@localhost:9999`)
    expect(jrd.aliases).toContain(`${devServerUrl}/${ACTOR_NAME}`)
    expect(jrd.links).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          rel: 'self',
          type: 'application/activity+json',
          href: `${devServerUrl}/${ACTOR_NAME}`
        })
      ])
    )

    // 3. The actor document exposes the registry public key and endpoints.
    const actorRes = await fetch(`${devServerUrl}/${ACTOR_NAME}`, {
      headers: { accept: 'application/activity+json' }
    })
    expect(actorRes.status).toBe(200)
    const actor = await actorRes.json() as {
      id: string
      inbox: string
      outbox: string
      publicKey: { publicKeyPem: string }
    }
    expect(actor.id).toBe(`${devServerUrl}/${ACTOR_NAME}`)
    expect(actor.inbox).toBe(`${devServerUrl}/${ACTOR_NAME}/inbox`)
    expect(actor.outbox).toBe(`${devServerUrl}/${ACTOR_NAME}/outbox`)
    expect(actor.publicKey.publicKeyPem).toMatch(/-----BEGIN PUBLIC KEY-----/)

    // 4. An outbox POST lazily provisions the actor's pod collections.
    const mockServer = getMockSolidServer()
    expect(mockServer).not.toBeNull()
    const outboxUrl = `${devServerUrl}/${ACTOR_NAME}/outbox`
    const outboxRes = await fetch(outboxUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(await session.headers('POST', outboxUrl)) },
      body: JSON.stringify({
        '@context': 'https://www.w3.org/ns/activitystreams',
        type: 'Create',
        actor: `${devServerUrl}/${ACTOR_NAME}`,
        to: ['https://www.w3.org/ns/activitystreams#Public'],
        object: { type: 'Note', content: 'hello from the runtime actor test' }
      })
    })
    expect(outboxRes.status).toBe(200)
    expect(
      mockServer!.getCreatedPages().some((page) => page.includes(`/${ACTOR_NAME}/outbox/pages/`))
    ).toBe(true)

    // 5. Disabling the actor removes it from both discovery paths.
    const disableUrl = `${devServerUrl}/admin/actors/${ACTOR_NAME}/disable`
    const disableRes = await fetch(disableUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(await session.headers('POST', disableUrl)) }
    })
    expect(disableRes.status).toBe(200)

    const goneWebfingerRes = await fetch(
      `${devServerUrl}/.well-known/webfinger?resource=acct:${ACTOR_NAME}@localhost:9999`
    )
    expect(goneWebfingerRes.status).toBe(404)

    const goneActorRes = await fetch(`${devServerUrl}/${ACTOR_NAME}`, {
      headers: { accept: 'application/activity+json' }
    })
    expect(goneActorRes.status).toBe(404)
  }, 30000)
})
