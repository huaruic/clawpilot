import { spawn } from 'node:child_process'
import {
  getBundledNodePath,
  getOpenClawEntryPath,
  getOpenClawStateDir,
} from './RuntimeLocator'

export interface OpenClawCliResult {
  code: number
  stdout: string
  stderr: string
}

export async function runOpenClawCli(args: string[], timeoutMs = 15000): Promise<OpenClawCliResult> {
  const nodePath = getBundledNodePath()
  const entryPath = getOpenClawEntryPath()
  const spawnArgs = buildSpawnArgs(nodePath, entryPath, args)

  return await new Promise<OpenClawCliResult>((resolve, reject) => {
    const child = spawn(spawnArgs[0], spawnArgs.slice(1), {
      env: {
        ...process.env,
        OPENCLAW_STATE_DIR: getOpenClawStateDir(),
        OPENCLAW_NO_RESPAWN: '1',
        OPENCLAW_NODE_OPTIONS_READY: '1',
        NO_COLOR: '1',
        FORCE_COLOR: undefined,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: false,
    })

    let stdout = ''
    let stderr = ''
    let settled = false

    const timer = setTimeout(() => {
      if (settled) return
      settled = true
      child.kill('SIGKILL')
      reject(new Error(`OpenClaw CLI timed out after ${timeoutMs}ms: ${args.join(' ')}`))
    }, timeoutMs)

    child.stdout?.on('data', (chunk: Buffer) => {
      stdout += chunk.toString()
    })
    child.stderr?.on('data', (chunk: Buffer) => {
      stderr += chunk.toString()
    })

    child.on('error', (err) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      reject(err)
    })

    child.on('exit', (code) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      resolve({
        code: code ?? 1,
        stdout: stdout.trim(),
        stderr: stderr.trim(),
      })
    })
  })
}

function buildSpawnArgs(nodePath: string, entryPath: string, args: string[]): string[] {
  return [nodePath, entryPath, ...args]
}
