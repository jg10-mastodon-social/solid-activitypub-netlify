import http from 'http'

const DEFAULT_PORT = 9997

let server: http.Server | null = null
let port = DEFAULT_PORT
const actors = new Map<string, Record<string, unknown>>()
interface ReceivedDelivery {
  path: string
  body: string
  headers: http.IncomingHttpHeaders
}

const receivedInboxes: ReceivedDelivery[] = []

export function remoteActorBaseUrl(): string {
  return `http://localhost:${port}`
}

export function remoteActorUrl(name: string): string {
  return `${remoteActorBaseUrl()}/${name}`
}

export function setRemoteActor(pathname: string, doc: Record<string, unknown>): void {
  actors.set(pathname.startsWith('/') ? pathname : `/${pathname}`, doc)
}

export function clearRemoteActors(): void {
  actors.clear()
  receivedInboxes.length = 0
}

export function getRemoteInboxActivities(): ReceivedDelivery[] {
  return [...receivedInboxes]
}

export async function startRemoteActorServer(serverPort = DEFAULT_PORT): Promise<void> {
  port = serverPort
  if (server) return

  await new Promise<void>((resolve, reject) => {
    server = http.createServer((req, res) => {
      const url = new URL(req.url ?? '/', `http://localhost:${port}`)
      const doc = actors.get(url.pathname)

      if (req.method === 'GET' && doc) {
        res.writeHead(200, { 'Content-Type': 'application/activity+json' })
        res.end(JSON.stringify(doc))
        return
      }

      if (req.method === 'POST' && url.pathname.endsWith('/inbox')) {
        let body = ''
        req.on('data', (chunk) => { body += chunk })
        req.on('end', () => {
          receivedInboxes.push({ path: url.pathname, body, headers: req.headers })
          res.writeHead(200)
          res.end('OK')
        })
        return
      }

      res.writeHead(404)
      res.end('Not Found')
    })
    server.on('error', reject)
    server.listen(port, () => resolve())
  })
}

export function stopRemoteActorServer(): void {
  if (server) {
    server.close()
    server = null
  }
  actors.clear()
}
