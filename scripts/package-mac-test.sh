#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

VERSION="$(node -p "require('./package.json').version")"
APP_DIR="dist/mac-arm64/ClawPilot.app"
DMG_PATH="dist/ClawPilot-${VERSION}-arm64-test.dmg"
TMP_DMG="/tmp/ClawPilot-${VERSION}-arm64-test-tmp.dmg"

if [[ ! -d "$APP_DIR" ]]; then
  echo "Expected app bundle not found at $APP_DIR"
  echo "Run electron-builder with the dir target before packaging the test build."
  exit 1
fi

rm -f "$DMG_PATH" "$TMP_DMG"

echo "Applying ad-hoc signature to test app bundle..."
codesign --force --deep --sign - "$APP_DIR"

echo "Verifying ad-hoc signature..."
codesign --verify --deep --strict --verbose=2 "$APP_DIR"

echo "Creating DMG test build..."
hdiutil create \
  -srcfolder "$APP_DIR" \
  -volname "ClawPilot ${VERSION}-arm64" \
  -anyowners \
  -nospotlight \
  -format UDRW \
  -fs APFS \
  "$TMP_DMG"

mv "$TMP_DMG" "$DMG_PATH"
echo "DMG created: $DMG_PATH"
