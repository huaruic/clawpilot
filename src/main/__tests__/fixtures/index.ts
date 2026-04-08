/**
 * Shared test fixtures — factories and helpers for unit tests.
 */
import { vi } from 'vitest'
import type { ProviderAccount } from '../../../shared/providers/types'
import type { RoutingProfile, ChannelRoute } from '../../../shared/types/routing'

// ── Fake electron-store (in-memory Map) ──────────────────────────

export function createFakeStore(initial: Record<string, unknown> = {}): {
  get: (key: string) => unknown
  set: (key: string, value: unknown) => void
  delete: (key: string) => void
  store: Map<string, unknown>
} {
  const store = new Map<string, unknown>(Object.entries(initial))
  return {
    get: (key: string) => store.get(key),
    set: (key: string, value: unknown) => store.set(key, value),
    delete: (key: string) => store.delete(key),
    store,
  }
}

// ── ProviderAccount factory ──────────────────────────────────────

export function createFakeProviderAccount(
  overrides: Partial<ProviderAccount> = {},
): ProviderAccount {
  const now = new Date().toISOString()
  return {
    id: 'test-account-1',
    vendorId: 'openai',
    label: 'Test OpenAI',
    authMode: 'api_key',
    enabled: true,
    isDefault: false,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

// ── RoutingProfile factory ───────────────────────────────────────

export function createFakeRoutingProfile(
  overrides: Partial<RoutingProfile> = {},
): RoutingProfile {
  const now = new Date().toISOString()
  return {
    id: 'test-profile',
    name: 'Test Profile',
    modelRef: null,
    inheritWorkspace: true,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

// ── RoutingConfig factory (raw config as returned by readRoutingConfig) ─

export function createFakeRoutingConfig(
  profiles: Record<string, unknown> = {},
  routes: unknown[] = [],
): { profiles: Record<string, unknown>; routes: unknown[] } {
  return { profiles, routes }
}

// ── Logger mock ──────────────────────────────────────────────────

export function mockLogger() {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }
}
