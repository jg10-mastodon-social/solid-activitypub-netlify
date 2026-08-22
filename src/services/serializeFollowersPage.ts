import type { SolidFetch } from '../types.js'
import { serializePage } from './collection.js'

export async function serializeFollowersPage(
  fetchFn: SolidFetch,
  podPageUrl: string,
  podRootUrl: string,
  publicRootUrl: string
): Promise<Response> {
  return serializePage('followers', fetchFn, podPageUrl, podRootUrl, publicRootUrl)
}