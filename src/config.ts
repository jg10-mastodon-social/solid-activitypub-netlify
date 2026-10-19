import type { Config } from './types.js'
// @ts-ignore
import { baseUrl } from './base-url.js'

export function loadConfig(): Config {
  const whitelistedIssuersStr = process.env.WHITELISTED_ISSUERS
  if (!whitelistedIssuersStr) {
    throw new Error('WHITELISTED_ISSUERS is required')
  }
  if (!process.env.SOLID_STORAGE_BASE_URL) {
    throw new Error('SOLID_STORAGE_BASE_URL is required')
  }
  if (!process.env.SOLID_STORAGE_BASE_URL.endsWith('/')) {
    throw new Error('SOLID_STORAGE_BASE_URL must end with /')
  }

  const webId = process.env.WEBID || `${baseUrl}/webid`
  const issuer = process.env.ISSUER || baseUrl
  const outboxEndpoint = '/outbox'
  const sendToUrl = process.env.SEND_TO_URL || `${baseUrl}${outboxEndpoint}`
  const adminWebId = process.env.ADMIN_WEBID || ''
  const whitelistedIssuers = whitelistedIssuersStr.split(',').map((s) => s.trim())
  const solidStorageBaseUrl = process.env.SOLID_STORAGE_BASE_URL
  const inboxUrl = `${solidStorageBaseUrl}inbox/`
  const outboxUrl = `${solidStorageBaseUrl}outbox/`

  return {
    webId,
    issuer,
    baseUrl,
    outboxEndpoint,
    sendToUrl,
    whitelistedIssuers,
    solidStorageBaseUrl,
    adminWebId,
    inboxUrl,
    outboxUrl,
  }
}