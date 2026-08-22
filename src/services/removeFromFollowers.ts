import type { SolidFetch } from '../types.js'
import { removeFromCollection } from './collection.js'

export async function removeFromFollowers(
  followerActor: string,
  fetch: SolidFetch,
  solidStorageBaseUrl: string,
  actorName: string
): Promise<void> {
  return removeFromCollection('followers', followerActor, fetch, solidStorageBaseUrl, actorName)
}