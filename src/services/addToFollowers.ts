import type { SolidFetch } from '../types.js'
import { addToCollection } from './collection.js'

export async function addToFollowers(
  followerActor: string,
  fetch: SolidFetch,
  solidStorageBaseUrl: string,
  actorName: string
): Promise<void> {
  return addToCollection('followers', followerActor, fetch, solidStorageBaseUrl, actorName)
}