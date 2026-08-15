import type { Config } from '@netlify/functions'
// @ts-ignore
import { webfingerEntries } from '../../src/webfinger-data.js'

const getCorsHeaders = (origin: string | null) => ({
  'Access-Control-Allow-Origin': origin ?? '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Accept',
  'Vary': 'Origin',
  'Content-Type': 'application/jrd+json',
})

export const config: Config = {
  path: '/.well-known/webfinger',
  method: ['GET', 'OPTIONS'],
}

export default async (req: Request) => {
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

  const entry = webfingerEntries[resource]
  if (!entry) {
    return new Response('Resource not found', {
      status: 404,
      headers: corsHeaders
    })
  }

  return new Response(JSON.stringify(entry), {
    status: 200,
    headers: corsHeaders
  })
}