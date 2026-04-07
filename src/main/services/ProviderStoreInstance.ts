// Lazy-load electron-store (ESM module) from the main process only.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let providerStore: any = null

export async function getProviderStore() {
  if (!providerStore) {
    const Store = (await import('electron-store')).default
    providerStore = new Store({
      name: 'clawpilot-providers',
      defaults: {
        schemaVersion: 0,
        providerAccounts: {} as Record<string, unknown>,
        providerSecrets: {} as Record<string, unknown>,
        defaultProviderAccountId: null as string | null,
      },
    })
  }

  return providerStore
}
