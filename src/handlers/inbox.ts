import type { SolidFetch } from '../types.js'
import { derivePageUrl } from '../services/derivePageUrl.js'
import { persistActivityItem } from '../services/persistActivity.js'
import { sendFollowAccept } from '../services/sendFollowAccept.js'
import { addToFollowers } from '../services/addToFollowers.js'
import { removeFromFollowers } from '../services/removeFromFollowers.js'
import { validateContext } from '../activity.js'
import { verifyActorBinding } from '../verifyHttpSignature.js'

export function isFollowActivity(activity: Record<string, unknown>): boolean {
  const activityType = activity.type
  return activityType === 'Follow' || activityType === 'as:Follow'
    || (Array.isArray(activityType) && activityType.some(t => t === 'Follow' || t === 'as:Follow'))
}

export function isUndoActivity(activity: Record<string, unknown>): boolean {
  const activityType = activity.type
  return activityType === 'Undo' || activityType === 'as:Undo'
    || (Array.isArray(activityType) && activityType.some(t => t === 'Undo' || t === 'as:Undo'))
}

export function isUndoFollow(activity: Record<string, unknown>): boolean {
  if (!isUndoActivity(activity)) return false
  const object = activity.object
  if (!object || typeof object !== 'object') return false
  return isFollowActivity(object as Record<string, unknown>)
}

export async function handleInboxActivity(
  activity: Record<string, unknown>,
  fetch: SolidFetch,
  inboxUrl: string,
  actorUrl?: string,
  keyId?: string,
  solidStorageBaseUrl?: string,
  authenticatedKeyId?: string
): Promise<boolean> {
  try {
    validateContext(activity as Parameters<typeof validateContext>[0])
  } catch {
    console.log('[inbox] Activity missing @context')
    return false
  }

  if (!activity.type) {
    console.log('[inbox] Activity missing type')
    return false
  }

  if (authenticatedKeyId && !verifyActorBinding(activity, authenticatedKeyId)) {
    console.log('[inbox] Activity actor does not match authenticated keyId')
    return false
  }

  const activityType = activity.type
  const isDelete = activityType === 'Delete' || activityType === 'as:Delete'
    || (Array.isArray(activityType) && activityType.some(t => t === 'Delete' || t === 'as:Delete'))

  if (isDelete) {
    console.log('[inbox] Delete activity, skipping persistence')
    return true
  }

  const isFollow = isFollowActivity(activity)
  if (isFollow) {
    console.log('[inbox] Follow activity, sending Accept')
    if (actorUrl && keyId) {
      try {
        await sendFollowAccept(activity, fetch, actorUrl, keyId)
      } catch (error) {
        console.error(`[inbox] Error: Failed to send Accept: ${error}`)
        return false
      }
    }
    if (solidStorageBaseUrl && actorUrl) {
      try {
        const followerActor = activity.actor as string
        await addToFollowers(followerActor, fetch, solidStorageBaseUrl, actorUrl)
      } catch (error) {
        console.error(`[inbox] Error: Failed to add to followers: ${error}`)
        return false
      }
    }
    return true
  }

  const isUndo = isUndoFollow(activity)
  if (isUndo) {
    console.log('[inbox] Undo/Follow activity, removing from followers')
    const undoObject = activity.object as Record<string, unknown>
    const followerActor = undoObject.actor as string
    if (solidStorageBaseUrl && actorUrl) {
      try {
        await removeFromFollowers(followerActor, fetch, solidStorageBaseUrl, actorUrl)
      } catch (error) {
        console.error(`[inbox] Error: Failed to remove from followers: ${error}`)
        return false
      }
    }
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
    await persistActivityItem(activity, pageUrl, fetch, { skolemizeBase })
    console.log(`[inbox] Persisted activity to inbox`)
  } catch (error) {
    console.error(`[inbox] Error: Failed to persist inbox item: ${error}`)
    return false
  }

  return true
}
