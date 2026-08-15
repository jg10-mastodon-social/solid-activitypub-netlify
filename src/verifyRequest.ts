import {
  parseSignatureHeader,
  isAllowedAlgorithm,
  validateTimestamp,
  verifyDigest,
  fetchActorPublicKey,
  buildSignatureBase,
  verifySignature,
  verifyActorBinding
} from './verifyHttpSignature.js'
import type { SolidFetch } from './types.js'

export class HttpSignatureError extends Error {
  constructor(message: string, public statusCode: number = 401) {
    super(message)
    this.name = 'HttpSignatureError'
  }
}

export async function verifyIncomingActivity(
  req: Request,
  activity: Record<string, unknown>,
  rawBody: ArrayBuffer | Uint8Array,
  fetchFn: SolidFetch
): Promise<{ keyId: string }> {
  const signatureHeader = req.headers.get('Signature')
  if (!signatureHeader) {
    throw new HttpSignatureError('Missing Signature header', 401)
  }

  const dateHeader = req.headers.get('Date')
  if (!dateHeader) {
    throw new HttpSignatureError('Missing Date header', 400)
  }

  const digestHeader = req.headers.get('Digest')
  if (!digestHeader) {
    throw new HttpSignatureError('Missing Digest header', 400)
  }

  const contentType = req.headers.get('Content-Type') || 'application/activity+json'

  let parsed
  try {
    parsed = parseSignatureHeader(signatureHeader)
  } catch {
    throw new HttpSignatureError('Invalid Signature header', 400)
  }

  if (!isAllowedAlgorithm(parsed.algorithm)) {
    throw new HttpSignatureError(`Unsupported algorithm: ${parsed.algorithm}`, 400)
  }

  if (!validateTimestamp(dateHeader)) {
    throw new HttpSignatureError('Request timestamp out of range', 400)
  }

  if (!verifyDigest(rawBody, digestHeader)) {
    throw new HttpSignatureError('Digest verification failed', 400)
  }

  const actorUrl = parsed.keyId.split('#')[0]
  let actorKey
  try {
    actorKey = await fetchActorPublicKey(actorUrl, fetchFn)
  } catch (e) {
    if (e instanceof Error && e.message.includes('SSRF')) {
      throw new HttpSignatureError('Actor URL blocked', 502)
    }
    throw new HttpSignatureError('Failed to fetch actor key', 502)
  }

  if (actorKey.keyId !== parsed.keyId) {
    throw new HttpSignatureError('keyId does not match actor publicKey', 401)
  }

  const url = new URL(req.url)
  const headersToSign: Record<string, string> = {}
  for (const headerName of parsed.headers.split(' ')) {
    if (headerName === '(request-target)') {
      headersToSign[headerName] = `post ${url.pathname}${url.search}`
    } else if (headerName === 'host') {
      headersToSign[headerName] = url.host
    } else if (headerName === 'date') {
      headersToSign[headerName] = dateHeader
    } else if (headerName === 'digest') {
      headersToSign[headerName] = digestHeader
    } else if (headerName === 'content-type') {
      headersToSign[headerName] = contentType
    }
  }

  const signatureBase = buildSignatureBase(headersToSign)

  const valid = await verifySignature(
    actorKey.publicKeyPem,
    parsed.algorithm,
    signatureBase,
    parsed.signature
  )
  if (!valid) {
    throw new HttpSignatureError('Signature verification failed', 401)
  }

  if (!verifyActorBinding(activity, parsed.keyId)) {
    throw new HttpSignatureError('Actor does not match signature', 400)
  }

  return { keyId: parsed.keyId }
}