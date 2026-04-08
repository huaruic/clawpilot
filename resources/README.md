# Resources

This directory is now limited to small repository assets.

## What lives here

- `openclaw.sb`: a macOS sandbox profile draft kept for reference. It is not part of the current runtime startup path.

## Runtime assets

CatClaw no longer commits bundled OpenClaw or Node runtime binaries to the repository.

- Run `npm run bootstrap` to download the pinned runtime assets.
- Bootstrap output is written to `.catclaw-runtime/`.
- `electron-builder` packages `.catclaw-runtime/` into release builds.
