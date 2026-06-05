import { beforeAll, afterAll } from 'vitest'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { startDevServer, stopDevServer } from './dev-server.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const rootDir = path.resolve(__dirname, '../..')

function cleanup() {
  const actorPrivateKeyPath = path.join(rootDir, 'src/actor-private-key.ts')
  if (fs.existsSync(actorPrivateKeyPath)) {
    fs.unlinkSync(actorPrivateKeyPath)
  }
}

beforeAll(async () => {
  await startDevServer()
}, 60000)

afterAll(async () => {
  stopDevServer()
  cleanup()
})
