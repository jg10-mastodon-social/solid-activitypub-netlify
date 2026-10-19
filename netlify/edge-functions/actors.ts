import { baseUrl } from '../../src/base-url.ts'
import { openActorRegistry } from '../../src/actors/registry.ts'
import { serializeActorList } from '../../src/actors/actorList.ts'

declare const Netlify: { env: { get(key: string): string | undefined } }

export const config = {
  path: '/actors',
  method: ['GET', 'OPTIONS']
}

const getCorsHeaders = (origin: string | null): Record<string, string> => ({
  'Access-Control-Allow-Origin': origin ?? '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Accept',
  'Vary': 'Origin',
  'Content-Type': 'text/turtle'
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

  const actors = await getRegistry().listActors()
  const body = serializeActorList(actors, baseUrl)

  return new Response(body, {
    status: 200,
    headers: corsHeaders
  })
}
