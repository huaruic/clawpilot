import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createFakeRoutingProfile } from './fixtures'

// ── Mock window.catclaw before importing store ───────────────────

const mockRouting = vi.hoisted(() => ({
  listProfiles: vi.fn(),
  createProfile: vi.fn(),
  updateProfile: vi.fn(),
  deleteProfile: vi.fn(),
  setRoute: vi.fn(),
  clearRoute: vi.fn(),
}))

vi.stubGlobal('window', {
  catclaw: { routing: mockRouting },
})

import { useRoutingStore } from '../../renderer/src/stores/routingStore'

describe('routingStore', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset store state
    useRoutingStore.setState({
      profiles: [],
      routes: [],
      defaultProfileId: 'default',
      globalModelRef: null,
      loading: false,
    })
  })

  it('initial state has empty profiles and loading=false', () => {
    const state = useRoutingStore.getState()
    expect(state.profiles).toEqual([])
    expect(state.loading).toBe(false)
    expect(state.defaultProfileId).toBe('default')
  })

  it('refresh populates store from IPC response', async () => {
    const defaultProfile = createFakeRoutingProfile({ id: 'default', name: 'Default' })
    mockRouting.listProfiles.mockResolvedValue({
      profiles: [defaultProfile],
      routes: [{ channelType: 'telegram', accountId: 'main', profileId: 'default' }],
      defaultProfileId: 'default',
      globalModelRef: 'openai/gpt-4o',
    })

    await useRoutingStore.getState().refresh()
    const state = useRoutingStore.getState()

    expect(state.profiles).toHaveLength(1)
    expect(state.routes).toHaveLength(1)
    expect(state.globalModelRef).toBe('openai/gpt-4o')
    expect(state.loading).toBe(false)
  })

  it('refresh sets loading false even on error', async () => {
    mockRouting.listProfiles.mockRejectedValue(new Error('network'))

    await useRoutingStore.getState().refresh()
    expect(useRoutingStore.getState().loading).toBe(false)
  })

  it('createProfile calls IPC and refreshes', async () => {
    const profile = createFakeRoutingProfile({ id: 'bot', name: 'Bot' })
    mockRouting.createProfile.mockResolvedValue(profile)
    mockRouting.listProfiles.mockResolvedValue({
      profiles: [profile],
      routes: [],
      defaultProfileId: 'default',
      globalModelRef: null,
    })

    const result = await useRoutingStore.getState().createProfile({ name: 'Bot' })
    expect(result.id).toBe('bot')
    expect(mockRouting.createProfile).toHaveBeenCalledWith({ name: 'Bot' })
    expect(mockRouting.listProfiles).toHaveBeenCalled() // refresh was called
  })

  it('deleteProfile calls IPC and refreshes', async () => {
    mockRouting.deleteProfile.mockResolvedValue(undefined)
    mockRouting.listProfiles.mockResolvedValue({
      profiles: [],
      routes: [],
      defaultProfileId: 'default',
      globalModelRef: null,
    })

    await useRoutingStore.getState().deleteProfile('bot')
    expect(mockRouting.deleteProfile).toHaveBeenCalledWith({ id: 'bot' })
  })

  it('setRoute calls IPC and refreshes', async () => {
    mockRouting.setRoute.mockResolvedValue(undefined)
    mockRouting.listProfiles.mockResolvedValue({
      profiles: [],
      routes: [],
      defaultProfileId: 'default',
      globalModelRef: null,
    })

    await useRoutingStore.getState().setRoute('telegram', 'main', 'bot')
    expect(mockRouting.setRoute).toHaveBeenCalledWith({
      channelType: 'telegram',
      accountId: 'main',
      profileId: 'bot',
    })
  })

  it('getProfileForChannel returns matched profile', () => {
    const profile = createFakeRoutingProfile({ id: 'bot', name: 'Bot' })
    useRoutingStore.setState({
      profiles: [
        createFakeRoutingProfile({ id: 'default', name: 'Default' }),
        profile,
      ],
      routes: [{ channelType: 'telegram', accountId: 'main', profileId: 'bot' }],
    })

    const result = useRoutingStore.getState().getProfileForChannel('telegram', 'main')
    expect(result?.id).toBe('bot')
  })

  it('getProfileForChannel returns default profile when no route matches', () => {
    useRoutingStore.setState({
      profiles: [createFakeRoutingProfile({ id: 'default', name: 'Default' })],
      routes: [],
      defaultProfileId: 'default',
    })

    const result = useRoutingStore.getState().getProfileForChannel('discord', 'main')
    expect(result?.id).toBe('default')
  })
})
