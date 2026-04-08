import fs from 'node:fs'
import path from 'node:path'
import { app } from 'electron'

let logStream: fs.WriteStream | null = null

function getLogPath(): string {
  return path.join(app.getPath('userData'), 'catclaw', 'main.log')
}

function getStream(): fs.WriteStream {
  if (!logStream) {
    const logPath = getLogPath()
    fs.mkdirSync(path.dirname(logPath), { recursive: true })
    logStream = fs.createWriteStream(logPath, { flags: 'a' })
  }
  return logStream
}

function format(level: string, args: unknown[]): string {
  const ts = new Date().toISOString()
  const msg = args
    .map((a) => (typeof a === 'string' ? a : JSON.stringify(a)))
    .join(' ')
  return `[${ts}] [${level}] ${msg}\n`
}

export const mainLogger = {
  info: (...args: unknown[]) => {
    const line = format('INFO', args)
    process.stdout.write(line)
    getStream().write(line)
  },
  warn: (...args: unknown[]) => {
    const line = format('WARN', args)
    process.stderr.write(line)
    getStream().write(line)
  },
  error: (...args: unknown[]) => {
    const line = format('ERROR', args)
    process.stderr.write(line)
    getStream().write(line)
  },
}
