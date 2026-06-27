import type { SolidFetch } from '../types.js'
import { derivePageUrl } from '../services/derivePageUrl.js'
import { persistInboxItem } from '../services/persistInbox.js'

export async function handleInboxActivity(
  activity: Record<string, unknown>,
  fetch: SolidFetch,
  inboxUrl: string
): Promise<boolean> {
  const activityType = activity.type
  const isDelete = activityType === 'Delete' || activityType === 'as:Delete'
    || (Array.isArray(activityType) && activityType.some(t => t === 'Delete' || t === 'as:Delete'))

  if (isDelete) {
    console.log('[inbox] Delete activity, skipping persistence')
    return true
  }

  let pageUrl: string | undefined
  try {
    pageUrl = await derivePageUrl(inboxUrl, fetch)
  } catch (error) {
    console.error(`[inbox] Error: Failed to derive page URL: ${error}`)
    return false
  }

  const url = new URL(pageUrl)
  const skolemizeBase = `${url.origin}/.well-known/genid/`

  try {
    await persistInboxItem(activity, pageUrl, fetch, { skolemizeBase })
    console.log(`[inbox] Persisted activity to inbox`)
  } catch (error) {
    console.error(`[inbox] Error: Failed to persist inbox item: ${error}`)
    return false
  }

  return true
}
