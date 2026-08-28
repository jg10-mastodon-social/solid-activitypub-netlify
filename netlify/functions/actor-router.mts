import type { Config, Context } from '@netlify/functions'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { createSolidFetch } from '../../src/solidFetch.js'
import { verifyDpopToken } from '../../src/auth.js'
import { loadConfig } from '../../src/config.js'
import { handleInboxActivity, handleSharedInboxActivity, isActorDeleteActivity } from '../../src/handlers/inbox.js'
import { handleOutboxActivity } from '../../src/handlers/outbox.js'
import { verifyIncomingActivity, HttpSignatureError, formatHttpSignatureError } from '../../src/verifyRequest.js'
import type { Activity } from '../../src/activity.js'
import { serializeFollowersCollection } from '../../src/services/serializeFollowersCollection.js'
import { serializeFollowersPage } from '../../src/services/serializeFollowersPage.js'
import { serializeFollowingCollection } from '../../src/services/serializeFollowingCollection.js'
import { serializeFollowingPage } from '../../src/services/serializeFollowingPage.js'
import { serializeInboxCollection } from '../../src/services/serializeInboxCollection.js'
import { serializeInboxPage } from '../../src/services/serializeInboxPage.js'
import { serializeOutboxCollection } from '../../src/services/serializeOutboxCollection.js'
import { serializeOutboxPage } from '../../src/services/serializeOutboxPage.js'
import { rewriteBody } from '../../src/services/rewriteBody.js'
import { buildActorSkeleton, applyProfile, parseProfileTurtle, getPublicKeyPem } from '../../src/services/actorDoc.js'

const routerFilename = fileURLToPath(import.meta.url)
const routerDirname = path.dirname(routerFilename)
const publicRootDir = path.resolve(routerDirname, '..', '..', 'public')
const actorPageTemplatePath = path.join(publicRootDir, 'actor-page.template.html')

const getCorsHeaders = (origin: string | null) => ({
  'Access-Control-Allow-Origin': origin ?? '*',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, DPoP, Content-Type, Accept, Date, Digest, Signature',
  'Vary': 'Origin',
})

export const config: Config = {
  path: [
    '/inbox',
    '/:actor',
    '/:actor/inbox/:page*',
    '/:actor/outbox/:page*',
    '/:actor/followers/:page*',
    '/:actor/following/:page*',
  ],
  method: ['POST', 'GET', 'OPTIONS'],
  preferStatic: true,
}

type Collection = 'inbox' | 'outbox' | 'followers' | 'following'

function activitySummary(activity: Record<string, unknown>): string {
  const type = typeof activity.type === 'string' ? activity.type : 'unknown'
  const actor = typeof activity.actor === 'string' ? activity.actor : 'unknown'
  const obj = activity.object
  const objId = typeof obj === 'object' && obj !== null && !Array.isArray(obj) && typeof (obj as Record<string, unknown>).id === 'string'
    ? (obj as Record<string, unknown>).id
    : typeof obj === 'string' ? obj : undefined
  return objId ? `type=${type} actor=${actor} object=${objId}` : `type=${type} actor=${actor}`
}

function resolveActor(config: ReturnType<typeof loadConfig>, actorParam: string | undefined) {
  if (!actorParam) return null
  return config.actorByPath[`/${actorParam}`] ?? null
}

function collectionFromPath(pathname: string): Collection | null {
  if (pathname.endsWith('/inbox') || pathname.includes('/inbox/')) return 'inbox'
  if (pathname.endsWith('/outbox') || pathname.includes('/outbox/')) return 'outbox'
  if (pathname.endsWith('/following') || pathname.includes('/following/')) return 'following'
  if (pathname.endsWith('/followers') || pathname.includes('/followers/')) return 'followers'
  return null
}

function isActorPath(pathname: string, actorName: string): boolean {
  return pathname === `/${actorName}` || pathname === `/${actorName}/`
}

function resolvePodTarget(
  solidStorageBaseUrl: string,
  actorName: string,
  collection: Collection,
  page: string | undefined,
  pathname: string
): string {
  const base = `${solidStorageBaseUrl}${actorName}/${collection}/`
  if (!page) return base
  const hasTrailingSlash = pathname.endsWith('/')
  return `${base}${page}${hasTrailingSlash ? '/' : ''}`
}

function wantsAs2Json(acceptHeader: string | null): boolean {
  if (!acceptHeader) return false
  const lowered = acceptHeader.toLowerCase()
  return lowered.includes('application/activity+json') ||
    lowered.includes('application/ld+json')
}

function wantsHtml(acceptHeader: string | null): boolean {
  if (!acceptHeader) return false
  return acceptHeader.toLowerCase().includes('text/html')
}

function renderActorPageHtml(template: string, baseUrl: string, actorName: string, domain: string): string {
  return template
    .replaceAll('{{BASE_URL}}', baseUrl)
    .replaceAll('{{ACTOR_NAME}}', actorName)
    .replaceAll('{{DOMAIN}}', domain)
}

async function handleGet(
  req: Request,
  context: Context,
  config: ReturnType<typeof loadConfig>,
  fetchFn: Awaited<ReturnType<typeof createSolidFetch>>,
  actorName: string,
  collection: Collection,
  corsHeaders: Record<string, string>
): Promise<Response> {
  const requiresAuth = collection !== 'outbox' && collection !== 'followers' && collection !== 'following'
  if (requiresAuth) {
    const authHeader = req.headers.get('authorization')
    const dpopHeader = req.headers.get('dpop')

    const authResult = await verifyDpopToken(
      authHeader ?? undefined,
      dpopHeader ?? undefined,
      req.url,
      'GET',
      config.whitelistedIssuers
    )

    if (!authResult.success) {
      console.log(`[router] GET /${actorName}/${collection} auth failed: ${authResult.message}`)
      return new Response(authResult.message, {
        status: authResult.statusCode,
        headers: corsHeaders
      })
    }
  }

  const page = context.params.page
  const requestPath = new URL(req.url).pathname
  const targetUrl = resolvePodTarget(config.solidStorageBaseUrl, actorName, collection, page, requestPath)

  if (wantsAs2Json(req.headers.get('Accept'))) {
    if (collection === 'followers') {
      const publicRootUrl = `${config.baseUrl}/${actorName}/followers`
      const podRootUrl = `${config.solidStorageBaseUrl}${actorName}/followers/`
      try {
        const as2Response = page
          ? await serializeFollowersPage(fetchFn, targetUrl, podRootUrl, publicRootUrl)
          : await serializeFollowersCollection(fetchFn, podRootUrl, publicRootUrl)
        const headers = new Headers(as2Response.headers)
        for (const [k, v] of Object.entries(corsHeaders)) {
          headers.set(k, v)
        }
        return new Response(as2Response.body, {
          status: as2Response.status,
          headers
        })
      } catch (error) {
        console.error(`[router] GET ${collection} AS2 error: ${error}`)
        return new Response(error instanceof Error ? error.message : 'Bad Gateway', {
          status: 502,
          headers: corsHeaders
        })
      }
    }

    if (collection === 'following') {
      const publicRootUrl = `${config.baseUrl}/${actorName}/following`
      const podRootUrl = `${config.solidStorageBaseUrl}${actorName}/following/`
      try {
        const as2Response = page
          ? await serializeFollowingPage(fetchFn, targetUrl, podRootUrl, publicRootUrl)
          : await serializeFollowingCollection(fetchFn, podRootUrl, publicRootUrl)
        const headers = new Headers(as2Response.headers)
        for (const [k, v] of Object.entries(corsHeaders)) {
          headers.set(k, v)
        }
        return new Response(as2Response.body, {
          status: as2Response.status,
          headers
        })
      } catch (error) {
        console.error(`[router] GET ${collection} AS2 error: ${error}`)
        return new Response(error instanceof Error ? error.message : 'Bad Gateway', {
          status: 502,
          headers: corsHeaders
        })
      }
    }

    if (collection === 'inbox') {
      const publicRootUrl = `${config.baseUrl}/${actorName}/inbox`
      const podRootUrl = `${config.solidStorageBaseUrl}${actorName}/inbox/`
      try {
        const as2Response = page
          ? await serializeInboxPage(fetchFn, targetUrl, podRootUrl, publicRootUrl)
          : await serializeInboxCollection(fetchFn, podRootUrl, publicRootUrl)
        const headers = new Headers(as2Response.headers)
        for (const [k, v] of Object.entries(corsHeaders)) {
          headers.set(k, v)
        }
        return new Response(as2Response.body, {
          status: as2Response.status,
          headers
        })
      } catch (error) {
        console.error(`[router] GET ${collection} AS2 error: ${error}`)
        return new Response(error instanceof Error ? error.message : 'Bad Gateway', {
          status: 502,
          headers: corsHeaders
        })
      }
    }

    if (collection === 'outbox') {
      const publicRootUrl = `${config.baseUrl}/${actorName}/outbox`
      const podRootUrl = `${config.solidStorageBaseUrl}${actorName}/outbox/`
      try {
        const as2Response = page
          ? await serializeOutboxPage(fetchFn, targetUrl, podRootUrl, publicRootUrl)
          : await serializeOutboxCollection(fetchFn, podRootUrl, publicRootUrl)
        const headers = new Headers(as2Response.headers)
        for (const [k, v] of Object.entries(corsHeaders)) {
          headers.set(k, v)
        }
        return new Response(as2Response.body, {
          status: as2Response.status,
          headers
        })
      } catch (error) {
        console.error(`[router] GET ${collection} AS2 error: ${error}`)
        return new Response(error instanceof Error ? error.message : 'Bad Gateway', {
          status: 502,
          headers: corsHeaders
        })
      }
    }
  }

  try {
    const acceptHeader = req.headers.get('Accept') || 'text/turtle'
    const podResponse = await fetchFn(targetUrl, {
      headers: { accept: acceptHeader }
    })
    const contentType = podResponse.headers.get('Content-Type') || 'text/turtle'
    const body = await podResponse.text()
    const rewrittenBody = rewriteBody(body, config.solidStorageBaseUrl, config.baseUrl, actorName, collection, targetUrl)
    return new Response(rewrittenBody, {
      status: podResponse.status,
      headers: { ...corsHeaders, 'Content-Type': contentType }
    })
  } catch (error) {
    console.error(`[router] GET ${collection} error: ${error}`)
    return new Response(error instanceof Error ? error.message : 'Bad Gateway', {
      status: 502,
      headers: corsHeaders
    })
  }
}

async function handleActorGet(
  config: ReturnType<typeof loadConfig>,
  fetchFn: Awaited<ReturnType<typeof createSolidFetch>>,
  actor: ReturnType<typeof resolveActor>,
  corsHeaders: Record<string, string>,
  req: Request
): Promise<Response> {
  if (!actor) return new Response('Unknown actor', { status: 404, headers: corsHeaders })

  if (!wantsAs2Json(req.headers.get('Accept'))) {
    try {
      const template = fs.readFileSync(actorPageTemplatePath, 'utf-8')
      const domain = config.baseUrl.replace(/^https?:\/\//, '')
      const html = renderActorPageHtml(template, config.baseUrl, actor.name, domain)
      return new Response(html, {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'text/html; charset=utf-8' }
      })
    } catch (error) {
      console.error(`[router] GET /${actor.name} HTML template error: ${error}; falling back to JSON`)
    }
  }

  const pem = await getPublicKeyPem(actor.name)
  const skeleton = buildActorSkeleton(actor, pem)

  const profileUrl = `${config.solidStorageBaseUrl}${actor.name}/profile`
  try {
    const profileResponse = await fetchFn(profileUrl, {
      headers: { accept: 'text/turtle' }
    })
    if (profileResponse.ok) {
      const turtle = await profileResponse.text()
      const profile = parseProfileTurtle(turtle, profileUrl)
      applyProfile(skeleton, profile)
    } else if (profileResponse.status !== 404) {
      console.log(`[router] GET /${actor.name} profile fetch returned ${profileResponse.status}; serving skeleton only`)
    }
  } catch (error) {
    console.error(`[router] GET /${actor.name} profile fetch error: ${error}; serving skeleton only`)
  }

  return new Response(JSON.stringify(skeleton), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/activity+json' }
  })
}

async function handlePostOutbox(
  req: Request,
  config: ReturnType<typeof loadConfig>,
  fetchFn: Awaited<ReturnType<typeof createSolidFetch>>,
  actor: ReturnType<typeof resolveActor>,
  corsHeaders: Record<string, string>
): Promise<Response> {
  if (!actor) return new Response('Unknown actor', { status: 404, headers: corsHeaders })

  const authHeader = req.headers.get('authorization')
  const dpopHeader = req.headers.get('dpop')

  const authResult = await verifyDpopToken(
    authHeader ?? undefined,
    dpopHeader ?? undefined,
    actor.outboxUrl,
    'POST',
    config.whitelistedIssuers
  )

  if (!authResult.success) {
    console.log(`[router] POST /${actor.name}/outbox auth failed: ${authResult.message}`)
    return new Response(authResult.message, {
      status: authResult.statusCode,
      headers: corsHeaders
    })
  }

  let activity: Activity
  try {
    const body = await req.json()
    activity = body as Activity
  } catch {
    return new Response('Invalid JSON body', { status: 400, headers: corsHeaders })
  }

  try {
    const podOutboxUrl = `${config.solidStorageBaseUrl}${actor.name}/outbox/`
    const result = await handleOutboxActivity(
      activity,
      fetchFn,
      podOutboxUrl,
      actor.name,
      actor.url,
      actor.keyId,
      config.solidStorageBaseUrl
    )

    console.log(`[router] POST /${actor.name}/outbox delivered to ${result.delivered}/${result.results.length} recipients`)

    const responseBody = JSON.stringify({
      status: 'ok',
      delivered: result.delivered,
      failed: result.failed,
      results: result.results
    })

    return new Response(responseBody, {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    if (errorMessage.includes('@context')) {
      return new Response(JSON.stringify({
        error: 'validation_failed',
        message: errorMessage
      }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }
    if (errorMessage.includes('Actor mismatch')) {
      return new Response(errorMessage, { status: 403, headers: corsHeaders })
    }
    console.error(`[router] POST outbox error: ${error}`)
    return new Response(errorMessage, {
      status: 500,
      headers: corsHeaders
    })
  }
}

async function handlePostInbox(
  req: Request,
  config: ReturnType<typeof loadConfig>,
  fetchFn: Awaited<ReturnType<typeof createSolidFetch>>,
  actor: ReturnType<typeof resolveActor>,
  corsHeaders: Record<string, string>
): Promise<Response> {
  if (!actor) return new Response('Unknown actor', { status: 404, headers: corsHeaders })

  let rawBody: ArrayBuffer
  try {
    rawBody = await req.arrayBuffer()
  } catch {
    return new Response('Failed to read request body', {
      status: 400,
      headers: corsHeaders
    })
  }

  const rawBytes = new Uint8Array(rawBody)

  let activity: Record<string, unknown>
  try {
    activity = JSON.parse(new TextDecoder('utf-8').decode(rawBytes)) as Record<string, unknown>
  } catch {
    return new Response('Invalid JSON body', {
      status: 400,
      headers: corsHeaders
    })
  }

  if (isActorDeleteActivity(activity)) {
    const actorUrl = typeof activity.actor === 'string' ? activity.actor : 'unknown'
    console.log(`[router] inbox short-circuit: actor Delete for ${actorUrl}, skipping signature verification`)
    return new Response('ok', { status: 200, headers: corsHeaders })
  }

  try {
    await verifyIncomingActivity(req, activity, rawBytes, fetchFn)
  } catch (error) {
    if (error instanceof HttpSignatureError) {
      console.error(formatHttpSignatureError(error))
      console.log(`[router] inbox reject: ${activitySummary(activity)}`)
      return new Response(error.message, {
        status: error.statusCode,
        headers: corsHeaders
      })
    }
    throw error
  }

  try {
    const podInboxUrl = `${config.solidStorageBaseUrl}${actor.name}/inbox/`
    const success = await handleInboxActivity(
      activity,
      fetchFn,
      podInboxUrl,
      actor.name,
      actor.url,
      actor.keyId,
      config.solidStorageBaseUrl
    )
    if (!success) {
      console.log(`[router] inbox reject: ${activitySummary(activity)}`)
      return new Response('Failed to process activity', {
        status: 422,
        headers: corsHeaders
      })
    }
    return new Response('ok', { status: 200, headers: corsHeaders })
  } catch (error) {
    console.error(`[router] POST inbox error: ${error}`)
    return new Response(error instanceof Error ? error.message : 'Internal error', {
      status: 500,
      headers: corsHeaders
    })
  }
}

async function handlePostSharedInbox(
  req: Request,
  config: ReturnType<typeof loadConfig>,
  fetchFn: Awaited<ReturnType<typeof createSolidFetch>>,
  corsHeaders: Record<string, string>
): Promise<Response> {
  let rawBody: ArrayBuffer
  try {
    rawBody = await req.arrayBuffer()
  } catch {
    return new Response('Failed to read request body', {
      status: 400,
      headers: corsHeaders
    })
  }

  const rawBytes = new Uint8Array(rawBody)

  let activity: Record<string, unknown>
  try {
    activity = JSON.parse(new TextDecoder('utf-8').decode(rawBytes)) as Record<string, unknown>
  } catch {
    return new Response('Invalid JSON body', {
      status: 400,
      headers: corsHeaders
    })
  }

  if (isActorDeleteActivity(activity)) {
    const actorUrl = typeof activity.actor === 'string' ? activity.actor : 'unknown'
    console.log(`[router] inbox short-circuit: actor Delete for ${actorUrl}, skipping signature verification`)
    return new Response('ok', { status: 200, headers: corsHeaders })
  }

  try {
    await verifyIncomingActivity(req, activity, rawBytes, fetchFn)
  } catch (error) {
    if (error instanceof HttpSignatureError) {
      console.error(formatHttpSignatureError(error))
      console.log(`[router] inbox reject: ${activitySummary(activity)}`)
      return new Response(error.message, {
        status: error.statusCode,
        headers: corsHeaders
      })
    }
    throw error
  }

  try {
    const result = await handleSharedInboxActivity(
      activity,
      fetchFn,
      { actorByPath: config.actorByPath, solidStorageBaseUrl: config.solidStorageBaseUrl }
    )
    if (!result.success) {
      console.log(`[router] inbox reject: ${activitySummary(activity)}`)
      return new Response('Failed to process activity', {
        status: 422,
        headers: corsHeaders
      })
    }
    return new Response('ok', { status: 200, headers: corsHeaders })
  } catch (error) {
    console.error(`[router] POST shared inbox error: ${error}`)
    return new Response(error instanceof Error ? error.message : 'Internal error', {
      status: 500,
      headers: corsHeaders
    })
  }
}

export default async (req: Request, context: Context) => {
  const corsHeaders = getCorsHeaders(req.headers.get('Origin'))
  console.log(`[router] ${req.method} ${new URL(req.url).pathname}`)

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders })
  }

  const pathname = new URL(req.url).pathname

  if (pathname === '/inbox') {
    if (req.method !== 'POST') {
      return new Response('Method not allowed', { status: 405, headers: corsHeaders })
    }
    const config = loadConfig()
    const fetchFn = await createSolidFetch(config.webId, config.issuer)
    return handlePostSharedInbox(req, config, fetchFn, corsHeaders)
  }

  const config = loadConfig()
  const actor = resolveActor(config, context.params.actor)
  if (!actor) {
    return new Response('Unknown actor', { status: 404, headers: corsHeaders })
  }

  const fetchFn = await createSolidFetch(config.webId, config.issuer)

  if (isActorPath(pathname, actor.name)) {
    if (req.method === 'GET') {
      return handleActorGet(config, fetchFn, actor, corsHeaders, req)
    }
    return new Response('Method not allowed', { status: 405, headers: corsHeaders })
  }

  const collection = collectionFromPath(pathname)
  if (!collection) {
    return new Response('Unknown collection', { status: 404, headers: corsHeaders })
  }

  if (req.method === 'GET') {
    return handleGet(req, context, config, fetchFn, actor.name, collection, corsHeaders)
  }

  if (req.method === 'POST') {
    if (collection === 'outbox') {
      return handlePostOutbox(req, config, fetchFn, actor, corsHeaders)
    }
    if (collection === 'inbox') {
      return handlePostInbox(req, config, fetchFn, actor, corsHeaders)
    }
    return new Response('POST not allowed on this collection', { status: 405, headers: corsHeaders })
  }

  return new Response('Method not allowed', { status: 405, headers: corsHeaders })
}
