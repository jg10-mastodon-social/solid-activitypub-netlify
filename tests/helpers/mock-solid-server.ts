import http from 'http'
import { URL } from 'url'

interface MockSolidServerOptions {
  port: number
  simulateError?: boolean
  errorType?: 'unreachable' | '404' | '500'
}

type Collection = 'inbox' | 'outbox' | 'followers'

export class MockSolidServer {
  private server: http.Server | null = null
  private port: number
  private simulateError = false
  private errorType: 'unreachable' | '404' | '500' = '500'
  private createdPages: Set<string> = new Set()
  private collectionFirst: Record<string, Record<string, string>> = {
    inbox: {},
    outbox: {},
    followers: {},
  }
  private patchedInboxPages: Array<{ url: string; body: string }> = []
  private patchedOutboxPages: Array<{ url: string; body: string }> = []
  private patchedFollowersPages: Array<{ url: string; body: string }> = []
  private receivedActivities: Array<{ url: string; body: string }> = []
  private followerActorsByCollection: Record<string, string[]> = {}

  constructor(options: MockSolidServerOptions) {
    this.port = options.port
    if (options.simulateError) {
      this.simulateError = true
      this.errorType = options.errorType || '500'
    }
  }

  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server = http.createServer((req, res) => this.handleRequest(req, res))
      this.server.on('error', reject)
      this.server.listen(this.port, () => resolve())
    })
  }

  stop(): void {
    if (this.server) {
      this.server.close()
      this.server = null
    }
    this.createdPages.clear()
    this.collectionFirst = { inbox: {}, outbox: {}, followers: {} }
    this.patchedInboxPages = []
    this.patchedOutboxPages = []
    this.receivedActivities = []
    this.followerActorsByCollection = {}
  }

  setError(simulateError: boolean, errorType?: 'unreachable' | '404' | '500'): void {
    this.simulateError = simulateError
    if (errorType) this.errorType = errorType
  }

setFollowerActors(actors: string[], actorName: string = 'actor'): void {
  this.followerActorsByCollection[actorName] = actors
  if (actors.length > 0 && !this.collectionFirst.followers[actorName]) {
    const pageUrl = `http://localhost:${this.port}/${actorName}/followers/pages/1`
    this.collectionFirst.followers[actorName] = pageUrl
    this.createdPages.add(pageUrl)
  }
}

  getPatchedPages(): Array<{ url: string; body: string }> {
    return [...this.patchedInboxPages]
  }

  getCreatedPages(): string[] {
    return [...this.createdPages]
  }

  getInboxFirst(): string | null {
    return this.collectionFirst.inbox['actor'] ?? null
  }

  getOutboxFirst(): string | null {
    return this.collectionFirst.outbox['actor'] ?? null
  }

  getPatchedOutboxPages(): Array<{ url: string; body: string }> {
    return [...this.patchedOutboxPages]
  }

  getReceivedActivities(): Array<{ url: string; body: string }> {
    return [...this.receivedActivities]
  }

  getPatchedFollowers(): Array<{ url: string; body: string }> {
    return [...this.patchedFollowersPages]
  }

  getFollowersFirst(): string | null {
    return this.collectionFirst.followers['actor'] ?? null
  }

  private handleRequest(req: http.IncomingMessage, res: http.ServerResponse): void {
    if (this.simulateError) {
      if (this.errorType === 'unreachable') {
        req.destroy()
        return
      }
      res.writeHead(this.errorType === '404' ? 404 : 500)
      res.end(this.errorType === '404' ? 'Not Found' : 'Server Error')
      return
    }

    const baseUrl = `http://localhost:${this.port}`
    let url: URL
    try {
      url = new URL(req.url!, baseUrl)
    } catch {
      res.writeHead(400)
      res.end('Invalid URL')
      return
    }

    const pathname = url.pathname

    if (req.method === 'GET' && pathname === '/actor') {
      this.handleGetActor(req, res)
      return
    }

    const parsed = parsePerActorPath(pathname)
    if (!parsed) {
      res.writeHead(404)
      res.end('Not Found')
      return
    }

    const { actorName, collection, pagePath, isCollectionRoot } = parsed
    const collectionUrl = `${baseUrl}/${actorName}/${collection}/`

    if (req.method === 'POST' && isCollectionRoot && collection === 'inbox') {
      this.handlePostActorInbox(req, res)
    } else if (req.method === 'GET' && isCollectionRoot) {
      this.handleGetCollection(req, res, collectionUrl, actorName, collection)
    } else if (req.method === 'PUT' && pagePath?.startsWith('pages/')) {
      this.handlePutPage(req, res, pathname, actorName, collection)
    } else if (req.method === 'PATCH' && pagePath?.startsWith('pages/')) {
      this.handlePatchPage(req, res, pathname, collection, actorName)
    } else if (req.method === 'GET' && pagePath?.startsWith('pages/')) {
      this.handleGetPage(req, res, pathname, actorName, collection)
    } else if (req.method === 'HEAD' && isCollectionRoot && collection === 'followers') {
      res.writeHead(200)
      res.end()
    } else {
      res.writeHead(404)
      res.end('Not Found')
    }
  }

  private handleGetActor(req: http.IncomingMessage, res: http.ServerResponse): void {
    const accept = req.headers.accept || ''
    if (!accept.includes('application/activity+json') && !accept.includes('application/ld+json') && !accept.includes('*/*')) {
      res.writeHead(406)
      res.end('Not Acceptable')
      return
    }

    const actor = {
      '@context': 'https://www.w3.org/ns/activitystreams',
      id: `http://localhost:${this.port}/actor`,
      type: 'Service',
      inbox: `http://localhost:${this.port}/actor/inbox`,
      outbox: `http://localhost:${this.port}/actor/outbox`,
      followers: `http://localhost:${this.port}/actor/followers/`
    }

    res.writeHead(200, { 'Content-Type': 'application/activity+json' })
    res.end(JSON.stringify(actor))
  }

  private handlePostActorInbox(req: http.IncomingMessage, res: http.ServerResponse): void {
    let body = ''
    req.on('data', chunk => { body += chunk })
    req.on('end', () => {
      this.receivedActivities.push({ url: `http://localhost:${this.port}/actor/inbox`, body })
      res.writeHead(200)
      res.end('OK')
    })
  }

  private handleGetCollection(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    collectionUrl: string,
    actorName: string,
    collection: Collection
  ): void {
    const accept = req.headers.accept || ''
    if (!accept.includes('text/turtle') && !accept.includes('*/*')) {
      res.writeHead(406)
      res.end('Not Acceptable')
      return
    }

    let body = `@prefix as: <https://www.w3.org/ns/activitystreams#>.
<${collectionUrl}> a as:OrderedCollection.`

    const first = this.collectionFirst[collection][actorName]
    if (first) {
      body += `\n<${collectionUrl}> as:first <${first}>.`
    }

    res.writeHead(200, { 'Content-Type': 'text/turtle' })
    res.end(body)
  }

  private handlePutPage(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    pathname: string,
    actorName: string,
    collection: Collection
  ): void {
    const pageUrl = `http://localhost:${this.port}${pathname}`

    if (this.createdPages.has(pageUrl)) {
      res.writeHead(409)
      res.end('Already exists')
      return
    }

    this.createdPages.add(pageUrl)
    if (!this.collectionFirst[collection][actorName]) {
      this.collectionFirst[collection][actorName] = pageUrl
    }
    res.writeHead(201)
    res.end('Created')
  }

  private handlePatchPage(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    pathname: string,
    collection: Collection,
    actorName: string
  ): void {
    const pageUrl = `http://localhost:${this.port}${pathname}`

    let body = ''
    req.on('data', chunk => { body += chunk })
    req.on('end', () => {
      if (!this.createdPages.has(pageUrl)) {
        res.writeHead(404)
        res.end('Page not found')
        return
      }

      if (collection === 'inbox') {
        this.patchedInboxPages.push({ url: pageUrl, body })
      } else if (collection === 'outbox') {
        this.patchedOutboxPages.push({ url: pageUrl, body })
      } else {
        this.patchedFollowersPages.push({ url: pageUrl, body })
      }
      res.writeHead(200)
      res.end('OK')
    })
  }

  private handleGetPage(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    pathname: string,
    actorName: string,
    collection: Collection
  ): void {
    const pageUrl = `http://localhost:${this.port}${pathname}`
    const accept = req.headers.accept || ''

    if (!accept.includes('text/turtle') && !accept.includes('*/*')) {
      res.writeHead(406)
      res.end('Not Acceptable')
      return
    }

    if (!this.createdPages.has(pageUrl)) {
      res.writeHead(404)
      res.end('Not found')
      return
    }

    const collectionUrl = `http://localhost:${this.port}/${actorName}/${collection}/`
    const patches = collection === 'inbox' ? this.patchedInboxPages
      : collection === 'outbox' ? this.patchedOutboxPages
      : this.patchedFollowersPages
    const isFull = patches.filter(p => p.url === pageUrl).length >= 5

    let body = `@prefix as: <https://www.w3.org/ns/activitystreams#>.
<${pageUrl}> a as:OrderedCollectionPage;
  as:partOf <${collectionUrl}>.`

    if (isFull) {
      body += `\n  as:next <${collectionUrl}pages/next>.`
    }

    if (collection === 'followers') {
      const actors = this.followerActorsByCollection[actorName] || []
      if (actors.length > 0) {
        const items = actors.map(actor =>
          `<${pageUrl}> <https://www.w3.org/ns/activitystreams#items> <${actor}>.`
        ).join('\n')
        body += `\n\n${items}`
      }
    }

    res.writeHead(200, { 'Content-Type': 'text/turtle' })
    res.end(body)
  }
}

function parsePerActorPath(pathname: string): {
  actorName: string
  collection: Collection
  pagePath: string | null
  isCollectionRoot: boolean
} | null {
  const match = pathname.match(/^\/([^/]+)\/(inbox|outbox|followers)(\/.*)?$/)
  if (!match) return null
  const actorName = match[1]
  const collection = match[2] as Collection
  const rest = match[3] || null
  return {
    actorName,
    collection,
    pagePath: rest === null || rest === '/' ? null : rest.replace(/^\//, ''),
    isCollectionRoot: rest === null || rest === '/',
  }
}

let mockServer: MockSolidServer | null = null

export async function startMockSolidServer(port = 9998): Promise<MockSolidServer> {
  if (mockServer) {
    mockServer.stop()
  }
  mockServer = new MockSolidServer({ port })
  await mockServer.start()
  return mockServer
}

export function stopMockSolidServer(): void {
  if (mockServer) {
    mockServer.stop()
    mockServer = null
  }
}

export function getMockSolidServer(): MockSolidServer | null {
  return mockServer
}