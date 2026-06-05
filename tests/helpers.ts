import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { spawn } from 'child_process'

export const __filename = fileURLToPath(import.meta.url)
export const __dirname = path.dirname(__filename)
export const rootDir = path.resolve(__dirname, '..')
export const publicDir = path.join(rootDir, 'public')
export const baseUrlPath = path.join(rootDir, 'src/base-url.ts')
export const privateKeyPath = path.join(rootDir, 'src/private-key.ts')
export const actorPrivateKeyPath = path.join(rootDir, 'src/actor-private-key.ts')

export async function runScript(jwks?: string, context?: string): Promise<{ exitCode: number, stdout: string, stderr: string }> {
  return new Promise((resolve) => {
    const env: Record<string, string | undefined> = {
      ...process.env,
    }
    if (context === 'production') {
      env.CONTEXT = 'production'
      env.URL = 'https://example.com'
      delete env.DEPLOY_URL
    } else if (context === 'deploy-preview') {
      env.CONTEXT = 'deploy-preview'
      env.DEPLOY_URL = 'https://deploy-preview-123.netlify.app'
      delete env.URL
    } else {
      env.CONTEXT = 'dev'
      env.URL = 'http://localhost:9999'
      delete env.DEPLOY_URL
    }
    if (jwks) {
      env.JWKS = jwks
    }

    if (fs.existsSync(baseUrlPath)) {
      fs.unlinkSync(baseUrlPath)
    }

    const child = spawn('node', [path.join(__dirname, '../scripts/generate-identity.ts')], {
      env,
      stdio: 'pipe',
    })

    let stdout = ''
    let stderr = ''
    child.stdout?.on('data', (data) => { stdout += data.toString() })
    child.stderr?.on('data', (data) => { stderr += data.toString() })
    child.on('close', (exitCode) => {
      resolve({ exitCode: exitCode ?? 0, stdout, stderr })
    })
  })
}
