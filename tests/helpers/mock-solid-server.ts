import http from 'http'
import { URL } from 'url'

interface MockSolidServerOptions {
  port: number
  simulateError?: boolean
  errorType?: 'unreachable' | '404' | '500'
}

export class MockSolidServer {
  private server: http.Server | null = null
  private port: number
  private simulateError = false
  private errorType: 'unreachable' | '404' | '500' = '500'
  private createdPages: Set<string> = new Set()
  private inboxFirst: string | null = null
  private outboxFirst: string | null = null
  private patchedPages: Array<{ url: string; body: string }> = []
  private patchedOutboxPages: Array<{ url: string; body: string }> = []
  private receivedActivities: Array<{ url: string; body: string }> = []
  private followersFirst: string | null = null
  private patchedFollowersPages: Array<{ url: string; body: string }> = []

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
    this.inboxFirst = null
    this.outboxFirst = null
    this.patchedPages = []
    this.patchedOutboxPages = []
    this.receivedActivities = []
    this.followersFirst = null
    this.patchedFollowersPages = []
  }

  setError(simulateError: boolean, errorType?: 'unreachable' | '404' | '500'): void {
    this.simulateError = simulateError
    if (errorType) this.errorType = errorType
  }

  getPatchedPages(): Array<{ url: string; body: string }> {
    return [...this.patchedPages]
  }

  getCreatedPages(): string[] {
    return [...this.createdPages]
  }

  getInboxFirst(): string | null {
    return this.inboxFirst
  }

  getOutboxFirst(): string | null {
    return this.outboxFirst
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
    return this.followersFirst
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
    } else if (req.method === 'POST' && pathname === '/inbox') {
      this.handlePostActorInbox(req, res)
    } else if (req.method === 'GET' && pathname === '/inbox/') {
      this.handleGetInbox(req, res, url)
    } else if (req.method === 'PUT' && pathname.startsWith('/inbox/pages/')) {
      this.handlePutPage(req, res, pathname)
    } else if (req.method === 'PATCH' && pathname.startsWith('/inbox/pages/')) {
      this.handlePatchPage(req, res, pathname)
    } else if (req.method === 'GET' && pathname.startsWith('/inbox/pages/')) {
      this.handleGetPage(req, res, pathname)
    } else if (req.method === 'GET' && pathname === '/outbox/') {
      this.handleGetOutbox(req, res, url)
    } else if (req.method === 'PUT' && pathname.startsWith('/outbox/pages/')) {
      this.handlePutOutboxPage(req, res, pathname)
    } else if (req.method === 'PATCH' && pathname.startsWith('/outbox/pages/')) {
      this.handlePatchOutboxPage(req, res, pathname)
    } else if (req.method === 'GET' && pathname.startsWith('/outbox/pages/')) {
      this.handleGetOutboxPage(req, res, pathname)
    } else if (req.method === 'HEAD' && pathname === '/followers/') {
      this.handleHeadFollowers(req, res)
    } else if (req.method === 'GET' && pathname === '/followers/') {
      this.handleGetFollowers(req, res, url)
    } else if (req.method === 'PUT' && pathname.startsWith('/followers/pages/')) {
      this.handlePutFollowersPage(req, res, pathname)
    } else if (req.method === 'PATCH' && pathname.startsWith('/followers/pages/')) {
      this.handlePatchFollowersPage(req, res, pathname)
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
      inbox: `http://localhost:${this.port}/inbox`,
      outbox: `http://localhost:${this.port}/outbox`,
      followers: `http://localhost:${this.port}/followers/`
    }

    res.writeHead(200, { 'Content-Type': 'application/activity+json' })
    res.end(JSON.stringify(actor))
  }

  private handlePostActorInbox(req: http.IncomingMessage, res: http.ServerResponse): void {
    let body = ''
    req.on('data', chunk => { body += chunk })
    req.on('end', () => {
      this.receivedActivities.push({ url: `http://localhost:${this.port}/inbox`, body })
      res.writeHead(200)
      res.end('OK')
    })
  }

  private handleGetInbox(req: http.IncomingMessage, res: http.ServerResponse, url: URL): void {
    const accept = req.headers.accept || ''
    if (!accept.includes('text/turtle') && !accept.includes('*/*')) {
      res.writeHead(406)
      res.end('Not Acceptable')
      return
    }

    let body = `@prefix as: <https://www.w3.org/ns/activitystreams#>.
<http://localhost:${this.port}/inbox/> a as:OrderedCollection.`

    if (this.inboxFirst) {
      body += `\n  as:first <${this.inboxFirst}>.`
    }

    res.writeHead(200, { 'Content-Type': 'text/turtle' })
    res.end(body)
  }

  private handlePutPage(req: http.IncomingMessage, res: http.ServerResponse, pathname: string): void {
    const pageUrl = `http://localhost:${this.port}${pathname}`

    if (this.createdPages.has(pageUrl)) {
      res.writeHead(409)
      res.end('Already exists')
      return
    }

    this.createdPages.add(pageUrl)
    if (!this.inboxFirst) {
      this.inboxFirst = pageUrl
    }
    res.writeHead(201)
    res.end('Created')
  }

  private handlePatchPage(req: http.IncomingMessage, res: http.ServerResponse, pathname: string): void {
    const pageUrl = `http://localhost:${this.port}${pathname}`

    let body = ''
    req.on('data', chunk => { body += chunk })
    req.on('end', () => {
      if (!this.createdPages.has(pageUrl)) {
        res.writeHead(404)
        res.end('Page not found')
        return
      }

      this.patchedPages.push({ url: pageUrl, body })
      res.writeHead(200)
      res.end('OK')
    })
  }

  private handleGetPage(req: http.IncomingMessage, res: http.ServerResponse, pathname: string): void {
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

    const isFull = this.patchedPages.filter(p => p.url === pageUrl).length >= 5

    let body = `@prefix as: <https://www.w3.org/ns/activitystreams#>.
<${pageUrl}> a as:OrderedCollectionPage;
  as:partOf <http://localhost:${this.port}/inbox/>.`

    if (isFull) {
      body += '\n  as:next <http://localhost:${this.port}/inbox/pages/next>.'
    }

    res.writeHead(200, { 'Content-Type': 'text/turtle' })
    res.end(body)
  }

  private handleGetOutbox(req: http.IncomingMessage, res: http.ServerResponse, url: URL): void {
    const accept = req.headers.accept || ''
    if (!accept.includes('text/turtle') && !accept.includes('*/*')) {
      res.writeHead(406)
      res.end('Not Acceptable')
      return
    }

    let body = `@prefix as: <https://www.w3.org/ns/activitystreams#>.
<http://localhost:${this.port}/outbox/> a as:OrderedCollection.`

    if (this.outboxFirst) {
      body += `\n  as:first <${this.outboxFirst}>.`
    }

    res.writeHead(200, { 'Content-Type': 'text/turtle' })
    res.end(body)
  }

  private handlePutOutboxPage(req: http.IncomingMessage, res: http.ServerResponse, pathname: string): void {
    const pageUrl = `http://localhost:${this.port}${pathname}`

    if (this.createdPages.has(pageUrl)) {
      res.writeHead(409)
      res.end('Already exists')
      return
    }

    this.createdPages.add(pageUrl)
    if (!this.outboxFirst) {
      this.outboxFirst = pageUrl
    }
    res.writeHead(201)
    res.end('Created')
  }

  private handlePatchOutboxPage(req: http.IncomingMessage, res: http.ServerResponse, pathname: string): void {
    const pageUrl = `http://localhost:${this.port}${pathname}`

    let body = ''
    req.on('data', chunk => { body += chunk })
    req.on('end', () => {
      if (!this.createdPages.has(pageUrl)) {
        res.writeHead(404)
        res.end('Page not found')
        return
      }

      this.patchedOutboxPages.push({ url: pageUrl, body })
      res.writeHead(200)
      res.end('OK')
    })
  }

  private handleGetOutboxPage(req: http.IncomingMessage, res: http.ServerResponse, pathname: string): void {
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

    const isFull = this.patchedOutboxPages.filter(p => p.url === pageUrl).length >= 5

    let body = `@prefix as: <https://www.w3.org/ns/activitystreams#>.
<${pageUrl}> a as:OrderedCollectionPage;
  as:partOf <http://localhost:${this.port}/outbox/>.`

    if (isFull) {
      body += '\n  as:next <http://localhost:${this.port}/outbox/pages/next>.'
    }

    res.writeHead(200, { 'Content-Type': 'text/turtle' })
    res.end(body)
  }

  private handleHeadFollowers(req: http.IncomingMessage, res: http.ServerResponse): void {
    res.writeHead(200)
    res.end()
  }

  private handleGetFollowers(req: http.IncomingMessage, res: http.ServerResponse, url: URL): void {
    const accept = req.headers.accept || ''
    if (!accept.includes('text/turtle') && !accept.includes('*/*')) {
      res.writeHead(406)
      res.end('Not Acceptable')
      return
    }

    let body = `@prefix as: <https://www.w3.org/ns/activitystreams#>.
<http://localhost:${this.port}/followers/> a as:OrderedCollection.`

    if (this.followersFirst) {
      body += `\n  as:first <${this.followersFirst}>.`
    }

    res.writeHead(200, { 'Content-Type': 'text/turtle' })
    res.end(body)
  }

  private handlePutFollowersPage(req: http.IncomingMessage, res: http.ServerResponse, pathname: string): void {
    const pageUrl = `http://localhost:${this.port}${pathname}`

    if (this.createdPages.has(pageUrl)) {
      res.writeHead(409)
      res.end('Already exists')
      return
    }

    this.createdPages.add(pageUrl)
    if (!this.followersFirst) {
      this.followersFirst = pageUrl
    }
    res.writeHead(201)
    res.end('Created')
  }

  private handlePatchFollowersPage(req: http.IncomingMessage, res: http.ServerResponse, pathname: string): void {
    const pageUrl = `http://localhost:${this.port}${pathname}`

    let body = ''
    req.on('data', chunk => { body += chunk })
    req.on('end', () => {
      if (!this.createdPages.has(pageUrl)) {
        res.writeHead(404)
        res.end('Page not found')
        return
      }

      this.patchedFollowersPages.push({ url: pageUrl, body })
      res.writeHead(200)
      res.end('OK')
    })
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