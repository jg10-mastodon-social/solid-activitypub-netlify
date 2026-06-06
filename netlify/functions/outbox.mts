import type { Config, Context } from '@netlify/functions'
import { verifyDpopToken } from '../../src/auth.js'
import { loadConfig } from '../../src/config.js'
import { createSolidFetch } from '../../src/solidFetch.js'
import { extractRecipients, fetchActorInbox, validateActivityActor } from '../../src/activity.js'
import { signActivityRequest } from '../../src/signing.js'
import type { Activity } from '../../src/activity.js'
import type { SolidFetch } from '../../src/types.js'
// @ts-ignore
import { baseUrl } from '../../src/base-url.js'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, DPoP, Content-Type',
}

export const config: Config = {
  path: '/outbox',
  method: ['POST', 'OPTIONS'],
}

async function distributeActivity(activity: Activity, fetchFn: SolidFetch, actorUrl: string, keyId: string): Promise<{ recipient: string; status: number; ok: boolean }[]> {
  const recipients = extractRecipients(activity)
  console.log(`[outbox] Distributing to ${recipients.length} recipients`)

  const results = []
  for (const recipient of recipients) {
    try {
      console.log(`[outbox] Fetching inbox for ${recipient}`)
      const inboxUrl = await fetchActorInbox(recipient, fetchFn)
      console.log(`[outbox] Sending to inbox: ${inboxUrl}`)

      const response = await signActivityRequest(
        inboxUrl,
        JSON.stringify(activity),
        keyId,
        fetchFn
      )
      console.log(`[outbox] Delivery to ${recipient} returned ${response.status}`)
      results.push({ recipient, status: response.status, ok: response.ok })
    } catch (error) {
      console.error(`[outbox] Failed to deliver to ${recipient}: ${error}`)
      results.push({ recipient, status: 0, ok: false })
    }
  }
  return results
}

export default async (req: Request, context: Context) => {
  console.log('[outbox] Received request')

  if (req.method === 'OPTIONS') {
    console.log('[outbox] Handling CORS preflight')
    return new Response(null, { status: 204, headers: CORS_HEADERS })
  }

  const config = loadConfig()
  const actorUrl = `${baseUrl}/actor`
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
    validateActivityActor(activity, actorUrl)
  } catch (error) {
    console.log(`[outbox] Actor validation failed: ${error}`)
    return new Response(error instanceof Error ? error.message : 'Actor mismatch', {
      status: 403,
      headers: CORS_HEADERS
    })
  }

  try {
    const fetchFn = await createSolidFetch(config.webId, config.issuer)

    console.log(`[outbox] Fetching config from ${config.outboxConfigUrl}`)
    const response = await fetchFn(config.outboxConfigUrl, {
      headers: { accept: 'text/turtle,application/x-turtle' }
    })

    if (!response.ok) {
      console.error(`[outbox] Config fetch failed: ${response.status}`)
      return new Response(`Failed to fetch config: ${response.status}`, {
        status: 500,
        headers: CORS_HEADERS
      })
    }

    console.log(`[outbox] Config fetched successfully`)

    const deliveryResults = await distributeActivity(activity, fetchFn, actorUrl, keyId)

    const successCount = deliveryResults.filter(r => r.ok).length
    const failCount = deliveryResults.filter(r => !r.ok).length
    console.log(`[outbox] Delivered to ${successCount}/${deliveryResults.length} recipients`)

    const responseBody = JSON.stringify({
      status: 'ok',
      delivered: successCount,
      failed: failCount,
      results: deliveryResults
    })

    return new Response(responseBody, {
      status: 200,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
    })
  } catch (error) {
    console.error(`[outbox] Error: ${error}`)
    return new Response(error instanceof Error ? error.message : 'Internal error', {
      status: 500,
      headers: CORS_HEADERS
    })
  }
}
