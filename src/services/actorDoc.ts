import { Parser, Store } from 'n3'
import { createPrivateKey, createPublicKey } from 'node:crypto'
import type { ActorConfig } from '../types.js'
// @ts-ignore
import { actorKeys } from '../actor-keys.js'

const AS = 'https://www.w3.org/ns/activitystreams#'

export interface ProfileImage {
  type: 'Image'
  mediaType: string
  url: string
}

export interface Profile {
  type?: string
  name?: string
  summary?: string
  icon?: ProfileImage
  image?: ProfileImage
}

function shortName(iri: string): string {
  if (iri.startsWith(AS)) return iri.slice(AS.length)
  return iri
}

export function buildActorSkeleton(
  actor: ActorConfig,
  publicKeyPem: string,
  type: string = 'Service'
): Record<string, unknown> {
  return {
    '@context': [
      'https://www.w3.org/ns/activitystreams',
      'https://w3id.org/security/v1'
    ],
    id: actor.url,
    type,
    preferredUsername: actor.name,
    inbox: actor.inboxUrl,
    outbox: actor.outboxUrl,
    followers: actor.followersUrl,
    following: actor.followingUrl,
    liked: `${actor.url}/liked`,
    endpoints: {
      sharedInbox: actor.sharedInboxUrl
    },
    publicKey: {
      id: actor.keyId,
      owner: actor.url,
      publicKeyPem
    }
  }
}

export function applyProfile(
  skeleton: Record<string, unknown>,
  profile: Profile | null
): void {
  if (!profile) return
  if (profile.type !== undefined) skeleton.type = profile.type
  if (profile.name !== undefined) skeleton.name = profile.name
  if (profile.summary !== undefined) skeleton.summary = profile.summary
  if (profile.icon !== undefined) skeleton.icon = profile.icon
  if (profile.image !== undefined) skeleton.image = profile.image
}

function readImage(
  store: Store,
  imageIri: string
): ProfileImage | undefined {
  const mediaTypeQuads = store.getQuads(imageIri, `${AS}mediaType`, null, null)
  const urlQuads = store.getQuads(imageIri, `${AS}url`, null, null)
  if (mediaTypeQuads.length === 0 && urlQuads.length === 0) return undefined
  return {
    type: 'Image',
    mediaType: mediaTypeQuads[0]?.object.value ?? '',
    url: urlQuads[0]?.object.value ?? ''
  }
}

export function parseProfileTurtle(
  turtle: string,
  profileIri: string
): Profile | null {
  let store: Store
  try {
    const parser = new Parser({ baseIRI: profileIri })
    store = new Store()
    const quads = parser.parse(turtle)
    if (quads) store.addQuads(quads)
  } catch {
    return null
  }

  const profile: Profile = {}

  const typeQuads = store.getQuads(profileIri, 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type', null, null)
  if (typeQuads.length > 0) {
    profile.type = shortName(typeQuads[0].object.value)
  }

  const nameQuads = store.getQuads(profileIri, `${AS}name`, null, null)
  if (nameQuads.length > 0) {
    profile.name = nameQuads[0].object.value
  }

  const summaryQuads = store.getQuads(profileIri, `${AS}summary`, null, null)
  if (summaryQuads.length > 0) {
    profile.summary = summaryQuads[0].object.value
  }

  const iconQuads = store.getQuads(profileIri, `${AS}icon`, null, null)
  if (iconQuads.length > 0) {
    const icon = readImage(store, iconQuads[0].object.value)
    if (icon) profile.icon = icon
  }

  const imageQuads = store.getQuads(profileIri, `${AS}image`, null, null)
  if (imageQuads.length > 0) {
    const image = readImage(store, imageQuads[0].object.value)
    if (image) profile.image = image
  }

  return profile
}

const pemCache: Map<string, string> = new Map()

function derivePublicKeyPem(jwk: Record<string, unknown>): string {
  const privateKey = createPrivateKey({ key: jwk, format: 'jwk' })
  const publicKey = createPublicKey(privateKey)
  return publicKey.export({ type: 'spki', format: 'pem' }) as string
}

export async function getPublicKeyPem(actorName: string): Promise<string> {
  const cached = pemCache.get(actorName)
  if (cached !== undefined) return cached

  const jwk = actorKeys[actorName] as Record<string, unknown> | undefined
  if (!jwk) {
    throw new Error(`No actor key for "${actorName}" — check ACTOR_NAME matches the last build`)
  }
  const pem = derivePublicKeyPem(jwk)
  pemCache.set(actorName, pem)
  return pem
}
