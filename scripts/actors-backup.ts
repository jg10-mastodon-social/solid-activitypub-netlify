import { execFile } from 'node:child_process'
import { readFile, writeFile } from 'node:fs/promises'
import { runActorsBackup, type BackupRunner, type BackupIO } from '../src/actors/backup.js'

function runNetlify(args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile('netlify', args, { maxBuffer: 64 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(`netlify ${args.join(' ')} failed: ${stderr.trim() || error.message}`))
        return
      }
      resolve(stdout)
    })
  })
}

const runner: BackupRunner = {
  async get(store, key) {
    return runNetlify(['blobs:get', store, key])
  },
  async set(store, key, value) {
    await runNetlify(['blobs:set', store, key, value])
  }
}

const io: BackupIO = {
  readFile: (path) => readFile(path, 'utf-8'),
  writeFile: (path, data) => writeFile(path, data, 'utf-8')
}

runActorsBackup(process.argv.slice(2), runner, io)
  .then((message) => {
    console.log(message)
  })
  .catch((error) => {
    console.error((error as Error).message)
    process.exitCode = 1
  })
