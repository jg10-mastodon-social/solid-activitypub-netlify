import { describe, it, expect } from 'vitest'
import type { ActorConfig } from '../../src/types.js'

const sampleActor: ActorConfig = {
  name: 'alice',
  path: '/alice',
  url: 'https://example.com/alice',
  keyId: 'https://example.com/alice#main-key',
  inboxUrl: 'https://example.com/alice/inbox',
  outboxUrl: 'https://example.com/alice/outbox',
  followersUrl: 'https://example.com/alice/followers',
  followingUrl: 'https://example.com/alice/following',
  sharedInboxUrl: 'https://example.com/inbox',
  webfingerResource: 'acct:alice@example.com'
}

describe('buildActorSkeleton', () => {
  it('returns the expected shape with default type Service', async () => {
    const { buildActorSkeleton } = await import('../../src/services/actorDoc.js')
    const skeleton = buildActorSkeleton(sampleActor, 'PEM_PLACEHOLDER')

    expect(skeleton).toEqual({
      '@context': [
        'https://www.w3.org/ns/activitystreams',
        'https://w3id.org/security/v1'
      ],
      id: 'https://example.com/alice',
      type: 'Service',
      preferredUsername: 'alice',
      inbox: 'https://example.com/alice/inbox',
      outbox: 'https://example.com/alice/outbox',
      followers: 'https://example.com/alice/followers',
      following: 'https://example.com/alice/following',
      liked: 'https://example.com/alice/liked',
      endpoints: {
        sharedInbox: 'https://example.com/inbox'
      },
      publicKey: {
        id: 'https://example.com/alice#main-key',
        owner: 'https://example.com/alice',
        publicKeyPem: 'PEM_PLACEHOLDER'
      }
    })
  })

  it('honours a custom type argument', async () => {
    const { buildActorSkeleton } = await import('../../src/services/actorDoc.js')
    const skeleton = buildActorSkeleton(sampleActor, 'PEM', 'Person')
    expect(skeleton.type).toBe('Person')
  })
})

describe('parseProfileTurtle', () => {
  it('extracts type, name, summary, icon, and image from a full profile', async () => {
    const { parseProfileTurtle } = await import('../../src/services/actorDoc.js')
    const turtle = `@prefix as: <https://www.w3.org/ns/activitystreams#> .

<https://example.com/alice/profile>
  a as:Person ;
  as:name "Alice Example" ;
  as:summary "<p>Bio.</p>" ;
  as:icon <https://example.com/alice/profile#icon> ;
  as:image <https://example.com/alice/profile#image> .

<https://example.com/alice/profile#icon> a as:Image ; as:mediaType "image/png" ; as:url "https://cdn.example/avatar.png" .
<https://example.com/alice/profile#image> a as:Image ; as:mediaType "image/jpeg" ; as:url "https://cdn.example/header.jpg" .
`
    const profile = await parseProfileTurtle(turtle, 'https://example.com/alice/profile')

    expect(profile).toEqual({
      type: 'Person',
      name: 'Alice Example',
      summary: '<p>Bio.</p>',
      icon: {
        type: 'Image',
        mediaType: 'image/png',
        url: 'https://cdn.example/avatar.png'
      },
      image: {
        type: 'Image',
        mediaType: 'image/jpeg',
        url: 'https://cdn.example/header.jpg'
      }
    })
  })

  it('returns a partial object when only some fields are present', async () => {
    const { parseProfileTurtle } = await import('../../src/services/actorDoc.js')
    const turtle = `@prefix as: <https://www.w3.org/ns/activitystreams#> .

<https://example.com/alice/profile> as:name "Alice" .
`
    const profile = await parseProfileTurtle(turtle, 'https://example.com/alice/profile')
    expect(profile).toEqual({ name: 'Alice' })
  })

  it('returns null for malformed Turtle', async () => {
    const { parseProfileTurtle } = await import('../../src/services/actorDoc.js')
    const profile = await parseProfileTurtle('this is not valid turtle ###', 'https://example.com/alice/profile')
    expect(profile).toBeNull()
  })
})

describe('applyProfile', () => {
  it('writes only fields present in profile', async () => {
    const { buildActorSkeleton, applyProfile } = await import('../../src/services/actorDoc.js')
    const skeleton = buildActorSkeleton(sampleActor, 'PEM')
    applyProfile(skeleton, { name: 'Alice' })

    expect(skeleton.name).toBe('Alice')
    expect(skeleton.summary).toBeUndefined()
    expect(skeleton.icon).toBeUndefined()
    expect(skeleton.image).toBeUndefined()
    expect(skeleton.type).toBe('Service')
  })

  it('is a no-op when profile is null', async () => {
    const { buildActorSkeleton, applyProfile } = await import('../../src/services/actorDoc.js')
    const skeleton = buildActorSkeleton(sampleActor, 'PEM')
    const before = JSON.stringify(skeleton)
    applyProfile(skeleton, null)
    expect(JSON.stringify(skeleton)).toBe(before)
  })
})
