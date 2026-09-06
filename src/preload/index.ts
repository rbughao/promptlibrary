import { contextBridge, ipcRenderer } from 'electron'
import type {
  PageContent, Cluster, Session, SessionWithPrompts,
  PersonaDef, CrawlProgress, ProviderConfig, ProviderType,
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
    start: (url: string) => ipcRenderer.invoke('crawl:start', url),
    cancel: (url: string) => ipcRenderer.invoke('crawl:cancel', url),
  },
  generate: {
    prompts: (pages: PageContent[], category: string) =>
      ipcRenderer.invoke('generate:prompts', pages, category),
    persona: (
      basePrompts: Array<{ text: string; cluster: string; trustWord: string }>,
      personas: PersonaDef[],
      category: string
    ) => ipcRenderer.invoke('generate:persona', basePrompts, personas, category),
    listModels: (cfg: { type: ProviderType; apiKey: string; baseUrl: string }) =>
      ipcRenderer.invoke('generate:listModels', cfg),
    testConnection: (config: ProviderConfig) =>
      ipcRenderer.invoke('generate:testConnection', config),
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
  },
}

contextBridge.exposeInMainWorld('api', api)

export type Api = typeof api
