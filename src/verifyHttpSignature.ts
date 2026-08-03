export interface ParsedSignature {
  keyId: string
  algorithm: string
  headers: string
  signature: string
}

export function parseSignatureHeader(header: string): ParsedSignature {
  const result: Partial<ParsedSignature> = {}

  const keyIdMatch = header.match(/keyId="([^"]+)"/)
  if (!keyIdMatch) {
    throw new Error('Missing keyId in Signature header')
  }
  result.keyId = keyIdMatch[1]

  const algorithmMatch = header.match(/algorithm="([^"]+)"/)
  if (!algorithmMatch) {
    throw new Error('Missing algorithm in Signature header')
  }
  result.algorithm = algorithmMatch[1]

  const headersMatch = header.match(/headers="([^"]+)"/)
  if (!headersMatch) {
    throw new Error('Missing headers in Signature header')
  }
  result.headers = headersMatch[1]

  const signatureMatch = header.match(/signature="([^"]+)"/)
  if (!signatureMatch) {
    throw new Error('Missing signature in Signature header')
  }
  result.signature = signatureMatch[1]

  return result as ParsedSignature
}

const ALLOWED_ALGORITHMS = [
  'rsa-sha256',
  'rsa-v1_5-sha256',
  'hs2019',
  'rsa-pss-sha512',
  'ecdsa-p256-sha256',
  'ed25519'
]

export function isAllowedAlgorithm(algorithm: string): boolean {
  return ALLOWED_ALGORITHMS.includes(algorithm)
}