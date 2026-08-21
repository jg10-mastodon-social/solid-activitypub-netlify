import type { SolidFetch } from '../types.js'
import { derivePageUrl } from './derivePageUrl.js'
import { buildInsertItemLinkPatch, buildUpdateLiteralPatch } from './buildPatch.js'
import { parseFollowersRoot } from './rdfUtils.js'
import { discoverMetaResourceUrl } from './solidHelpers.js'

const AS_TOTALITEMS = 'https://www.w3.org/ns/activitystreams#totalItems'
const XSD_NON_NEG_INT = 'http://www.w3.org/2001/XMLSchema#nonNegativeInteger'

function totalItemsLiteralTurtle(subject: string, value: number): string {
  return `<${subject}> <${AS_TOTALITEMS}> "${value}"^^<${XSD_NON_NEG_INT}> .`
}

async function incrementFollowingTotal(
  followingUrl: string,
  fetch: SolidFetch
): Promise<void> {
  try {
    const response = await fetch(followingUrl, { headers: { accept: 'text/turtle' } })
    const text = await response.text()
    const parsed = await parseFollowersRoot(text, followingUrl)
    const current = parsed?.totalItems ?? 0
    const next = current + 1
    const oldTurtle = current === 0
      ? ''
      : totalItemsLiteralTurtle(followingUrl, current)
    const newTurtle = totalItemsLiteralTurtle(followingUrl, next)
    const patchBody = buildUpdateLiteralPatch(followingUrl, AS_TOTALITEMS, oldTurtle, newTurtle)
    const metaUrl = await discoverMetaResourceUrl(followingUrl, fetch)
    const patchResponse = await fetch(metaUrl, {
      method: 'PATCH',
      headers: { 'content-type': 'text/n3' },
      body: patchBody
    })
    if (!patchResponse.ok) {
      console.warn(`[inbox] totalItems PATCH failed for ${metaUrl}: ${patchResponse.status}`)
    }
  } catch (error) {
    console.warn(`[inbox] Could not update totalItems on ${followingUrl}: ${error}`)
  }
}

export async function addToFollowing(
  followedActor: string,
  fetch: SolidFetch,
  solidStorageBaseUrl: string,
  actorName: string
): Promise<void> {
  const followingUrl = `${solidStorageBaseUrl}${actorName}/following/`

  const pageUrl = await derivePageUrl(followingUrl, fetch)

  const patchBody = buildInsertItemLinkPatch(pageUrl, followedActor)

  const response = await fetch(pageUrl, {
    method: 'PATCH',
    headers: {
      'content-type': 'text/n3',
    },
    body: patchBody,
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Failed to add followed actor ${followedActor} to ${actorName}: ${response.status} ${text}`)
  }

  await incrementFollowingTotal(followingUrl, fetch)

  console.log(`[inbox] Added ${followedActor} to ${actorName} following collection`)
}
