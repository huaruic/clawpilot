# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What Is This

CatClaw is a privacy-first local AI agent desktop app built with Electron + React. It wraps OpenClaw (a CLI-based AI orchestration engine) in a GUI, providing multi-LLM provider management, multi-channel messaging (WeChat, Feishu, Telegram, DingTalk), skill/plugin management, and chat streaming — all running locally without cloud dependencies.

## Commands

```bash
npm install                  # Install dependencies
npm run bootstrap            # Download OpenClaw & Node.js runtime into .catclaw-runtime/
npm run dev                  # Start Electron app with HMR (runs bootstrap first)
npm run build                # Build main + preload + renderer bundles to out/
npm run typecheck            # TypeScript check (tsc --noEmit)
npm test                     # Run Vitest once (src/main/__tests__/)
npm run test:watch           # Run Vitest in watch mode
npm run package:mac          # Build + package macOS DMG
npm run package:mac:test     # Build unsigned macOS app + smoke test
npm run package:win          # Build + package Windows NSIS installer
```

## Architecture

Dual-process Electron app with three compilation targets:

- **Main process** (`src/main/`, compiled via `tsconfig.node.json`) — App lifecycle, IPC handlers, services, OpenClaw process supervision, secure storage. Path alias: `@main/*`
- **Preload** (`src/preload/`, compiled via `tsconfig.node.json`) — Context-isolated IPC bridge exposing `window.catclaw` API
- **Renderer** (`src/renderer/`, compiled via `tsconfig.web.json`) — React 19 UI with Zustand stores, Tailwind CSS 4, shadcn/ui components. Path alias: `@renderer/*`
- **Shared** (`src/shared/`) — Types and provider registry used by both processes

Build tool: `electron-vite` (Vite-based). Config: `electron.vite.config.ts`. Output: `out/{main,preload,renderer}/`.

### IPC Pattern

Renderer → preload bridge → main process handlers. Channels are organized by domain (`app.*`, `chat.*`, `provider.*`, `channels.*`, `routing.*`, `skills.*`, `dashboard.*`, `diagnostics.*`). IPC handlers live in `src/main/ipc/` with Zod schemas in `src/main/ipc/schemas/`.

### OpenClaw Runtime Integration

`OpenClawProcessManager` spawns OpenClaw as a child process. `WsGatewayClient` connects via WebSocket on localhost. `OpenClawConfigWriter` generates config files. Runtime binaries are downloaded by `scripts/bootstrap-runtime.mjs` and pinned in `runtime-manifest.json`.

### State Management

- Main process: `src/main/state/RuntimeState.ts` — singleton runtime state snapshot (IDLE → STARTING → RUNNING → STOPPING)
- Renderer: Zustand stores in `src/renderer/src/stores/` — `chatStore`, `providerStore`, `runtimeStore`, `routingStore`

## Testing

Vitest with Node environment. Tests are in `src/main/__tests__/`. Test config: `vitest.config.ts`. Tests cover IPC schemas, services (provider, channel, routing), app lifecycle, process management, and state transitions. No coverage threshold enforced — favor targeted tests around lifecycle, IPC, and state changes.

## Code Style

TypeScript with single quotes, no semicolons, 2-space indent. React components and classes in PascalCase, hooks as `useX`, service files in PascalCase. IPC schemas live alongside their channels in `src/main/ipc/schemas/`.

## Sub-projects

- `clawx-explorer/` — Prototype explorer dashboard (separate Vite + React app with its own CLAUDE.md, ESLint, and Vitest config using double quotes and semicolons)
- `catclaw-landing/` — Marketing landing page (separate Vite + React app with its own CLAUDE.md)

These have independent configs and code styles — preserve each project's conventions.
