import type { Config, Context } from '@netlify/functions'
import { createSolidFetch } from '../../src/solidFetch.js'
import { loadConfig } from '../../src/config.js'
import { handleInboxActivity } from '../../src/handlers/inbox.js'

const getCorsHeaders = (origin: string | null) => ({
  'Access-Control-Allow-Origin': origin ?? '*',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, DPoP, Content-Type, Accept',
  'Vary': 'Origin',
})

export const config: Config = {
  path: '/inbox/:page*',
  method: ['POST', 'GET', 'OPTIONS'],
}

export default async (req: Request, context: Context) => {
  console.log('[inbox] Received request')
  const corsHeaders = getCorsHeaders(req.headers.get('Origin'))

  if (req.method === 'OPTIONS') {
    console.log('[inbox] Handling CORS preflight')
    return new Response(null, { status: 204, headers: corsHeaders })
  }

  if (req.method === 'GET') {
    console.log('[inbox] Handling GET request')
    try {
      const config = loadConfig()
      const fetchFn = await createSolidFetch(config.webId, config.issuer)
      const page = context.params.page
      const targetUrl = page ? `${config.inboxUrl}${page}` : config.inboxUrl
      const acceptHeader = req.headers.get('Accept') || 'text/turtle'
      const podResponse = await fetchFn(targetUrl, {
        headers: { accept: acceptHeader }
      })
      const contentType = podResponse.headers.get('Content-Type') || 'text/turtle'
      const body = await podResponse.text()
      const podInboxBase = config.inboxUrl.slice(0, -1)
      const publicInboxBase = `${config.baseUrl}/inbox`
      const rewrittenBody = body.replaceAll(podInboxBase, publicInboxBase)
      return new Response(rewrittenBody, {
        status: podResponse.status,
        headers: { ...corsHeaders, 'Content-Type': contentType }
      })
    } catch (error) {
      console.error(`[inbox] Error: ${error}`)
      return new Response(error instanceof Error ? error.message : 'Bad Gateway', {
        status: 502,
        headers: corsHeaders
      })
    }
  }

  let activity: Record<string, unknown>
  try {
    activity = await req.json() as Record<string, unknown>
  } catch {
    return new Response('Invalid JSON body', {
      status: 400,
      headers: corsHeaders
    })
  }

  console.log('[inbox] Incoming message:', JSON.stringify(activity, null, 2))

  try {
    const config = loadConfig()
    const fetchFn = await createSolidFetch(config.webId, config.issuer)
    const actorUrl = `${config.baseUrl}/actor`
    const keyId = `${actorUrl}#main-key`
    const success = await handleInboxActivity(
      activity,
      fetchFn,
      config.inboxUrl,
      actorUrl,
      keyId,
      config.solidStorageBaseUrl
    )
    if (!success) {
      return new Response('Failed to process activity', {
        status: 500,
        headers: corsHeaders
      })
    }
    return new Response('ok', { status: 200, headers: corsHeaders })
  } catch (error) {
    console.error(`[inbox] Error: ${error}`)
    return new Response(error instanceof Error ? error.message : 'Internal error', {
      status: 500,
      headers: corsHeaders
    })
  }
}
