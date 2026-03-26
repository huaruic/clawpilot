# Contributing

Thanks for contributing to ClawPilot.

## Development Flow

```bash
npm install
npm run bootstrap
npm run dev
```

## Before Opening A PR

Run the checks below from the repository root:

```bash
npm run typecheck
npm run build
```

If your change affects packaging or runtime integration, also verify:

```bash
npm run package:mac:test
```

## Runtime Assets

ClawPilot does not commit packaged runtime binaries to Git history.

- `npm run bootstrap` downloads the pinned OpenClaw package and platform Node runtime.
- Generated assets are written to `.clawpilot-runtime/`.
- Release artifacts belong in GitHub Releases, not in the repository tree.

## Pull Request Guidelines

- Keep changes scoped and explain user impact.
- Update `README.md` and `README.zh-CN.md` together when public behavior changes.
- If you update OpenClaw or the bundled Node version, also update `runtime-manifest.json`.

