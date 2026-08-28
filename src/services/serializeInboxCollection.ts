import type { SolidFetch } from '../types.js'
import { serializeCollection } from './collection.js'

export async function serializeInboxCollection(
  fetchFn: SolidFetch,
  podRootUrl: string,
  publicRootUrl: string
): Promise<Response> {
  return serializeCollection('inbox', fetchFn, podRootUrl, publicRootUrl)
}
