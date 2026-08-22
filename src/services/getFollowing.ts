import type { SolidFetch } from '../types.js'
import { getCollection } from './collection.js'

export async function getFollowing(
  solidStorageBaseUrl: string,
  actorName: string,
  fetch: SolidFetch
): Promise<string[]> {
  return getCollection('following', solidStorageBaseUrl, actorName, fetch)
}