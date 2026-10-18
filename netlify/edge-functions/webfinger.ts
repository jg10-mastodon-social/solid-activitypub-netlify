import { baseUrl } from '../../src/base-url.ts'
import { openActorRegistry } from '../../src/actors/registry.ts'
import { resolveWebFinger } from '../../src/actors/webfinger.ts'
// @ts-ignore - generated at build time
import { webfingerEntries } from '../../src/webfinger-data.ts'

declare const Netlify: { env: { get(key: string): string | undefined } }

export const config = {
  path: '/.well-known/webfinger',
  method: ['GET', 'OPTIONS']
}

const getCorsHeaders = (origin: string | null): Record<string, string> => ({
  'Access-Control-Allow-Origin': origin ?? '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Accept',
  'Vary': 'Origin',
  'Content-Type': 'application/jrd+json'
})

let registry: ReturnType<typeof openActorRegistry> | null = null

function getRegistry(): ReturnType<typeof openActorRegistry> {
  if (registry === null) {
    registry = openActorRegistry({
      registryStoreName: Netlify.env.get('ACTOR_REGISTRY_STORE') ?? 'actor-registry'
    })
  }
  return registry
}

export default async (req: Request): Promise<Response> => {
  const corsHeaders = getCorsHeaders(req.headers.get('Origin'))

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders })
  }

  const url = new URL(req.url)
  const resource = url.searchParams.get('resource')

  if (!resource) {
    return new Response('Missing resource parameter', {
      status: 400,
      headers: corsHeaders
    })
  }

  const entry = await resolveWebFinger(resource, baseUrl, getRegistry())
  if (entry !== null) {
    return new Response(JSON.stringify(entry), {
      status: 200,
      headers: corsHeaders
    })
  }

  // Transitional fallback to build-time WebFinger entries. Remove at cutover,
  // once the runtime registry is the sole source of actors.
  const fallback = webfingerEntries[resource]
  if (fallback) {
    return new Response(JSON.stringify(fallback), {
      status: 200,
      headers: corsHeaders
    })
  }

  return new Response('Resource not found', {
    status: 404,
    headers: corsHeaders
  })
}
