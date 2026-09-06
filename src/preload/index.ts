import { contextBridge, ipcRenderer } from 'electron'
import type {
  PageContent, Cluster, Session, SessionWithPrompts,
  PersonaDef, CrawlProgress, GenerateProgress, ProviderConfig, ProviderType,
  CrawlRequestOptions, RawTerm,
} from '../types'

type CrawlProgressCallback = (progress: CrawlProgress) => void

type NewPrompt = {
  text: string
  cluster: string
  trustWord: string
  persona?: string
  personaLabel?: string
}

const api = {
  crawl: {
    start: (url: string, opts?: CrawlRequestOptions) =>
      ipcRenderer.invoke('crawl:start', url, opts),
    cancel: (url: string) => ipcRenderer.invoke('crawl:cancel', url),
  },
  generate: {
    prompts: (
      pages: PageContent[],
      category: string
    ): Promise<{
      success: boolean
      clusters: Cluster[]
      prompts: NewPrompt[]
      warnings: string[]
      error?: string
    }> => ipcRenderer.invoke('generate:prompts', pages, category),
    persona: (
      basePrompts: Array<{ text: string; cluster: string; trustWord: string }>,
      personas: PersonaDef[],
      category: string
    ): Promise<{
      success: boolean
      prompts: NewPrompt[]
      warnings: string[]
      error?: string
    }> => ipcRenderer.invoke('generate:persona', basePrompts, personas, category),
    cluster: (
      clusterName: string,
      existingPrompts: Array<{ text: string; cluster: string; trustWord: string }>,
      category: string,
      count: number
    ): Promise<{
      success: boolean
      prompts: NewPrompt[]
      warnings: string[]
      error?: string
    }> =>
      ipcRenderer.invoke('generate:cluster', clusterName, existingPrompts, category, count),
    listModels: (cfg: { type: ProviderType; apiKey: string; baseUrl: string }) =>
      ipcRenderer.invoke('generate:listModels', cfg),
    testConnection: (config: ProviderConfig) =>
      ipcRenderer.invoke('generate:testConnection', config),
    terms: (
      pages: PageContent[]
    ): Promise<{ success: boolean; terms: RawTerm[]; error?: string }> =>
      ipcRenderer.invoke('nlp:terms', pages),
  },
  db: {
    save: (
      sessionData: { url: string; category: string; pageCount?: number },
      clusters: Cluster[],
      prompts: NewPrompt[]
    ) => ipcRenderer.invoke('db:save', sessionData, clusters, prompts),
    appendPrompts: (
      sessionId: string,
      prompts: NewPrompt[]
    ): Promise<{ success: boolean; added: number; error?: string }> =>
      ipcRenderer.invoke('db:appendPrompts', sessionId, prompts),
    load: (sessionId: string): Promise<SessionWithPrompts | null> =>
      ipcRenderer.invoke('db:load', sessionId),
    list: (): Promise<Session[]> => ipcRenderer.invoke('db:list'),
    delete: (sessionId: string) => ipcRenderer.invoke('db:delete', sessionId),
    updatePrompt: (
      promptId: string,
      changes: { text?: string; tags?: string[]; deleted?: boolean }
    ) => ipcRenderer.invoke('db:updatePrompt', promptId, changes),
  },
  settings: {
    getConfig: (): Promise<ProviderConfig> => ipcRenderer.invoke('settings:getConfig'),
    setConfig: (config: ProviderConfig) => ipcRenderer.invoke('settings:setConfig', config),
  },
  on: {
    crawlProgress: (cb: CrawlProgressCallback) => {
      const handler = (_: Electron.IpcRendererEvent, progress: CrawlProgress) => cb(progress)
      ipcRenderer.on('crawl:progress', handler)
      // Braces matter: removeListener returns IpcRenderer, but React's cleanup
      // callback must return void.
      return () => {
        ipcRenderer.removeListener('crawl:progress', handler)
      }
    },
    generateProgress: (cb: (progress: GenerateProgress) => void) => {
      const handler = (_: Electron.IpcRendererEvent, progress: GenerateProgress) => cb(progress)
      ipcRenderer.on('generate:progress', handler)
      return () => {
        ipcRenderer.removeListener('generate:progress', handler)
      }
    },
  },
}

contextBridge.exposeInMainWorld('api', api)

export type Api = typeof api
