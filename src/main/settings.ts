import { app, safeStorage } from 'electron'
import { join } from 'path'
import { readFileSync, existsSync } from 'fs'
import type { ProviderConfig } from '../types'
import { writeFileAtomicSync } from './fsAtomic'

const CONFIG_FILE = 'provider-config.json'
const KEY_FILE = 'api.key'

let current: ProviderConfig = {
  type: 'anthropic',
  apiKey: '',
  baseUrl: '',
  model: 'claude-opus-4-7',
}

export function loadSettings(): void {
  const userData = app.getPath('userData')
  const configPath = join(userData, CONFIG_FILE)
  const keyPath = join(userData, KEY_FILE)

  try {
    if (existsSync(configPath)) {
      const stored = JSON.parse(readFileSync(configPath, 'utf-8')) as Partial<ProviderConfig>
      current = { ...current, ...stored, apiKey: '' }
    }
  } catch {
    // keep defaults
  }

  try {
    if (existsSync(keyPath)) {
      const buf = readFileSync(keyPath)
      current.apiKey = safeStorage.isEncryptionAvailable()
        ? safeStorage.decryptString(buf)
        : buf.toString('utf-8').trim()
    }
  } catch {
    // keep empty key
  }
}

export function saveSettings(config: ProviderConfig): void {
  const userData = app.getPath('userData')
  const configPath = join(userData, CONFIG_FILE)
  const keyPath = join(userData, KEY_FILE)

  const { apiKey, ...nonSensitive } = config
  writeFileAtomicSync(configPath, JSON.stringify(nonSensitive, null, 2))

  if (safeStorage.isEncryptionAvailable()) {
    writeFileAtomicSync(keyPath, safeStorage.encryptString(apiKey))
  } else {
    writeFileAtomicSync(keyPath, apiKey)
  }

  current = { ...config }
}

export function getProviderConfig(): ProviderConfig {
  return { ...current }
}
