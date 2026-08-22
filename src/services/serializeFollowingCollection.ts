import type { SolidFetch } from '../types.js'
import { serializeCollection } from './collection.js'

export async function serializeFollowingCollection(
  fetchFn: SolidFetch,
  podRootUrl: string,
  publicRootUrl: string
): Promise<Response> {
  return serializeCollection('following', fetchFn, podRootUrl, publicRootUrl)
}