import { create } from 'zustand'
import type {
  RoutingProfile,
  ChannelRoute,
  RoutingSnapshot,
} from '../../../shared/types/routing'

interface RoutingStore {
  profiles: RoutingProfile[]
  routes: ChannelRoute[]
  defaultProfileId: string
  globalModelRef: string | null
  loading: boolean

  refresh: () => Promise<void>
  createProfile: (params: {
    name: string
    modelRef?: string
    inheritWorkspace?: boolean
    channelBindings?: Array<{ channelType: string; accountId: string }>
  }) => Promise<RoutingProfile>
  updateProfile: (id: string, params: { name?: string; modelRef?: string | null }) => Promise<void>
  deleteProfile: (id: string) => Promise<void>
  setRoute: (channelType: string, accountId: string, profileId: string) => Promise<void>
  clearRoute: (channelType: string, accountId: string) => Promise<void>
  getProfileForChannel: (channelType: string, accountId: string) => RoutingProfile | null
}

export const useRoutingStore = create<RoutingStore>((set, get) => ({
  profiles: [],
  routes: [],
  defaultProfileId: 'default',
  globalModelRef: null,
  loading: false,

  refresh: async () => {
    set({ loading: true })
    try {
      const snapshot = (await window.clawpilot.routing.listProfiles()) as RoutingSnapshot
      set({
        profiles: snapshot.profiles,
        routes: snapshot.routes,
        defaultProfileId: snapshot.defaultProfileId,
        globalModelRef: snapshot.globalModelRef,
        loading: false,
      })
    } catch {
      set({ loading: false })
    }
  },

  createProfile: async (params) => {
    const profile = (await window.clawpilot.routing.createProfile(params)) as RoutingProfile
    await get().refresh()
    return profile
  },

  updateProfile: async (id, params) => {
    await window.clawpilot.routing.updateProfile({ id, ...params })
    await get().refresh()
  },

  deleteProfile: async (id) => {
    await window.clawpilot.routing.deleteProfile({ id })
    await get().refresh()
  },

  setRoute: async (channelType, accountId, profileId) => {
    await window.clawpilot.routing.setRoute({ channelType, accountId, profileId })
    await get().refresh()
  },

  clearRoute: async (channelType, accountId) => {
    await window.clawpilot.routing.clearRoute({ channelType, accountId })
    await get().refresh()
  },

  getProfileForChannel: (channelType, accountId) => {
    const { routes, profiles, defaultProfileId } = get()
    const route = routes.find(
      (r) => r.channelType === channelType && r.accountId === accountId,
    )
    const profileId = route?.profileId ?? defaultProfileId
    return profiles.find((p) => p.id === profileId) ?? null
  },
}))
