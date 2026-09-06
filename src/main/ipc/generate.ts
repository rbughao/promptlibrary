import type { IpcMain, BrowserWindow } from 'electron'
import {
  generatePrompts, applyPersonaFilter, generateClusterPrompts, listModels, testConnection,
} from '../ai/generator'
import { getProviderConfig } from '../settings'
import type { PageContent, PersonaDef, ProviderConfig, ProviderType } from '../../types'

export function registerGenerateHandlers(
  ipcMain: IpcMain,
  getWindow: () => BrowserWindow | null
): void {
  ipcMain.handle('generate:prompts', async (_, pages: PageContent[], category: string) => {
    try {
      const config = getProviderConfig()
      getWindow()?.webContents.send('generate:progress', { stage: 'prompts' })
      const result = await generatePrompts(pages, category, config)
      return { success: true, ...result, warnings: result.warnings ?? [] }
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
        const { prompts, warnings } = await applyPersonaFilter(
          basePrompts,
          personas,
          category,
          config,
          (progress) => getWindow()?.webContents.send('generate:progress', progress)
        )

        // Every persona failing is a real failure, not a warning.
        if (prompts.length === 0) {
          return {
            success: false,
            prompts: [],
            warnings,
            error:
              warnings[0] ??
              'The model returned no persona prompts. It may have run out of output tokens.',
          }
        }

        return { success: true, prompts, warnings }
      } catch (err) {
        return {
          success: false,
          prompts: [],
          warnings: [],
          error: err instanceof Error ? err.message : String(err),
        }
      }
    }
  )

  ipcMain.handle(
    'generate:cluster',
    async (
      _,
      clusterName: string,
      existingPrompts: Array<{ text: string; cluster: string; trustWord: string }>,
      category: string,
      count: number
    ) => {
      try {
        const config = getProviderConfig()
        const { prompts, warnings } = await generateClusterPrompts(
          clusterName,
          existingPrompts,
          category,
          count,
          config
        )

        if (prompts.length === 0) {
          return {
            success: false,
            prompts: [],
            warnings,
            error:
              `The model returned no new prompts for "${clusterName}". ` +
              'It may have run out of output tokens, or repeated prompts you already have.',
          }
        }

        return { success: true, prompts, warnings }
      } catch (err) {
        return {
          success: false,
          prompts: [],
          warnings: [],
          error: err instanceof Error ? err.message : String(err),
        }
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
