import type { SolidFetch } from '../types.js'
import { derivePageUrl } from './derivePageUrl.js'
import { buildInsertItemLinkPatch, buildUpdateLiteralPatch } from './buildPatch.js'
import { parseFollowersRoot } from './rdfUtils.js'

const AS_TOTALITEMS = 'https://www.w3.org/ns/activitystreams#totalItems'
const XSD_NON_NEG_INT = 'http://www.w3.org/2001/XMLSchema#nonNegativeInteger'

function totalItemsLiteralTurtle(subject: string, value: number): string {
  return `<${subject}> <${AS_TOTALITEMS}> "${value}"^^<${XSD_NON_NEG_INT}> .`
}

async function incrementFollowersTotal(
  followersUrl: string,
  fetch: SolidFetch
): Promise<void> {
  try {
    const response = await fetch(followersUrl, { headers: { accept: 'text/turtle' } })
    const text = await response.text()
    const parsed = await parseFollowersRoot(text, followersUrl)
    const current = parsed?.totalItems ?? 0
    const next = current + 1
    const oldTurtle = current === 0
      ? ''
      : totalItemsLiteralTurtle(followersUrl, current)
    const newTurtle = totalItemsLiteralTurtle(followersUrl, next)
    const patchBody = buildUpdateLiteralPatch(followersUrl, AS_TOTALITEMS, oldTurtle, newTurtle)
    const patchResponse = await fetch(followersUrl, {
      method: 'PATCH',
      headers: { 'content-type': 'text/n3' },
      body: patchBody
    })
    if (!patchResponse.ok) {
      console.warn(`[inbox] totalItems PATCH failed for ${followersUrl}: ${patchResponse.status}`)
    }
  } catch (error) {
    console.warn(`[inbox] Could not update totalItems on ${followersUrl}: ${error}`)
  }
}

export async function addToFollowers(
  followerActor: string,
  fetch: SolidFetch,
  solidStorageBaseUrl: string,
  actorName: string
): Promise<void> {
  const followersUrl = `${solidStorageBaseUrl}${actorName}/followers/`

  const pageUrl = await derivePageUrl(followersUrl, fetch)

  const patchBody = buildInsertItemLinkPatch(pageUrl, followerActor)

  const response = await fetch(pageUrl, {
    method: 'PATCH',
    headers: {
      'content-type': 'text/n3',
    },
    body: patchBody,
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Failed to add follower ${followerActor} to ${actorName}: ${response.status} ${text}`)
  }

  await incrementFollowersTotal(followersUrl, fetch)

  console.log(`[inbox] Added ${followerActor} to ${actorName} followers collection`)
}
