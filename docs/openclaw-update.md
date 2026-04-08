# OpenClaw Update Runbook

This document defines the fixed process for updating the OpenClaw runtime packaged by CatClaw.

## Goal

Keep these three things aligned:

- the pinned runtime versions in `runtime-manifest.json`
- the provider presets and model lists exposed in CatClaw
- the packaged app contents staged by `npm run bootstrap`

Do not update OpenClaw by manually copying local build output into the repository.

## Source Of Truth

CatClaw pins runtime inputs in:

- `runtime-manifest.json`

Bootstrap downloads runtime assets into:

- `.catclaw-runtime/openclaw`
- `.catclaw-runtime/runtime/<platform>`

The downloaded OpenClaw build metadata is recorded in:

- `.catclaw-runtime/openclaw/dist/build-info.json`

## When To Update

Update OpenClaw when any of the following is true:

- a newer OpenClaw release fixes runtime, auth, session, tool, or security issues
- provider docs changed and CatClaw presets drifted from OpenClaw
- CatClaw needs a newer gateway or session protocol
- packaging needs a newer runtime layout

## Fixed Update Procedure

### 1. Update pinned versions

Edit `runtime-manifest.json` and record:

- target OpenClaw package version
- target Node.js version
- release notes or upstream changelog links

### 2. Refresh bootstrap assets

Run:

```bash
npm run bootstrap -- --force
```

After bootstrap completes, verify:

```bash
cat .catclaw-runtime/openclaw/dist/build-info.json
cat .catclaw-runtime/manifest.json
```

### 3. Sync CatClaw provider presets

Check whether OpenClaw provider docs changed model IDs, provider names, or base URLs.

Current preset location:

- `src/renderer/src/pages/ProvidersPage.tsx`

At minimum, verify:

- provider id matches OpenClaw docs
- base URL matches the intended region
- default model names and IDs are current

### 4. Verify runtime integration assumptions

Re-check these files after every OpenClaw update:

- `src/main/services/WsGatewayClient.ts`
- `src/main/ipc/chat.ipc.ts`
- `src/main/services/OpenClawConfigWriter.ts`
- `src/main/services/OpenClawAuthProfileWriter.ts`

Look for drift in:

- WebSocket handshake requirements
- gateway RPC method names
- event stream names and payload shape
- auth-profiles format
- workspace config semantics

### 5. Run local verification

Always run:

```bash
npm run typecheck
npm run build
```

Then verify the app manually:

1. Start CatClaw.
2. Confirm OpenClaw boots successfully.
3. Open Chat and send a message.
4. Confirm streaming still works.
5. Confirm session history still loads.
6. Save a provider and confirm chat auth still works.
7. If using a custom workspace, switch workspace and confirm bootstrap files are read from the new path.
8. If using Ollama, confirm local model detection still works.

### 6. Validate packaging inputs

CatClaw packaging expects bootstrap assets to exist before release builds.

Check:

- `package.json`
- `.catclaw-runtime/openclaw`
- `.catclaw-runtime/runtime/${os}`

Do not ship a release where dev mode works only because of global CLI state.

### 7. Record the upgrade

For every update, record this in the PR description or release notes:

- previous OpenClaw version
- new OpenClaw version
- previous Node.js version
- new Node.js version
- docs or release notes URL
- whether provider presets changed
- whether chat/event/auth integration code changed

## Required Regression Checklist

Before merging an OpenClaw update, all items below must be true:

- `.catclaw-runtime/openclaw/dist/build-info.json` matches the intended OpenClaw version
- Chat can send and stream replies
- session list and history still work
- provider save still syncs to OpenClaw auth
- bootstrap/onboarding still works
- workspace switching still works
- `npm run typecheck` passes
- `npm run build` passes

## Notes

- CatClaw should follow OpenClaw protocol and provider metadata, not maintain a divergent runtime model.
- If OpenClaw introduces a breaking protocol change, update the CatClaw adapter layer instead of embedding the OpenClaw web UI again.
