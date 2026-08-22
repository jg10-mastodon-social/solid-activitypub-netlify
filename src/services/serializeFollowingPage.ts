import type { SolidFetch } from '../types.js'
import { serializePage } from './collection.js'

export async function serializeFollowingPage(
  fetchFn: SolidFetch,
  podPageUrl: string,
  podRootUrl: string,
  publicRootUrl: string
): Promise<Response> {
  return serializePage('following', fetchFn, podPageUrl, podRootUrl, publicRootUrl)
}