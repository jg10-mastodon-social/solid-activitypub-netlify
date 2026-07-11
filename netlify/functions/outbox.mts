import type { Config, Context } from '@netlify/functions'
import { verifyDpopToken } from '../../src/auth.js'
import { loadConfig } from '../../src/config.js'
import { createSolidFetch } from '../../src/solidFetch.js'
import { handleOutboxActivity } from '../../src/handlers/outbox.js'
import type { Activity } from '../../src/activity.js'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, DPoP, Content-Type',
}

export const config: Config = {
  path: '/outbox',
  method: ['POST', 'GET', 'OPTIONS'],
}

export default async (req: Request, context: Context) => {
  console.log('[outbox] Received request')

  if (req.method === 'OPTIONS') {
    console.log('[outbox] Handling CORS preflight')
    return new Response(null, { status: 204, headers: CORS_HEADERS })
  }

  if (req.method === 'GET') {
    console.log('[outbox] Handling GET request')
    try {
      const config = loadConfig()
      const fetchFn = await createSolidFetch(config.webId, config.issuer)
      const url = new URL(req.url)
      const targetUrl = `${config.outboxUrl}${url.pathname.slice('/outbox'.length)}`
      const acceptHeader = req.headers.get('Accept') || 'text/turtle'
      const podResponse = await fetchFn(targetUrl, {
        headers: { accept: acceptHeader }
      })
      const contentType = podResponse.headers.get('Content-Type') || 'text/turtle'
      const body = await podResponse.text()
      const podOutboxBase = config.outboxUrl.slice(0, -1)
      const publicOutboxBase = `${config.baseUrl}/outbox`
      const rewrittenBody = body.replaceAll(podOutboxBase, publicOutboxBase)
      return new Response(rewrittenBody, {
        status: podResponse.status,
        headers: { ...CORS_HEADERS, 'Content-Type': contentType }
      })
    } catch (error) {
      console.error(`[outbox] Error: ${error}`)
      return new Response(error instanceof Error ? error.message : 'Bad Gateway', {
        status: 502,
        headers: CORS_HEADERS
      })
    }
  }

  const config = loadConfig()
  const actorUrl = `${config.baseUrl}/actor`
  const keyId = `${actorUrl}#main-key`

  const authHeader = req.headers.get('authorization')
  const dpopHeader = req.headers.get('dpop')

  const authResult = await verifyDpopToken(
    authHeader ?? undefined,
    dpopHeader ?? undefined,
    config.sendToUrl,
    'POST',
    config.whitelistedIssuers
  )

  if (!authResult.success) {
    console.log(`[outbox] Auth failed: ${authResult.message}`)
    return new Response(authResult.message, {
      status: authResult.statusCode,
      headers: CORS_HEADERS
    })
  }

  console.log(`[outbox] Token verified for webid: ${authResult.payload.webid}`)

  let activity: Activity
  try {
    const body = await req.json()
    activity = body as Activity
  } catch {
    return new Response('Invalid JSON body', { status: 400, headers: CORS_HEADERS })
  }

  try {
    const fetchFn = await createSolidFetch(config.webId, config.issuer)
    const result = await handleOutboxActivity(activity, fetchFn, config.outboxUrl, actorUrl, keyId)

    console.log(`[outbox] Delivered to ${result.delivered}/${result.results.length} recipients`)

    const responseBody = JSON.stringify({
      status: 'ok',
      delivered: result.delivered,
      failed: result.failed,
      results: result.results
    })

    return new Response(responseBody, {
      status: 200,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    if (errorMessage.includes('@context')) {
      return new Response(JSON.stringify({
        error: 'validation_failed',
        message: errorMessage
      }), { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } })
    }
    if (errorMessage.includes('Actor mismatch')) {
      return new Response(errorMessage, { status: 403, headers: CORS_HEADERS })
    }
    console.error(`[outbox] Error: ${error}`)
    return new Response(errorMessage, {
      status: 500,
      headers: CORS_HEADERS
    })
  }
}
