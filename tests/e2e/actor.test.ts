import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { devServerUrl, getMockSolidServer } from '../helpers/dev-server.js'

const PROFILE_PERSON = `@prefix as: <https://www.w3.org/ns/activitystreams#>.

<http://localhost:9998/actor/profile>
  a as:Person ;
  as:name "Alice Example" ;
  as:summary "<p>Bio.</p>" ;
  as:icon <http://localhost:9998/actor/profile#icon> ;
  as:image <http://localhost:9998/actor/profile#image>.

<http://localhost:9998/actor/profile#icon> a as:Image ; as:mediaType "image/png" ; as:url "https://cdn.example/avatar.png".
<http://localhost:9998/actor/profile#image> a as:Image ; as:mediaType "image/jpeg" ; as:url "https://cdn.example/header.jpg".
`

const PROFILE_NAME_ONLY = `@prefix as: <https://www.w3.org/ns/activitystreams#>.

<http://localhost:9998/actor/profile> as:name "Alice".
`

describe('actor GET e2e with profile overlay', () => {
  beforeEach(() => {
    const mockServer = getMockSolidServer()
    if (mockServer) mockServer.clearActorProfile('actor')
  })

  afterEach(() => {
    const mockServer = getMockSolidServer()
    if (mockServer) mockServer.clearActorProfile('actor')
  })

  it('returns the skeleton only when the pod has no profile', async () => {
    const res = await fetch(`${devServerUrl}/actor`, {
      headers: { 'Accept': 'application/activity+json' }
    })

    expect(res.status).toBe(200)
    const actor = await res.json()
    expect(actor.type).toBe('Service')
    expect(actor.name).toBeUndefined()
    expect(actor.summary).toBeUndefined()
    expect(actor.icon).toBeUndefined()
    expect(actor.image).toBeUndefined()
  })

  it('overlays type, name, summary, icon, image when the pod serves a full profile', async () => {
    const mockServer = getMockSolidServer()
    expect(mockServer).not.toBeNull()
    mockServer!.setActorProfile('actor', PROFILE_PERSON)

    const res = await fetch(`${devServerUrl}/actor`, {
      headers: { 'Accept': 'application/activity+json' }
    })

    expect(res.status).toBe(200)
    const actor = await res.json()
    expect(actor.type).toBe('Person')
    expect(actor.name).toBe('Alice Example')
    expect(actor.summary).toBe('<p>Bio.</p>')
    expect(actor.icon).toEqual({
      type: 'Image',
      mediaType: 'image/png',
      url: 'https://cdn.example/avatar.png'
    })
    expect(actor.image).toEqual({
      type: 'Image',
      mediaType: 'image/jpeg',
      url: 'https://cdn.example/header.jpg'
    })
  })

  it('overlays only the present fields when the profile is partial', async () => {
    const mockServer = getMockSolidServer()
    expect(mockServer).not.toBeNull()
    mockServer!.setActorProfile('actor', PROFILE_NAME_ONLY)

    const res = await fetch(`${devServerUrl}/actor`, {
      headers: { 'Accept': 'application/activity+json' }
    })

    expect(res.status).toBe(200)
    const actor = await res.json()
    expect(actor.name).toBe('Alice')
    expect(actor.type).toBe('Service')
    expect(actor.summary).toBeUndefined()
    expect(actor.icon).toBeUndefined()
    expect(actor.image).toBeUndefined()
  })
})
