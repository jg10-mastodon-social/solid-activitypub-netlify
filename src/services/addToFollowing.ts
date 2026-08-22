import type { SolidFetch } from '../types.js'
import { addToCollection } from './collection.js'

export async function addToFollowing(
  followedActor: string,
  fetch: SolidFetch,
  solidStorageBaseUrl: string,
  actorName: string
): Promise<void> {
  return addToCollection('following', followedActor, fetch, solidStorageBaseUrl, actorName)
}