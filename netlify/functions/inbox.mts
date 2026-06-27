import type { Config, Context } from '@netlify/functions'
import { createSolidFetch } from '../../src/solidFetch.js'
import { loadConfig } from '../../src/config.js'
import { handleInboxActivity } from '../../src/handlers/inbox.js'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, DPoP, Content-Type',
}

export const config: Config = {
  path: '/inbox',
  method: ['POST', 'OPTIONS'],
}

export default async (req: Request, context: Context) => {
  console.log('[inbox] Received request')

  if (req.method === 'OPTIONS') {
    console.log('[inbox] Handling CORS preflight')
    return new Response(null, { status: 204, headers: CORS_HEADERS })
  }

  let activity: Record<string, unknown>
  try {
    activity = await req.json() as Record<string, unknown>
  } catch {
    return new Response('Invalid JSON body', {
      status: 400,
      headers: CORS_HEADERS
    })
  }

  console.log('[inbox] Incoming message:', JSON.stringify(activity, null, 2))

  try {
    const config = loadConfig()
    const fetchFn = await createSolidFetch(config.webId, config.issuer)
    const inboxUrl = `${config.baseUrl}/inbox/`
    await handleInboxActivity(activity, fetchFn, inboxUrl)
    return new Response('ok', { status: 200, headers: CORS_HEADERS })
  } catch (error) {
    console.error(`[inbox] Error: ${error}`)
    return new Response(error instanceof Error ? error.message : 'Internal error', {
      status: 500,
      headers: CORS_HEADERS
    })
  }
}
