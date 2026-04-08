import { safeStorage } from 'electron'
import fs from 'node:fs/promises'
import path from 'node:path'
import { getCatClawDataDir } from './RuntimeLocator'
import { listManagedProviderNames, loadManagedProviderApiKey } from './OpenClawAuthProfileWriter'

type SecretsFile = Record<string, string> // providerName → base64(encrypted)

function secretsPath(): string {
  return path.join(getCatClawDataDir(), 'secrets.json')
}

async function readSecrets(): Promise<SecretsFile> {
  try {
    const raw = await fs.readFile(secretsPath(), 'utf-8')
    return JSON.parse(raw) as SecretsFile
  } catch {
    return {}
  }
}

async function writeSecrets(data: SecretsFile): Promise<void> {
  const p = secretsPath()
  await fs.mkdir(path.dirname(p), { recursive: true })
  await fs.writeFile(p, JSON.stringify(data, null, 2), { mode: 0o600 })
}

export async function saveApiKey(provider: string, key: string): Promise<void> {
  const secrets = await readSecrets()
  if (safeStorage.isEncryptionAvailable()) {
    secrets[provider] = safeStorage.encryptString(key).toString('base64')
  } else {
    // Fallback: base64 only (no encryption available — rare edge case)
    secrets[provider] = Buffer.from(key).toString('base64')
  }
  await writeSecrets(secrets)
}

export async function loadApiKey(provider: string): Promise<string | null> {
  const secrets = await readSecrets()
  if (!secrets[provider]) {
    return loadManagedProviderApiKey(provider)
  }
  const buf = Buffer.from(secrets[provider], 'base64')
  if (safeStorage.isEncryptionAvailable()) {
    try {
      return safeStorage.decryptString(buf)
    } catch {
      // The stored ciphertext is no longer decryptable in the current safeStorage context.
      // Drop the corrupted secret so it does not keep breaking provider/Ollama status calls.
      delete secrets[provider]
      await writeSecrets(secrets)
      return loadManagedProviderApiKey(provider)
    }
  }
  return buf.toString('utf-8')
}

export async function deleteApiKey(provider: string): Promise<void> {
  const secrets = await readSecrets()
  delete secrets[provider]
  await writeSecrets(secrets)
}

export async function listProviderNames(): Promise<string[]> {
  const [secrets, managed] = await Promise.all([
    readSecrets(),
    listManagedProviderNames(),
  ])

  return [...new Set([...Object.keys(secrets), ...managed])]
}
