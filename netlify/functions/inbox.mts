import type { Config, Context } from '@netlify/functions'

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

  try {
    const body = await req.json()
    console.log('[inbox] Incoming message:', JSON.stringify(body, null, 2))
    return new Response('ok', { status: 200, headers: CORS_HEADERS })
  } catch (error) {
    console.error(`[inbox] Error: ${error}`)
    return new Response(error instanceof Error ? error.message : 'Internal error', {
      status: 500,
      headers: CORS_HEADERS
    })
  }
}