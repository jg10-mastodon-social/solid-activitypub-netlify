import type { SolidFetch } from '../types.js'
import { getCollection } from './collection.js'

export async function getFollowers(
  solidStorageBaseUrl: string,
  actorName: string,
  fetch: SolidFetch
): Promise<string[]> {
  return getCollection('followers', solidStorageBaseUrl, actorName, fetch)
}