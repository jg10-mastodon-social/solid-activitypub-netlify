import type { SolidFetch } from '../types.js'
import { removeFromCollection } from './collection.js'

export async function removeFromFollowing(
  followedActor: string,
  fetch: SolidFetch,
  solidStorageBaseUrl: string,
  actorName: string
): Promise<void> {
  return removeFromCollection('following', followedActor, fetch, solidStorageBaseUrl, actorName)
}