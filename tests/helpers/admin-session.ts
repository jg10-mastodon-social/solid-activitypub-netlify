import { devServerUrl } from './dev-server.js'

export const ADMIN_WEBID = `${devServerUrl}/webid`

export async function mintAdminSession() {
  const { importJWK, SignJWT, calculateJwkThumbprint, generateKeyPair, exportJWK } = await import('jose')
  const { randomUUID, createHash } = await import('crypto')
  const { readFileSync } = await import('fs')
  const { fileURLToPath } = await import('url')
  const nodePath = await import('path')

  const __filename = fileURLToPath(import.meta.url)
  const privateKeyPath = nodePath.resolve(nodePath.dirname(__filename), '../../src/private-key.ts')
  const identityKeyFile = readFileSync(privateKeyPath, 'utf8')
  const identityKeyJson = identityKeyFile.replace(/^export const privateKey = /, '').replace(/\n$/, '')
  const identityKey = JSON.parse(identityKeyJson) as {
    kid: string
    kty: string
    crv: string
    x: string
    y: string
    d: string
    alg: string
  }
  const identityPrivateKey = await importJWK(identityKey, 'ES256')

  const dpopKeyPair = await generateKeyPair('ES256', { crv: 'P-256' })
  const dpopPublicJwk = await exportJWK(dpopKeyPair.publicKey)
  dpopPublicJwk.kid = createHash('sha256')
    .update(JSON.stringify(dpopPublicJwk))
    .digest('base64url')
  dpopPublicJwk.alg = 'ES256'
  const jkt = await calculateJwkThumbprint(dpopPublicJwk, 'sha256')

  const now = Math.floor(Date.now() / 1000)
  const token = await new SignJWT({ webid: ADMIN_WEBID, sub: ADMIN_WEBID, cnf: { jkt } })
    .setProtectedHeader({ alg: 'ES256', typ: 'at+jwt', kid: identityKey.kid })
    .setIssuedAt(now)
    .setExpirationTime(now + 3600)
    .setAudience('solid')
    .setIssuer(devServerUrl)
    .setJti(randomUUID())
    .sign(identityPrivateKey)

  return {
    async headers(method: string, url: string) {
      const dpop = await new SignJWT({ htu: url, htm: method, jti: randomUUID() })
        .setProtectedHeader({ alg: 'ES256', typ: 'dpop+jwt', jwk: dpopPublicJwk })
        .setIssuedAt(Math.floor(Date.now() / 1000))
        .sign(dpopKeyPair.privateKey)
      return { authorization: `DPoP ${token}`, dpop }
    }
  }
}
