import type { SolidFetch } from '../types.js'
import { serializeCollection } from './collection.js'

export async function serializeFollowersCollection(
  fetchFn: SolidFetch,
  podRootUrl: string,
  publicRootUrl: string
): Promise<Response> {
  return serializeCollection('followers', fetchFn, podRootUrl, publicRootUrl)
}