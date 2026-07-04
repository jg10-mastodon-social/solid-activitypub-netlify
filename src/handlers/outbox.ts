import type { SolidFetch } from '../types.js'
import type { Activity } from '../activity.js'
import { derivePageUrl } from '../services/derivePageUrl.js'
import { persistActivityItem } from '../services/persistActivity.js'

export async function handleOutboxActivity(
  activity: Record<string, unknown>,
  fetch: SolidFetch,
  outboxUrl: string
): Promise<boolean> {
  let pageUrl: string | undefined
  try {
    pageUrl = await derivePageUrl(outboxUrl, fetch)
  } catch (error) {
    console.error(`[outbox] Error: Failed to derive page URL: ${error}`)
    return false
  }

  const url = new URL(pageUrl)
  const skolemizeBase = `${url.origin}/.well-known/genid/`

  try {
    await persistActivityItem(activity, pageUrl, fetch, { skolemizeBase })
    console.log(`[outbox] Persisted activity to outbox`)
  } catch (error) {
    console.error(`[outbox] Error: Failed to persist activity item: ${error}`)
    return false
  }

  return true
}
