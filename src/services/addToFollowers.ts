import type { SolidFetch } from '../types.js'
import { derivePageUrl } from './derivePageUrl.js'
import { buildInsertItemLinkPatch } from './buildPatch.js'

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

  console.log(`[inbox] Added ${followerActor} to ${actorName} followers collection`)
}
