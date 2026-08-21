import type { SolidFetch } from '../types.js'
import type { Activity } from '../activity.js'
import { extractRecipients, fetchActorInbox, validateActivityActor, validateContext, normalizeActivity, isActivityPublic } from '../activity.js'
import { derivePageUrl } from '../services/derivePageUrl.js'
import { getFollowers } from '../services/getFollowers.js'
import { persistActivityItem } from '../services/persistActivity.js'
import { removeFromFollowing } from '../services/removeFromFollowing.js'
import { isUndoFollow } from './inbox.js'
import { signActivityRequest } from '../signing.js'
// @ts-ignore
import { baseUrl } from '../base-url.js'

interface DistributionResult {
  recipient: string
  status: number
  ok: boolean
}

interface OutboxResult {
  delivered: number
  failed: number
  results: DistributionResult[]
}

async function distributeActivity(
  activity: Activity,
  fetchFn: SolidFetch,
  actorUrl: string,
  keyId: string
): Promise<DistributionResult[]> {
  const recipients = extractRecipients(activity)

  const results: DistributionResult[] = []
  for (const recipient of recipients) {
    try {
      const inboxUrl = await fetchActorInbox(recipient, fetchFn)
      const response = await signActivityRequest(
        inboxUrl,
        JSON.stringify(activity),
        keyId,
        actorUrl,
        baseUrl,
        fetchFn
      )
      results.push({ recipient, status: response.status, ok: response.ok })
    } catch (error) {
      results.push({ recipient, status: 0, ok: false })
    }
  }
  return results
}

export async function handleOutboxActivity(
  activity: Record<string, unknown>,
  fetch: SolidFetch,
  outboxUrl: string,
  actorName: string,
  actorUrl: string,
  keyId: string,
  solidStorageBaseUrl?: string
): Promise<OutboxResult> {
  validateContext(activity as Activity)
  validateActivityActor(activity as Activity, actorUrl)

  const normalizedActivity = normalizeActivity(activity as Activity)

  const deliveryResults = await distributeActivity(normalizedActivity, fetch, actorUrl, keyId)

  if (solidStorageBaseUrl && isActivityPublic(normalizedActivity)) {
    try {
      const followers = await getFollowers(solidStorageBaseUrl, actorName, fetch)
      const explicitRecipients = new Set(extractRecipients(normalizedActivity))
      const newRecipients = followers.filter(f => !explicitRecipients.has(f))

      for (const follower of newRecipients) {
        try {
          const inboxUrl = await fetchActorInbox(follower, fetch)
          const response = await signActivityRequest(
            inboxUrl,
            JSON.stringify(normalizedActivity),
            keyId,
            actorUrl,
            baseUrl,
            fetch
          )
          deliveryResults.push({ recipient: follower, status: response.status, ok: response.ok })
        } catch (error) {
          deliveryResults.push({ recipient: follower, status: 0, ok: false })
        }
      }
    } catch (error) {
      console.warn(`[outbox] Failed to broadcast to followers: ${error}`)
    }
  }

  if (isUndoFollow(activity) && solidStorageBaseUrl) {
    const inner = activity.object as Record<string, unknown>
    const target = inner?.object
    if (typeof target === 'string') {
      try {
        await removeFromFollowing(target, fetch, solidStorageBaseUrl, actorName)
        console.log(`[outbox] Undo Follow, removed ${target} from ${actorName} following collection`)
      } catch (error) {
        console.warn(`[outbox] Failed to remove from following collection: ${error}`)
      }
    }
  }

  const pageUrl = await derivePageUrl(outboxUrl, fetch)
  const skolemizeBase = `${new URL(pageUrl).origin}/.well-known/genid/`

  await persistActivityItem(normalizedActivity, pageUrl, fetch, { skolemizeBase })

  const successCount = deliveryResults.filter(r => r.ok).length
  const failCount = deliveryResults.filter(r => !r.ok).length

  return {
    delivered: successCount,
    failed: failCount,
    results: deliveryResults
  }
}