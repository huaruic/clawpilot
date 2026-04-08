#!/usr/bin/env node

import {
  chmodSync,
  copyFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..')
const manifestPath = path.join(rootDir, 'runtime-manifest.json')
const runtimeRoot = path.join(rootDir, '.catclaw-runtime')
const runtimeManifestOut = path.join(runtimeRoot, 'manifest.json')

const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'))
const openclawPackage = process.env.OPENCLAW_PACKAGE ?? manifest.openclaw.package
const openclawVersion = process.env.OPENCLAW_VERSION ?? manifest.openclaw.version
const nodeVersion = process.env.CATCLAW_NODE_VERSION ?? manifest.node.version
const force = process.argv.includes('--force')

const platformInfo = resolvePlatform(process.platform, process.arch)
const nodeOutDir = path.join(runtimeRoot, 'runtime', platformInfo.platformDir)
const nodeBinaryName = platformInfo.nodeBinaryName
const nodeBinaryOut = path.join(nodeOutDir, nodeBinaryName)
const openclawOutDir = path.join(runtimeRoot, 'openclaw')

async function main() {
  mkdirSync(runtimeRoot, { recursive: true })

  const current = readExistingRuntimeManifest()
  const canReuse = !force
    && current?.openclaw?.version === openclawVersion
    && current?.node?.version === nodeVersion
    && existsSync(path.join(openclawOutDir, 'openclaw.mjs'))
    && existsSync(nodeBinaryOut)

  if (canReuse) {
    console.log(`Runtime already prepared in ${runtimeRoot}`)
    return
  }

  const tempDir = mkdtempSync(path.join(os.tmpdir(), 'catclaw-runtime-'))
  try {
    console.log(`Preparing OpenClaw ${openclawVersion}`)
    bootstrapOpenClaw(tempDir)

    console.log(`Preparing Node.js ${nodeVersion} for ${platformInfo.nodePlatform}-${platformInfo.nodeArch}`)
    await bootstrapNode(tempDir)

    writeFileSync(
      runtimeManifestOut,
      JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          openclaw: { package: openclawPackage, version: openclawVersion },
          node: { version: nodeVersion, platform: platformInfo.nodePlatform, arch: platformInfo.nodeArch },
        },
        null,
        2,
      ),
      'utf-8',
    )

    console.log(`Runtime ready: ${runtimeRoot}`)
  } finally {
    rmSync(tempDir, { recursive: true, force: true })
  }
}

function readExistingRuntimeManifest() {
  if (!existsSync(runtimeManifestOut)) return null
  try {
    return JSON.parse(readFileSync(runtimeManifestOut, 'utf-8'))
  } catch {
    return null
  }
}

function bootstrapOpenClaw(tempDir) {
  const npmPackDir = path.join(tempDir, 'npm-pack')
  mkdirSync(npmPackDir, { recursive: true })

  execFileSync('npm', ['pack', `${openclawPackage}@${openclawVersion}`], {
    cwd: npmPackDir,
    stdio: 'inherit',
  })

  const tarballName = `${openclawPackage}-${openclawVersion}.tgz`
  execFileSync('tar', ['-xzf', tarballName], {
    cwd: npmPackDir,
    stdio: 'inherit',
  })

  const packageDir = path.join(npmPackDir, 'package')
  execFileSync('npm', ['install', '--omit=dev', '--no-fund', '--no-audit'], {
    cwd: packageDir,
    stdio: 'inherit',
  })

  rmSync(openclawOutDir, { recursive: true, force: true })
  cpSync(packageDir, openclawOutDir, { recursive: true })

  // OpenClaw inlines extension code into dist/*.js but leaves their npm
  // dependencies under dist/extensions/<name>/node_modules/.  Node resolves
  // imports from dist/ upward, so it never looks inside individual extension
  // dirs.  Fix: hoist every extension's node_modules into dist/node_modules/
  // so the inlined imports resolve correctly in both dev and packaged mode.
  hoistExtensionNodeModules(path.join(openclawOutDir, 'dist'))
}

async function bootstrapNode(tempDir) {
  mkdirSync(nodeOutDir, { recursive: true })

  const archiveName = buildNodeArchiveName(nodeVersion, platformInfo)
  const archivePath = path.join(tempDir, archiveName)
  const archiveUrl = `${process.env.CATCLAW_NODE_DIST_BASE_URL ?? 'https://nodejs.org/dist'}/v${nodeVersion}/${archiveName}`

  await downloadFile(archiveUrl, archivePath)

  const extractDir = path.join(tempDir, 'node-extract')
  mkdirSync(extractDir, { recursive: true })

  if (archiveName.endsWith('.zip')) {
    execFileSync('unzip', ['-q', archivePath, '-d', extractDir], { stdio: 'inherit' })
  } else {
    execFileSync('tar', ['-xzf', archivePath, '-C', extractDir], { stdio: 'inherit' })
  }

  const unpackedRoot = path.join(extractDir, archiveName.replace(/\.tar\.gz$|\.zip$/u, ''))
  const nodeSource = platformInfo.nodePlatform === 'win'
    ? path.join(unpackedRoot, 'node.exe')
    : path.join(unpackedRoot, 'bin', 'node')

  copyFileSync(nodeSource, nodeBinaryOut)
  if (platformInfo.nodePlatform !== 'win') {
    chmodSync(nodeBinaryOut, 0o755)
  }
}

function resolvePlatform(platform, arch) {
  if (!['darwin', 'linux', 'win32'].includes(platform)) {
    throw new Error(`Unsupported platform: ${platform}`)
  }
  if (!['arm64', 'x64'].includes(arch)) {
    throw new Error(`Unsupported arch: ${arch}`)
  }

  return {
    platformDir: platform === 'win32' ? 'win' : platform,
    nodePlatform: platform === 'win32' ? 'win' : platform,
    nodeArch: arch,
    nodeBinaryName: platform === 'win32' ? 'node.exe' : 'node',
  }
}

function buildNodeArchiveName(version, info) {
  const ext = info.nodePlatform === 'win' ? 'zip' : 'tar.gz'
  return `node-v${version}-${info.nodePlatform}-${info.nodeArch}.${ext}`
}

async function downloadFile(url, destPath) {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Failed to download ${url}: HTTP ${response.status}`)
  }
  const bytes = Buffer.from(await response.arrayBuffer())
  writeFileSync(destPath, bytes)
}

function hoistExtensionNodeModules(distDir) {
  const extRoot = path.join(distDir, 'extensions')
  if (!existsSync(extRoot)) return

  const hoistedDir = path.join(distDir, 'node_modules')
  let hoisted = 0

  for (const extName of readdirSync(extRoot)) {
    const extNM = path.join(extRoot, extName, 'node_modules')
    if (!existsSync(extNM)) continue

    for (const pkg of readdirSync(extNM)) {
      // Skip .package-lock.json and similar dotfiles
      if (pkg.startsWith('.')) continue

      const src = path.join(extNM, pkg)
      const dest = path.join(hoistedDir, pkg)

      // Scoped packages (e.g. @larksuiteoapi)
      if (pkg.startsWith('@')) {
        mkdirSync(dest, { recursive: true })
        for (const sub of readdirSync(src)) {
          const subSrc = path.join(src, sub)
          const subDest = path.join(dest, sub)
          if (!existsSync(subDest)) {
            cpSync(subSrc, subDest, { recursive: true })
            hoisted++
          }
        }
      } else if (!existsSync(dest)) {
        cpSync(src, dest, { recursive: true })
        hoisted++
      }
    }
  }

  if (hoisted > 0) {
    console.log(`Hoisted ${hoisted} extension dependencies into dist/node_modules/`)
  }
}

await main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
