import type { Config, Context } from '@netlify/functions'
import { generateKeyPair, exportJWK } from 'jose'
import { verifyDpopToken } from '../../src/auth.js'
import { loadConfig } from '../../src/config.js'
import { encryptActorSecret, type EncryptedSecret } from '../../src/actors/crypto.js'
import { assertValidActorName } from '../../src/actors/naming.js'
import {
  openActorRegistry,
  ActorAlreadyExistsError,
  ActorNotFoundError,
  type ActorRegistry
} from '../../src/actors/registry.js'

export const config: Config = {
  path: ['/admin/actors', '/admin/actors/:name/disable', '/admin/actors/:name/rotate'],
  method: ['GET', 'POST', 'OPTIONS'],
}

function getCorsHeaders(origin: string | null): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': origin ?? '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, DPoP, Content-Type',
    'Vary': 'Origin',
  }
}

function json(body: unknown, status: number, cors: Record<string, string>): Response {
  return Response.json(body, { status, headers: cors })
}

let registry: ActorRegistry | null = null

function getRegistry(): ActorRegistry {
  if (registry === null) {
    registry = openActorRegistry()
  }
  return registry
}

async function generateKeyMaterial(): Promise<{
  publicKeyJwk: Record<string, unknown>
  encryptedPrivateKey: EncryptedSecret
}> {
  const { publicKey, privateKey } = await generateKeyPair('RS256')
  const publicKeyJwk = (await exportJWK(publicKey)) as unknown as Record<string, unknown>
  const privateKeyJwk = (await exportJWK(privateKey)) as unknown as Record<string, unknown>
  return {
    publicKeyJwk,
    encryptedPrivateKey: encryptActorSecret(privateKeyJwk)
  }
}

function mapError(error: unknown, cors: Record<string, string>): Response {
  if (error instanceof ActorAlreadyExistsError) {
    return new Response(error.message, { status: 409, headers: cors })
  }
  if (error instanceof ActorNotFoundError) {
    return new Response(error.message, { status: 404, headers: cors })
  }
  if (error instanceof Error) {
    return new Response(error.message, { status: 500, headers: cors })
  }
  return new Response('Internal error', { status: 500, headers: cors })
}

async function createActor(req: Request, cors: Record<string, string>): Promise<Response> {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return new Response('Invalid JSON body', { status: 400, headers: cors })
  }

  const name = typeof body === 'object' && body !== null
    ? (body as Record<string, unknown>).name
    : undefined

  if (typeof name !== 'string') {
    return new Response('invalid actor name: name is required', { status: 400, headers: cors })
  }

  try {
    assertValidActorName(name)
  } catch (error) {
    return new Response(error instanceof Error ? error.message : 'invalid actor name', {
      status: 400,
      headers: cors
    })
  }

  const { publicKeyJwk, encryptedPrivateKey } = await generateKeyMaterial()
  const record = await getRegistry().createActor({ name, publicKeyJwk, encryptedPrivateKey })
  return json(record, 200, cors)
}

async function rotateActorKey(name: string, cors: Record<string, string>): Promise<Response> {
  const { publicKeyJwk, encryptedPrivateKey } = await generateKeyMaterial()
  const record = await getRegistry().rotateActorKey({ name, publicKeyJwk, encryptedPrivateKey })
  return json(record, 200, cors)
}

export default async (req: Request, context: Context): Promise<Response> => {
  const corsHeaders = getCorsHeaders(req.headers.get('Origin'))

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders })
  }

  const appConfig = loadConfig()

  const authResult = await verifyDpopToken(
    req.headers.get('authorization') ?? undefined,
    req.headers.get('dpop') ?? undefined,
    req.url,
    req.method,
    appConfig.whitelistedIssuers
  )

  if (!authResult.success) {
    return new Response(authResult.message, {
      status: authResult.statusCode,
      headers: corsHeaders
    })
  }

  if (!appConfig.adminWebId || authResult.payload.webid !== appConfig.adminWebId) {
    return new Response('Forbidden', { status: 403, headers: corsHeaders })
  }

  const deployContext = context.deploy?.context
  if (deployContext === 'deploy-preview' || deployContext === 'branch-deploy') {
    return new Response('Forbidden', { status: 403, headers: corsHeaders })
  }

  try {
    const pathname = new URL(req.url).pathname
    const name = context.params.name

    if (req.method === 'GET' && pathname === '/admin/actors') {
      const records = await getRegistry().listActors()
      return json(records, 200, corsHeaders)
    }

    if (req.method === 'POST' && pathname === '/admin/actors') {
      return await createActor(req, corsHeaders)
    }

    if (req.method === 'POST' && name && pathname === `/admin/actors/${name}/disable`) {
      const record = await getRegistry().disableActor(name)
      return json(record, 200, corsHeaders)
    }

    if (req.method === 'POST' && name && pathname === `/admin/actors/${name}/rotate`) {
      return await rotateActorKey(name, corsHeaders)
    }

    return new Response('Not found', { status: 404, headers: corsHeaders })
  } catch (error) {
    console.error(`[admin-actors] ${req.method} ${req.url} error: ${error}`)
    return mapError(error, corsHeaders)
  }
}
