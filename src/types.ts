export interface OutboxEvent {
  type: 'Add' | 'Remove' | 'Update'
  object: string
  topic: string
  raw: unknown
}

export type SolidFetch = (
  url: string | URL | Request,
  init?: RequestInit
) => Promise<Response>

export interface Config {
  webId: string
  issuer: string
  baseUrl: string
  outboxEndpoint: string
  sendToUrl: string
  whitelistedIssuers: string[]
  solidStorageBaseUrl: string
  handlerBaseUrl: string
  adminWebId: string
  inboxUrl: string
  outboxUrl: string
  actorName: string
  actorPath: string
}

export interface TokenPayload {
  webid: string
  client_id: string
  iss: string
  iat: number
  exp: number
  cnf?: {
    jkt: string
  }
}