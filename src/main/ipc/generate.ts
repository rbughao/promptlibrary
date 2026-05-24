import type { IpcMain } from 'electron'
import { generatePrompts, applyPersonaFilter, listModels, testConnection } from '../ai/generator'
import { getProviderConfig } from '../settings'
import type { PageContent, PersonaDef, ProviderConfig, ProviderType } from '../../types'

export function registerGenerateHandlers(ipcMain: IpcMain): void {
  ipcMain.handle('generate:prompts', async (_, pages: PageContent[], category: string) => {
    try {
      const config = getProviderConfig()
      const result = await generatePrompts(pages, category, config)
      return { success: true, ...result }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) }
    }
  })

  ipcMain.handle(
    'generate:persona',
    async (
      _,
      basePrompts: Array<{ text: string; cluster: string; trustWord: string }>,
      personas: PersonaDef[],
      category: string
    ) => {
      try {
        const config = getProviderConfig()
        const prompts = await applyPersonaFilter(basePrompts, personas, category, config)
        return { success: true, prompts }
      } catch (err) {
        return { success: false, error: err instanceof Error ? err.message : String(err) }
      }
    }
  )

  ipcMain.handle(
    'generate:listModels',
    async (_, cfg: { type: ProviderType; apiKey: string; baseUrl: string }) => {
      try {
        const models = await listModels(cfg)
        return { success: true, models }
      } catch (err) {
        return {
          success: false,
          error: err instanceof Error ? err.message : String(err),
          models: [],
        }
      }
    }
  )

  ipcMain.handle('generate:testConnection', async (_, config: ProviderConfig) => {
    try {
      return await testConnection(config)
    } catch (err) {
      return {
        success: false,
        latencyMs: 0,
        model: config.model,
        error: err instanceof Error ? err.message : String(err),
      }
    }
  })
}
