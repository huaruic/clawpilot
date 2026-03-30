# ClawPilot Execution Plans

This plan is aligned with `docs/clawpilot_prd.md` and the latest constraints:
- Agent/session rules match OpenClaw Gateway (main agent id: `main`).
- Main workspace name: `workspace-default` (OpenClaw-aligned).
- Token/Cost uses session JSONL parsing first (ClawX approach).
- Multi-agent + multi-channel is Phase 1.
- System migration only copies config + skills for large installs.

---

## Phase 0 (Baseline Stabilization)
Goal: keep runtime + basic chat + provider/skills/channel (Feishu) stable.

Deliverables:
- Runtime start/stop/restart + health check stability.
- Basic chat send/history + streaming text.
- Provider CRUD + default model + Ollama status.
- Skills list + enable/disable + delete.
- Feishu basic config + pairing.

---

## Phase 1 (Core Capability Expansion)
Goal: ship multi-agent + multi-channel + diagnostics/logs + stronger chat state.

### Epic A: Runtime / Lifecycle
- A1: Heartbeat + health + error classification (ClawX-inspired)
- A2: Restart governance (debounce + suppression)
- A3: Expose last-failure reason to UI

### Epic B: Chat / State Machine
- B1: sending/streaming/completed/error/aborted state model
- B2: event dedupe + history fallback polling
- B3: tool call / tool result / system / error rendering

### Epic C: Provider / Account
- C1: Account abstraction (openclaw.json as source of truth)
- C2: API key + OAuth sync to auth-profiles.json
- C3: Default model consistency + provider metadata sync

### Epic D: Skills
- D1: Keep local scan + SKILL.md parsing
- D2: Install/update/remove workflow
- D3: Source tags (bundled/managed/workspace/extra)

### Epic E: Channels (multi-channel + multi-account)
- E1: Unified channel config + account model
- E2: Bind channel/account -> agent
- E3: Channels first batch: Telegram / Discord / Slack / WhatsApp / WebChat / DingTalk / WeCom / QQ

### Epic F: Multi-Agent
- F1: Agent list/create/delete
- F2: Agent workspace management (fixed path in ClawPilot userData)
- F3: Agent default model + persona files
- F4: Agent create flow with two modes:
  - Inherit main agent bootstrap
  - OpenClaw auto-generate default files

### Epic G: Diagnostics / Logs
- G1: OpenClaw doctor (diagnose + fix) integration ✅
- G2: Logs API + UI viewer + export bundle ✅

### Epic H: Token / Cost Dashboard
- H1: Parse session JSONL usage + cost ✅
- H2: Aggregate by model + time window ✅

### Epic I: Workspace / Migration
- I1: Remove manual workspace browsing/setting ✅
- I2: Fixed workspace naming (main = workspace-default) ✅
- I3: Migration from ~/.openclaw (config + skills only if large) ✅

### Epic J: UX / Config Entry Points
- J1: Config directory display + copy + open folder ✅
- J2: Add same entry to Status + Settings ✅

---

## Phase 2 (Enhancements)
Goal: polish + extend once Phase 1 is stable.

- Skills marketplace integration (ClawHub or other)
- Memory + Logs + Diagnostics cross-linking
- More channel orchestration features
- Persona templates library expansion
- More detailed usage/cost analytics

---

## Phase 3 (Advanced)
Goal: advanced isolation + platform expansions.

- Sandbox integration (Docker-based)
- Marketplace deep integration
- Advanced multi-agent orchestration

---

## Worktree Strategy (Parallel Development)
Independent modules can be built in parallel with separate worktrees/branches.

Suggested worktrees:
- worktree/runtime-lifecycle
- worktree/chat-state
- worktree/provider-account
- worktree/channels-multi
- worktree/agents-multi
- worktree/diagnostics-logs
- worktree/token-cost
- worktree/skills
- worktree/migration
- worktree/ux-config-entry

---

## Notes / Constraints
- OpenClaw data path = `ClawPilot userData/openclaw` (not ~/.openclaw).
- Main agent id: `main`.
- Main workspace name: `workspace-default`.
- No arbitrary workspace path selection by user.
- Migration: config + skills only when large.
- macOS first, Windows compatibility considered in all code paths.
