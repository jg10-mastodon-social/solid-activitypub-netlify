import { beforeAll, afterAll } from 'vitest'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { startDevServer, stopDevServer } from './dev-server.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const rootDir = path.resolve(__dirname, '../..')

function cleanup() {
  // Reset generated files so subsequent test runs (and unit tests run after this suite)
  // don't see stale values from the dev-server's generate-identity invocation.
  const baseUrlPath = path.join(rootDir, 'src/base-url.ts')
  if (fs.existsSync(baseUrlPath)) {
    fs.writeFileSync(baseUrlPath, `export const baseUrl = 'https://example.com'\n`)
  }
  const privateKeyPath = path.join(rootDir, 'src/private-key.ts')
  if (fs.existsSync(privateKeyPath)) {
    fs.unlinkSync(privateKeyPath)
  }
  const actorKeysPath = path.join(rootDir, 'src/actor-keys.ts')
  if (fs.existsSync(actorKeysPath)) {
    fs.unlinkSync(actorKeysPath)
  }
  const webfingerDataPath = path.join(rootDir, 'src/webfinger-data.ts')
  if (fs.existsSync(webfingerDataPath)) {
    fs.unlinkSync(webfingerDataPath)
  }
}

beforeAll(async () => {
  await startDevServer()
}, 60000)

afterAll(async () => {
  stopDevServer()
  cleanup()
})
