# CatClaw

[English](README.md) | [简体中文](README.zh-CN.md)

CatClaw is a zero-setup local AI agent desktop powered by OpenClaw.

It packages a local OpenClaw runtime behind a desktop UI for chat, provider setup, skills management, workspace control, and diagnostics-friendly local operation.

## Why CatClaw

- Run a local AI agent desktop without manually wiring OpenClaw.
- Manage providers and local fallback models from a desktop UI.
- Keep agent runtime, chat sessions, and workspace state on the local machine.
- Package OpenClaw as a desktop product instead of a developer-only CLI workflow.

## Current Status

- App framework: Electron + React + TypeScript
- Runtime model: packaged OpenClaw sidecar + bundled Node.js runtime
- Primary focus: local desktop workflow and packaging
- Current test packaging path: macOS Apple Silicon

## Features

- Local OpenClaw runtime manager with start, stop, and restart controls
- Chat UI backed by the OpenClaw gateway
- Provider setup for OpenAI-compatible APIs, Anthropic, OpenRouter, and Ollama
- Skills browser and local skill management
- Workspace selection for local agent state
- Foundation for diagnostics and release packaging

## Download

Desktop builds should be distributed from GitHub Releases.

- Release artifacts do not belong in the Git repository tree.
- Unsigned macOS test builds may require a manual allow step in `Privacy & Security`.

## Build From Source

```bash
npm install
npm run bootstrap
npm run dev
```

For a local macOS test package:

```bash
npm run package:mac:test
```

## Runtime Packaging

CatClaw does not commit packaged runtime binaries to Git history.

- Runtime versions are pinned in `runtime-manifest.json`.
- `npm run bootstrap` downloads the required OpenClaw package and platform Node.js runtime.
- Generated runtime assets are written to `.catclaw-runtime/`.
- `electron-builder` packages `.catclaw-runtime/` into the final desktop app.

## Repository Structure

- `src/`: Electron main, preload, and renderer source
- `scripts/`: bootstrap and packaging helpers
- `docs/`: runbooks and implementation notes
- `resources/`: small repository assets only

## Roadmap

- Finish release-grade packaging for macOS and Windows
- Improve diagnostics, logs, and runtime observability
- Expand onboarding and local model setup guidance
- Harden release signing and notarization workflows

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## Security

See [SECURITY.md](SECURITY.md).

## License

MIT. See [LICENSE](LICENSE).
