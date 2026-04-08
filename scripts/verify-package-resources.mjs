#!/usr/bin/env node

/**
 * Pre-package resource verification.
 * Ensures all required files exist before electron-builder runs.
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')

const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf-8'))
const extraResources = pkg.build?.extraResources ?? []

const errors = []

// 1. Verify extraResources source files
for (const entry of extraResources) {
  const from = typeof entry === 'string' ? entry : entry.from
  // Skip entries with ${os} placeholder — they're platform-specific and may not all exist
  if (from.includes('${os}')) continue

  const resolved = path.resolve(ROOT, from)
  if (!fs.existsSync(resolved)) {
    errors.push(`extraResources missing: ${from} (expected at ${resolved})`)
  }
}

// 2. Verify macOS icon (electron-builder looks for build/icon.icns)
if (process.platform === 'darwin') {
  const icns = path.join(ROOT, 'build', 'icon.icns')
  if (!fs.existsSync(icns)) {
    errors.push(`macOS icon missing: build/icon.icns`)
  }
}

// 3. Verify app icon PNG (used by dock and BrowserWindow)
const iconPng = path.join(ROOT, 'build', 'icon.png')
if (!fs.existsSync(iconPng)) {
  errors.push(`App icon missing: build/icon.png`)
}

if (errors.length > 0) {
  console.error('\n  Pre-package verification FAILED:\n')
  for (const e of errors) {
    console.error(`    - ${e}`)
  }
  console.error()
  process.exit(1)
}

console.log('  Pre-package verification passed.')
