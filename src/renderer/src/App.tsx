import { useEffect } from 'react'
import { useStore } from './store/useStore'
import Setup from './pages/Setup'
import Library from './pages/Library'
import History from './pages/History'
import SettingsModal from './components/SettingsModal'
import { PROVIDER_NEEDS_KEY } from '@shared/index'

const NAV_ITEMS = [
  { id: 'setup', label: 'New Library' },
  { id: 'library', label: 'Library' },
  { id: 'history', label: 'History' },
] as const

export default function App(): JSX.Element {
  const { currentPage, setPage, showSettings, setShowSettings, providerConfig, setProviderConfig } = useStore()

  useEffect(() => {
    window.api.settings.getConfig().then((cfg) => {
      if (cfg) {
        setProviderConfig(cfg)
        // Show settings if no key set for providers that require one
        const needsKey = cfg.type === 'anthropic' || cfg.type === 'openai' || cfg.type === 'gemini'
        if (needsKey && !cfg.apiKey) setShowSettings(true)
      } else {
        setShowSettings(true)
      }
    })
  }, [setProviderConfig, setShowSettings])

  const providerLabel: Record<string, string> = {
    anthropic: 'Claude',
    openai: 'OpenAI',
    gemini: 'Gemini',
    ollama: 'Ollama',
    lmstudio: 'LM Studio',
    custom: 'Custom',
  }

  const providerReady =
    providerConfig.model &&
    (!PROVIDER_NEEDS_KEY[providerConfig.type] || Boolean(providerConfig.apiKey))

  return (
    <div className="flex flex-col h-screen bg-slate-900 text-slate-100 select-none">
      {/* Title bar / nav */}
      <div className="flex items-center gap-0 bg-slate-900 border-b border-slate-700/60 h-12 px-4 shrink-0 app-drag">
        <span className="text-indigo-400 font-semibold text-sm mr-6 no-drag">
          Prompt Library Builder
        </span>
        <nav className="flex gap-1 no-drag">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              onClick={() => setPage(item.id)}
              className={`px-4 py-1.5 rounded text-sm font-medium transition-colors ${
                currentPage === item.id
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              {item.label}
            </button>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2 no-drag">
          {/* Provider badge */}
          <button
            onClick={() => setShowSettings(true)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${
              providerReady
                ? 'border-emerald-800 bg-emerald-900/30 text-emerald-400 hover:border-emerald-700'
                : 'border-red-800 bg-red-900/20 text-red-400 hover:border-red-700'
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${providerReady ? 'bg-emerald-400' : 'bg-red-400'}`} />
            {providerLabel[providerConfig.type] ?? 'LLM'}
            {providerConfig.model && (
              <span className="opacity-60 ml-0.5">{providerConfig.model.split('/').pop()}</span>
            )}
          </button>

          <button
            onClick={() => setShowSettings(true)}
            className="p-1.5 rounded text-slate-500 hover:text-slate-300 hover:bg-slate-800 transition-colors"
            title="Settings"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        {currentPage === 'setup' && <Setup />}
        {currentPage === 'library' && <Library />}
        {currentPage === 'history' && <History />}
      </div>

      <div className="shrink-0 text-center py-1 text-slate-700 text-xs border-t border-slate-800/60">
        Developed by Rowel Bughao
      </div>

      {showSettings && <SettingsModal />}
    </div>
  )
}
