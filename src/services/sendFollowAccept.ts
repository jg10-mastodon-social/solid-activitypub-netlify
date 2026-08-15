import type { SolidFetch } from '../types.js'
import { fetchActorInbox } from '../activity.js'
import { signActivityRequest } from '../signing.js'
// @ts-ignore
import { baseUrl } from '../base-url.js'

export async function sendFollowAccept(
  followActivity: Record<string, unknown>,
  fetch: SolidFetch,
  actorUrl: string,
  keyId: string
): Promise<void> {
  if (!followActivity.actor || typeof followActivity.actor !== 'string') {
    throw new Error('Follow activity actor missing')
  }

  const followerActor = followActivity.actor
  const followerInbox = await fetchActorInbox(followerActor, fetch)

  const acceptActivity = {
    '@context': 'https://www.w3.org/ns/activitystreams',
    type: 'Accept',
    actor: actorUrl,
    object: followActivity
  }

  await signActivityRequest(
    followerInbox,
    JSON.stringify(acceptActivity),
    keyId,
    actorUrl,
    baseUrl,
    fetch
  )

  console.log(`[inbox] Sent Accept to ${followerInbox}`)
}