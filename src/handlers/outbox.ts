import type { SolidFetch } from '../types.js'
import type { Activity } from '../activity.js'
import { extractRecipients, fetchActorInbox, validateActivityActor, validateContext, normalizeActivity } from '../activity.js'
import { derivePageUrl } from '../services/derivePageUrl.js'
import { persistActivityItem } from '../services/persistActivity.js'
import { signActivityRequest } from '../signing.js'

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
  actorUrl: string,
  keyId: string
): Promise<OutboxResult> {
  validateContext(activity as Activity)
  validateActivityActor(activity as Activity, actorUrl)

  const normalizedActivity = normalizeActivity(activity as Activity)

  const deliveryResults = await distributeActivity(normalizedActivity, fetch, actorUrl, keyId)

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
