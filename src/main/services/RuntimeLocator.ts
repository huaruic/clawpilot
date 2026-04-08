import { app } from 'electron'
import path from 'node:path'
import fs from 'node:fs'
import { execSync } from 'node:child_process'

/**
 * When packaged: extraResources land directly in process.resourcesPath/
 * When dev: bootstrap writes runtimes into project root /.catclaw-runtime/
 */
function getResourcesBase(): string {
  if (app.isPackaged) {
    return process.resourcesPath
  }
  // Dev mode: __dirname is out/main/, so go 2 levels up to project root
  return path.join(__dirname, '../../.catclaw-runtime')
}

export function getOpenClawResourcesPath(): string {
  return getResourcesBase()
}

export function getBundledNodePath(): string {
  const base = getResourcesBase()
  const platformDir = process.platform === 'win32' ? 'win' : process.platform === 'darwin' ? 'mac' : 'linux'
  const nodeBin = process.platform === 'win32' ? 'node.exe' : 'node'
  const vendoredNode = path.join(base, 'runtime', platformDir, nodeBin)
  if (fs.existsSync(vendoredNode)) return vendoredNode
  const sharedVendoredNode = path.join(base, 'runtime', nodeBin)
  if (fs.existsSync(sharedVendoredNode)) return sharedVendoredNode

  if (app.isPackaged) {
    throw new Error(`Missing bundled Node runtime at ${vendoredNode}`)
  }

  // Dev mode: last-resort fallback to PATH if bootstrap has not prepared a local runtime yet.
  try {
    const which = process.platform === 'win32' ? 'where node' : 'which node'
    const nodePath = execSync(which, { encoding: 'utf-8' }).trim().split('\n')[0]
    if (nodePath && fs.existsSync(nodePath)) return nodePath
  } catch {
    // fall through
  }
  return 'node' // last resort: rely on PATH
}

export function getOpenClawEntryPath(): string {
  const entryPath = path.join(getResourcesBase(), 'openclaw', 'openclaw.mjs')
  if (fs.existsSync(entryPath)) {
    return entryPath
  }
  throw new Error(`Missing vendored OpenClaw runtime at ${entryPath}`)
}

export function getBundledOpenClawSkillsDir(): string {
  const skillsDir = path.join(getResourcesBase(), 'openclaw', 'skills')
  if (fs.existsSync(skillsDir)) {
    return skillsDir
  }
  throw new Error(`Missing vendored OpenClaw skills directory at ${skillsDir}`)
}

export function getOpenClawStateDir(): string {
  return path.join(app.getPath('userData'), 'openclaw')
}

export function getDefaultOpenClawWorkspaceRoot(): string {
  return path.join(getOpenClawStateDir(), 'workspace-default')
}

export function getOpenClawWorkspaceRoot(name = 'workspace-default'): string {
  return name === 'workspace-default'
    ? getDefaultOpenClawWorkspaceRoot()
    : path.join(getOpenClawStateDir(), name)
}

export function getCatClawDataDir(): string {
  return path.join(app.getPath('userData'), 'catclaw')
}

/**
 * Resolve a project-relative resource path that works in both dev and packaged mode.
 *
 * In dev mode `__dirname` is `out/main/`, so `../..` reaches the project root.
 * In packaged mode `extraResources` copies files into `process.resourcesPath`
 * with the same relative structure (e.g. `resources/trayTemplate.png`).
 */
export function getAppResourcePath(relativePath: string): string {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, relativePath)
  }
  return path.join(__dirname, '../..', relativePath)
}
