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

export type SignatureFailureCode =
  | 'missing_signature'
  | 'missing_date'
  | 'missing_digest'
  | 'invalid_signature_header'
  | 'unsupported_algorithm'
  | 'timestamp_out_of_range'
  | 'digest_mismatch'
  | 'actor_url_blocked'
  | 'actor_fetch_failed'
  | 'keyid_mismatch'
  | 'signature_invalid'
  | 'actor_binding_mismatch'

export interface SignatureErrorContext {
  code: SignatureFailureCode
  keyId?: string
  actorUrl?: string
  algorithm?: string
  signedHeaders?: string[]
  actorFetchStatus?: number
  rawSignatureHeader?: string
  dateHeader?: string
  contentType?: string
  digestHeader?: string
  expectedDigest?: string
  actualDigest?: string
  bodyLength?: number
  signingString?: string
  activityActor?: string
  cause?: string
}

export class HttpSignatureError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public context: SignatureErrorContext
  ) {
    super(message)
    this.name = 'HttpSignatureError'
  }
}

export function formatHttpSignatureError(error: HttpSignatureError): string {
  const c = error.context
  const parts: (string | false)[] = [
    `[router] signature auth failed code=${c.code}`,
    c.keyId !== undefined && `keyId=${c.keyId}`,
    c.actorUrl !== undefined && `actorUrl=${c.actorUrl}`,
    c.algorithm !== undefined && `algorithm=${c.algorithm}`,
    c.signedHeaders !== undefined && `signedHeaders=[${c.signedHeaders.join(',')}]`,
    c.actorFetchStatus !== undefined && `actorFetchStatus=${c.actorFetchStatus}`,
    c.rawSignatureHeader !== undefined && `signatureHeader=${c.rawSignatureHeader}`,
    c.dateHeader !== undefined && `dateHeader=${c.dateHeader}`,
    c.contentType !== undefined && `contentType=${c.contentType}`,
    c.digestHeader !== undefined && `digestHeader=${c.digestHeader}`,
    c.expectedDigest !== undefined && `expectedDigest=${c.expectedDigest}`,
    c.actualDigest !== undefined && `actualDigest=${c.actualDigest}`,
    c.bodyLength !== undefined && `bodyLength=${c.bodyLength}`,
    c.signingString !== undefined && `signingString=\`${c.signingString.replace(/\n/g, '\\n')}\``,
    c.activityActor !== undefined && `activityActor=${c.activityActor}`,
    c.cause !== undefined && `cause=${c.cause}`,
    `statusCode=${error.statusCode}`
  ]
  return parts.filter((p): p is string => Boolean(p)).join(' ')
}

export async function verifyIncomingActivity(
  req: Request,
  activity: Record<string, unknown>,
  rawBody: ArrayBuffer | Uint8Array,
  fetchFn: SolidFetch
): Promise<{ keyId: string }> {
  const signatureHeader = req.headers.get('Signature')
  if (!signatureHeader) {
    throw new HttpSignatureError('Missing Signature header', 401, { code: 'missing_signature' })
  }

  const dateHeader = req.headers.get('Date')
  if (!dateHeader) {
    throw new HttpSignatureError('Missing Date header', 400, { code: 'missing_date' })
  }

  const digestHeader = req.headers.get('Digest')
  if (!digestHeader) {
    throw new HttpSignatureError('Missing Digest header', 400, { code: 'missing_digest' })
  }

  const contentType = req.headers.get('Content-Type') || 'application/activity+json'

  let parsed
  try {
    parsed = parseSignatureHeader(signatureHeader)
  } catch {
    throw new HttpSignatureError('Invalid Signature header', 400, {
      code: 'invalid_signature_header',
      rawSignatureHeader: signatureHeader
    })
  }

  if (!isAllowedAlgorithm(parsed.algorithm)) {
    throw new HttpSignatureError(`Unsupported algorithm: ${parsed.algorithm}`, 400, {
      code: 'unsupported_algorithm',
      algorithm: parsed.algorithm
    })
  }

  if (!validateTimestamp(dateHeader)) {
    throw new HttpSignatureError('Request timestamp out of range', 400, {
      code: 'timestamp_out_of_range',
      dateHeader
    })
  }

  const digestResult = verifyDigest(rawBody, digestHeader)
  if (!digestResult.match) {
    throw new HttpSignatureError('Digest verification failed', 400, {
      code: 'digest_mismatch',
      keyId: parsed.keyId,
      digestHeader,
      expectedDigest: digestResult.expected || undefined,
      actualDigest: digestResult.actual || undefined,
      bodyLength: digestResult.bodyLength
    })
  }

  const actorUrl = parsed.keyId.split('#')[0]
  let actorKey
  try {
    actorKey = await fetchActorPublicKey(actorUrl, fetchFn)
  } catch (e) {
    if (e instanceof Error && e.message.includes('SSRF')) {
      throw new HttpSignatureError('Actor URL blocked', 502, {
        code: 'actor_url_blocked',
        keyId: parsed.keyId,
        actorUrl
      })
    }
    const underlyingMessage = e instanceof Error ? e.message : String(e)
    const status = e instanceof Error && typeof (e as Error & { actorFetchStatus?: number }).actorFetchStatus === 'number'
      ? (e as Error & { actorFetchStatus?: number }).actorFetchStatus
      : undefined
    throw new HttpSignatureError('Failed to fetch actor key', 502, {
      code: 'actor_fetch_failed',
      keyId: parsed.keyId,
      actorUrl,
      actorFetchStatus: status,
      cause: underlyingMessage
    })
  }

  if (actorKey.keyId !== parsed.keyId) {
    throw new HttpSignatureError('keyId does not match actor publicKey', 401, {
      code: 'keyid_mismatch',
      keyId: parsed.keyId,
      actorUrl
    })
  }

  const url = new URL(req.url)
  const headersToSign: Record<string, string> = {}
  const signedHeaders = parsed.headers.split(' ')
  for (const headerName of signedHeaders) {
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
    throw new HttpSignatureError('Signature verification failed', 401, {
      code: 'signature_invalid',
      keyId: parsed.keyId,
      algorithm: parsed.algorithm,
      signedHeaders,
      dateHeader,
      contentType,
      digestHeader,
      signingString: signatureBase
    })
  }

  const activityActor = typeof activity.actor === 'string' ? activity.actor : undefined
  if (!verifyActorBinding(activity, parsed.keyId)) {
    throw new HttpSignatureError('Actor does not match signature', 400, {
      code: 'actor_binding_mismatch',
      keyId: parsed.keyId,
      activityActor
    })
  }

  return { keyId: parsed.keyId }
}