import type { SolidFetch } from '../types.js'
import { serializeCollection } from './collection.js'

export async function serializeOutboxCollection(
  fetchFn: SolidFetch,
  podRootUrl: string,
  publicRootUrl: string
): Promise<Response> {
  return serializeCollection('outbox', fetchFn, podRootUrl, publicRootUrl)
}
