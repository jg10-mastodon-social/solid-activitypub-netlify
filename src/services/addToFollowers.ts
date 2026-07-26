import type { SolidFetch } from '../types.js'
import { derivePageUrl } from './derivePageUrl.js'
import { persistActivityItem } from './persistActivity.js'

export async function addToFollowers(
  followerActor: string,
  fetch: SolidFetch,
  solidStorageBaseUrl: string,
  actorUrl: string
): Promise<void> {
  const followersUrl = `${solidStorageBaseUrl}followers/`

  const pageUrl = await derivePageUrl(followersUrl, fetch)
  const url = new URL(pageUrl)
  const skolemizeBase = `${url.origin}/.well-known/genid/`

  const followerEntry = {
    type: 'Follow',
    actor: followerActor,
    object: actorUrl,
    id: `${followerActor}/follow/${Date.now()}`
  }

  await persistActivityItem(followerEntry, pageUrl, fetch, { skolemizeBase })
  console.log(`[inbox] Added ${followerActor} to followers collection`)
}