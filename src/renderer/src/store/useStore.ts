import { create } from 'zustand'
import { CRAWL_DEFAULTS } from '@shared/index'
import type {
  Cluster, Prompt, Session, SessionWithPrompts,
  CrawlProgress, GenerateProgress, PageContent, PipelineStage, ProviderConfig,
} from '@shared/index'

export type AppPage = 'setup' | 'library' | 'history'

interface AppState {
  // Navigation
  currentPage: AppPage
  setPage: (page: AppPage) => void

  // Provider config
  providerConfig: ProviderConfig
  setProviderConfig: (cfg: ProviderConfig) => void
  showSettings: boolean
  setShowSettings: (show: boolean) => void

  // Setup form
  url: string
  setUrl: (url: string) => void
  category: string
  setCategory: (cat: string) => void
  customCategory: string
  setCustomCategory: (cat: string) => void
  selectedPersonas: string[]
  togglePersona: (id: string) => void
  clearPersonas: () => void

  // Crawl state
  /** Which step of crawl → review → generate the user is on. */
  pipelineStage: PipelineStage
  setPipelineStage: (stage: PipelineStage) => void
  crawlMaxPages: number
  setCrawlMaxPages: (n: number) => void
  crawlMaxDepth: number
  setCrawlMaxDepth: (n: number) => void
  crawling: boolean
  setCrawling: (v: boolean) => void
  crawlProgress: CrawlProgress | null
  setCrawlProgress: (p: CrawlProgress | null) => void
  crawledPages: PageContent[]
  setCrawledPages: (pages: PageContent[]) => void
  /** URLs the user has unticked in the review panel; excluded from generation. */
  excludedUrls: string[]
  toggleExcludedUrl: (url: string) => void
  setExcludedUrls: (urls: string[]) => void

  // Generation state
  generating: boolean
  setGenerating: (v: boolean) => void
  generatingPersona: boolean
  setGeneratingPersona: (v: boolean) => void
  generateProgress: GenerateProgress | null
  setGenerateProgress: (p: GenerateProgress | null) => void

  // Current session
  currentSession: SessionWithPrompts | null
  setCurrentSession: (s: SessionWithPrompts | null) => void

  prompts: Prompt[]
  setPrompts: (prompts: Prompt[]) => void
  updatePrompt: (id: string, changes: Partial<Prompt>) => void
  clusters: Cluster[]
  setClusters: (clusters: Cluster[]) => void

  // Library filters
  searchText: string
  setSearchText: (t: string) => void
  filterCluster: string
  setFilterCluster: (c: string) => void
  filterPersona: string
  setFilterPersona: (p: string) => void
  filterTrustWord: string
  setFilterTrustWord: (w: string) => void
  showDeleted: boolean
  setShowDeleted: (v: boolean) => void

  // History
  sessions: Session[]
  setSessions: (s: Session[]) => void

  // Error
  error: string | null
  setError: (e: string | null) => void
  /** Non-fatal problems from the last generation (e.g. one persona failed). */
  warnings: string[]
  setWarnings: (w: string[]) => void
}

export const useStore = create<AppState>((set) => ({
  currentPage: 'setup',
  setPage: (currentPage) => set({ currentPage }),

  providerConfig: { type: 'anthropic', apiKey: '', baseUrl: '', model: 'claude-opus-4-7' },
  setProviderConfig: (providerConfig) => set({ providerConfig }),
  showSettings: false,
  setShowSettings: (showSettings) => set({ showSettings }),

  url: '',
  setUrl: (url) => set({ url }),
  category: 'Hospitality',
  setCategory: (category) => set({ category }),
  customCategory: '',
  setCustomCategory: (customCategory) => set({ customCategory }),
  selectedPersonas: [],
  togglePersona: (id) =>
    set((state) => ({
      selectedPersonas: state.selectedPersonas.includes(id)
        ? state.selectedPersonas.filter((p) => p !== id)
        : [...state.selectedPersonas, id],
    })),
  clearPersonas: () => set({ selectedPersonas: [] }),

  pipelineStage: 'idle',
  setPipelineStage: (pipelineStage) => set({ pipelineStage }),
  crawlMaxPages: CRAWL_DEFAULTS.maxPages,
  setCrawlMaxPages: (crawlMaxPages) => set({ crawlMaxPages }),
  crawlMaxDepth: CRAWL_DEFAULTS.maxDepth,
  setCrawlMaxDepth: (crawlMaxDepth) => set({ crawlMaxDepth }),
  crawling: false,
  setCrawling: (crawling) => set({ crawling }),
  crawlProgress: null,
  setCrawlProgress: (crawlProgress) => set({ crawlProgress }),
  crawledPages: [],
  setCrawledPages: (crawledPages) => set({ crawledPages }),
  excludedUrls: [],
  toggleExcludedUrl: (url) =>
    set((state) => ({
      excludedUrls: state.excludedUrls.includes(url)
        ? state.excludedUrls.filter((u) => u !== url)
        : [...state.excludedUrls, url],
    })),
  setExcludedUrls: (excludedUrls) => set({ excludedUrls }),

  generating: false,
  setGenerating: (generating) => set({ generating }),
  generatingPersona: false,
  setGeneratingPersona: (generatingPersona) => set({ generatingPersona }),
  generateProgress: null,
  setGenerateProgress: (generateProgress) => set({ generateProgress }),

  currentSession: null,
  setCurrentSession: (currentSession) => set({ currentSession }),

  prompts: [],
  setPrompts: (prompts) => set({ prompts }),
  updatePrompt: (id, changes) =>
    set((state) => ({
      prompts: state.prompts.map((p) => (p.id === id ? { ...p, ...changes } : p)),
    })),
  clusters: [],
  setClusters: (clusters) => set({ clusters }),

  searchText: '',
  setSearchText: (searchText) => set({ searchText }),
  filterCluster: '',
  setFilterCluster: (filterCluster) => set({ filterCluster }),
  filterPersona: '',
  setFilterPersona: (filterPersona) => set({ filterPersona }),
  filterTrustWord: '',
  setFilterTrustWord: (filterTrustWord) => set({ filterTrustWord }),
  showDeleted: false,
  setShowDeleted: (showDeleted) => set({ showDeleted }),

  sessions: [],
  setSessions: (sessions) => set({ sessions }),

  error: null,
  setError: (error) => set({ error }),
  warnings: [],
  setWarnings: (warnings) => set({ warnings }),
}))
