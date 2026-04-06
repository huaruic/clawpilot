/**
 * RoutingService — manages RoutingProfiles and ChannelRoutes.
 *
 * A RoutingProfile connects a Channel to a Provider/Model.
 * This service owns the `routing` block in openclaw.json and
 * translates it into Gateway-native `agents.list` + `bindings`.
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import {
  readRoutingConfig,
  writeRoutingConfig,
  syncRoutingToGatewayFormat,
  readDefaultModel,
} from './OpenClawConfigWriter'
import { getOpenClawStateDir, getDefaultOpenClawWorkspaceRoot } from './RuntimeLocator'
import type {
  RoutingProfile,
  ChannelRoute,
  RoutingSnapshot,
  CreateProfileInput,
  UpdateProfileInput,
} from '../../shared/types/routing'
import { syncAllProvidersToRuntime } from './ProviderRuntimeSync'
import { mainLogger } from '../utils/logger'

const DEFAULT_PROFILE_ID = 'default'
const DEFAULT_PROFILE_NAME = 'Default'

const BOOTSTRAP_FILES = [
  'AGENTS.md',
  'SOUL.md',
  'TOOLS.md',
  'USER.md',
  'IDENTITY.md',
  'HEARTBEAT.md',
  'BOOT.md',
]

const RUNTIME_FILES = [
  'auth-profiles.json',
  'models.json',
]

// ── Helpers ───────────────────────────────────────────────────────

function slugify(name: string): string {
  const normalized = name
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .toLowerCase()
    .replace(/[_\s]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')

  if (!normalized || normalized === DEFAULT_PROFILE_ID) return 'profile'
  return normalized
}

function now(): string {
  return new Date().toISOString()
}

function expandHome(p: string): string {
  if (p.startsWith('~/')) {
    return path.join(process.env.HOME ?? '', p.slice(2))
  }
  return p
}

async function ensureDir(dir: string): Promise<void> {
  await fs.mkdir(dir, { recursive: true })
}

async function fileExists(target: string): Promise<boolean> {
  try {
    await fs.access(target)
    return true
  } catch {
    return false
  }
}

async function copyFileIfMissing(src: string, dst: string): Promise<void> {
  if (!(await fileExists(src)) || (await fileExists(dst))) return
  await fs.copyFile(src, dst)
}

// ── Profile serialization ─────────────────────────────────────────

function parseProfile(id: string, raw: Record<string, unknown>): RoutingProfile {
  return {
    id,
    name: typeof raw.name === 'string' ? raw.name : id,
    modelRef: typeof raw.modelRef === 'string' ? raw.modelRef : null,
    inheritWorkspace: raw.inheritWorkspace !== false,
    workspacePath: typeof raw.workspacePath === 'string' ? raw.workspacePath : undefined,
    createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : now(),
    updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : now(),
  }
}

function serializeProfile(p: RoutingProfile): Record<string, unknown> {
  return {
    id: p.id,
    name: p.name,
    modelRef: p.modelRef,
    inheritWorkspace: p.inheritWorkspace,
    ...(p.workspacePath ? { workspacePath: p.workspacePath } : {}),
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  }
}

function parseRoute(raw: unknown): ChannelRoute | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  if (typeof r.channelType !== 'string' || !r.channelType) return null
  if (typeof r.accountId !== 'string' || !r.accountId) return null
  if (typeof r.profileId !== 'string' || !r.profileId) return null
  return {
    channelType: r.channelType,
    accountId: r.accountId,
    profileId: r.profileId,
  }
}

// ── Service ───────────────────────────────────────────────────────

async function loadState(): Promise<{
  profiles: Map<string, RoutingProfile>
  routes: ChannelRoute[]
}> {
  const raw = await readRoutingConfig()
  const profiles = new Map<string, RoutingProfile>()

  if (raw.profiles && typeof raw.profiles === 'object') {
    for (const [id, value] of Object.entries(raw.profiles)) {
      if (value && typeof value === 'object') {
        profiles.set(id, parseProfile(id, value as Record<string, unknown>))
      }
    }
  }

  const routes: ChannelRoute[] = []
  if (Array.isArray(raw.routes)) {
    for (const item of raw.routes) {
      const route = parseRoute(item)
      if (route) routes.push(route)
    }
  }

  return { profiles, routes }
}

async function saveState(
  profiles: Map<string, RoutingProfile>,
  routes: ChannelRoute[],
): Promise<void> {
  const serializedProfiles: Record<string, unknown> = {}
  for (const [id, profile] of profiles) {
    serializedProfiles[id] = serializeProfile(profile)
  }

  await writeRoutingConfig({
    profiles: serializedProfiles,
    routes,
  })
}

async function syncGateway(
  profiles: Map<string, RoutingProfile>,
  routes: ChannelRoute[],
): Promise<void> {
  const profileList = [...profiles.values()].map((p) => ({
    id: p.id,
    name: p.name,
    modelRef: p.modelRef,
    workspacePath: p.workspacePath,
  }))

  await syncRoutingToGatewayFormat(profileList, routes)
}

// ── Public API ────────────────────────────────────────────────────

export async function listProfiles(): Promise<RoutingSnapshot> {
  const { profiles, routes } = await loadState()
  const globalModelRef = await readDefaultModel()

  // Ensure implicit default profile exists
  if (!profiles.has(DEFAULT_PROFILE_ID)) {
    profiles.set(DEFAULT_PROFILE_ID, {
      id: DEFAULT_PROFILE_ID,
      name: DEFAULT_PROFILE_NAME,
      modelRef: null,
      inheritWorkspace: true,
      createdAt: now(),
      updatedAt: now(),
    })
  }

  return {
    profiles: [...profiles.values()],
    routes,
    defaultProfileId: DEFAULT_PROFILE_ID,
    globalModelRef: globalModelRef || null,
  }
}

export async function createProfile(input: CreateProfileInput): Promise<RoutingProfile> {
  const { profiles, routes } = await loadState()

  // Generate unique slug id
  const baseSlug = slugify(input.name)
  let id = baseSlug
  let suffix = 2
  while (profiles.has(id)) {
    id = `${baseSlug}-${suffix}`
    suffix++
  }

  const stateDir = getOpenClawStateDir()
  const workspacePath = `~/.openclaw/workspace-${id}`

  const profile: RoutingProfile = {
    id,
    name: input.name.trim(),
    modelRef: input.modelRef?.trim() || null,
    inheritWorkspace: input.inheritWorkspace !== false,
    workspacePath,
    createdAt: now(),
    updatedAt: now(),
  }

  profiles.set(id, profile)

  // Bind channels if provided (one-step setup)
  if (input.channelBindings?.length) {
    for (const binding of input.channelBindings) {
      // Remove existing route for this channel+account
      const idx = routes.findIndex(
        (r) => r.channelType === binding.channelType && r.accountId === binding.accountId,
      )
      if (idx !== -1) routes.splice(idx, 1)

      routes.push({
        channelType: binding.channelType,
        accountId: binding.accountId,
        profileId: id,
      })
    }
  }

  // Provision workspace
  await provisionWorkspace(profile, stateDir)

  // Persist
  await saveState(profiles, routes)
  await syncGateway(profiles, routes)

  // Sync provider credentials to the new agent directory so LLM auth works immediately.
  // syncAllProvidersToRuntime → syncManagedAuthProfiles scans all agent dirs including the new one.
  try {
    await syncAllProvidersToRuntime()
  } catch (err) {
    mainLogger.warn(`[routing] Failed to sync provider auth after creating profile "${id}":`, err)
  }

  mainLogger.info(`[routing] Created profile "${id}" (model: ${profile.modelRef ?? 'inherit'})`)
  return profile
}

export async function updateProfile(id: string, input: UpdateProfileInput): Promise<RoutingProfile> {
  const { profiles, routes } = await loadState()
  const existing = profiles.get(id)
  if (!existing) {
    throw new Error(`Profile "${id}" not found`)
  }

  const updated: RoutingProfile = {
    ...existing,
    ...(input.name !== undefined ? { name: input.name.trim() } : {}),
    ...(input.modelRef !== undefined ? { modelRef: input.modelRef?.trim() || null } : {}),
    updatedAt: now(),
  }

  profiles.set(id, updated)
  await saveState(profiles, routes)
  await syncGateway(profiles, routes)

  mainLogger.info(`[routing] Updated profile "${id}"`)
  return updated
}

export async function deleteProfile(id: string): Promise<void> {
  if (id === DEFAULT_PROFILE_ID) {
    throw new Error('Cannot delete the default profile')
  }

  const { profiles, routes } = await loadState()
  if (!profiles.has(id)) {
    throw new Error(`Profile "${id}" not found`)
  }

  profiles.delete(id)

  // Remove routes that reference this profile (channels fallback to default)
  const nextRoutes = routes.filter((r) => r.profileId !== id)

  await saveState(profiles, nextRoutes)
  await syncGateway(profiles, nextRoutes)

  // Clean up workspace
  await removeWorkspace(id)

  mainLogger.info(`[routing] Deleted profile "${id}"`)
}

export async function getRoute(
  channelType: string,
  accountId: string,
): Promise<ChannelRoute | null> {
  const { routes } = await loadState()
  return (
    routes.find((r) => r.channelType === channelType && r.accountId === accountId) ?? null
  )
}

export async function setRoute(
  channelType: string,
  accountId: string,
  profileId: string,
): Promise<void> {
  const { profiles, routes } = await loadState()

  if (!profiles.has(profileId) && profileId !== DEFAULT_PROFILE_ID) {
    throw new Error(`Profile "${profileId}" not found`)
  }

  // Remove existing route for this channel+account
  const nextRoutes = routes.filter(
    (r) => !(r.channelType === channelType && r.accountId === accountId),
  )

  nextRoutes.push({ channelType, accountId, profileId })

  await saveState(profiles, nextRoutes)
  await syncGateway(profiles, nextRoutes)

  mainLogger.info(`[routing] Set route ${channelType}:${accountId} → ${profileId}`)
}

export async function clearRoute(channelType: string, accountId: string): Promise<void> {
  const { profiles, routes } = await loadState()

  const nextRoutes = routes.filter(
    (r) => !(r.channelType === channelType && r.accountId === accountId),
  )

  if (nextRoutes.length === routes.length) return // nothing to clear

  await saveState(profiles, nextRoutes)
  await syncGateway(profiles, nextRoutes)

  mainLogger.info(`[routing] Cleared route for ${channelType}:${accountId}`)
}

export async function clearAllRoutesForChannel(channelType: string): Promise<void> {
  const { profiles, routes } = await loadState()

  const nextRoutes = routes.filter((r) => r.channelType !== channelType)
  if (nextRoutes.length === routes.length) return

  await saveState(profiles, nextRoutes)
  await syncGateway(profiles, nextRoutes)

  mainLogger.info(`[routing] Cleared all routes for channel "${channelType}"`)
}

/**
 * Resolve which model a channel+account should use.
 * Priority: exact route → default profile → global default.
 */
export async function resolveModelRef(
  channelType: string,
  accountId: string,
): Promise<string | null> {
  const { profiles, routes } = await loadState()
  const globalModelRef = await readDefaultModel()

  // Exact match
  const exactRoute = routes.find(
    (r) => r.channelType === channelType && r.accountId === accountId,
  )
  // Wildcard match
  const wildcardRoute = routes.find(
    (r) => r.channelType === channelType && r.accountId === '*',
  )

  const route = exactRoute ?? wildcardRoute
  const profileId = route?.profileId ?? DEFAULT_PROFILE_ID
  const profile = profiles.get(profileId)

  return profile?.modelRef ?? (globalModelRef || null)
}

// ── Workspace provisioning ────────────────────────────────────────

async function provisionWorkspace(
  profile: RoutingProfile,
  stateDir: string,
): Promise<void> {
  const targetWorkspace = expandHome(profile.workspacePath ?? `~/.openclaw/workspace-${profile.id}`)
  const targetAgentDir = path.join(stateDir, 'agents', profile.id, 'agent')
  const targetSessionsDir = path.join(stateDir, 'agents', profile.id, 'sessions')

  await ensureDir(targetWorkspace)
  await ensureDir(targetAgentDir)
  await ensureDir(targetSessionsDir)

  // Always copy runtime files (auth-profiles.json, models.json) so LLM auth works
  const sourceAgentDir = path.join(stateDir, 'agents', 'main', 'agent')
  for (const fileName of RUNTIME_FILES) {
    await copyFileIfMissing(path.join(sourceAgentDir, fileName), path.join(targetAgentDir, fileName))
  }

  // Optionally copy bootstrap files (SOUL.md etc.)
  if (profile.inheritWorkspace) {
    const sourceWorkspace = getDefaultOpenClawWorkspaceRoot()
    for (const fileName of BOOTSTRAP_FILES) {
      await copyFileIfMissing(
        path.join(sourceWorkspace, fileName),
        path.join(targetWorkspace, fileName),
      )
    }
  }
}

async function removeWorkspace(profileId: string): Promise<void> {
  if (profileId === DEFAULT_PROFILE_ID) return

  const stateDir = getOpenClawStateDir()
  const runtimeDir = path.join(stateDir, 'agents', profileId)

  try {
    await fs.rm(runtimeDir, { recursive: true, force: true })
  } catch (err) {
    mainLogger.warn(`[routing] Failed to remove runtime dir for "${profileId}":`, err)
  }

  // Only remove workspace if it's a managed path (under ~/.openclaw/)
  const managedWorkspace = expandHome(`~/.openclaw/workspace-${profileId}`)
  try {
    const stat = await fs.stat(managedWorkspace)
    if (stat.isDirectory()) {
      await fs.rm(managedWorkspace, { recursive: true, force: true })
    }
  } catch {
    // Not found or already removed — fine
  }
}
