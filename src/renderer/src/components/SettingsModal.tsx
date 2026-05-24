import { useState, useEffect, useRef, useCallback } from 'react'
import { useStore } from '../store/useStore'
import {
  PROVIDER_LABELS, PROVIDER_MODELS, PROVIDER_DEFAULT_URLS,
  PROVIDER_DEFAULT_MODELS, PROVIDER_NEEDS_KEY, PROVIDER_NEEDS_URL,
  type ProviderType, type ProviderConfig,
} from '@shared/index'

const PROVIDER_ORDER: ProviderType[] = ['anthropic', 'openai', 'gemini', 'ollama', 'lmstudio', 'custom']

const PROVIDER_HINTS: Partial<Record<ProviderType, string>> = {
  anthropic: 'Get your key at console.anthropic.com',
  openai: 'Get your key at platform.openai.com',
  gemini: 'Get your key at aistudio.google.com',
  ollama: 'No API key required. Make sure Ollama is running locally.',
  lmstudio: 'No API key required. Load a model in LM Studio first.',
  custom: 'Any OpenAI-compatible endpoint — vLLM, Groq, Together AI, etc.',
}

const OLLAMA_SUGGESTIONS = [
  'llama3.2', 'llama3.2:1b', 'llama3.1', 'llama3.1:8b',
  'mistral', 'mistral-nemo', 'qwen2.5', 'qwen2.5:7b',
  'phi4', 'phi4-mini', 'gemma2', 'gemma2:2b',
  'deepseek-r1', 'deepseek-r1:7b', 'codellama',
]

interface FetchState {
  status: 'idle' | 'fetching' | 'ok' | 'error'
  models: string[]
  error: string
}

interface TestState {
  status: 'idle' | 'testing' | 'ok' | 'error'
  latencyMs: number
  response: string
  error: string
}

export default function SettingsModal(): JSX.Element {
  const { providerConfig, setProviderConfig, setShowSettings } = useStore()

  const [draft, setDraft] = useState<ProviderConfig>({ ...providerConfig })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [fetch, setFetch] = useState<FetchState>({ status: 'idle', models: [], error: '' })
  const [test, setTest] = useState<TestState>({ status: 'idle', latencyMs: 0, response: '', error: '' })

  // Keep a ref so async callbacks always see the latest draft
  const draftRef = useRef(draft)
  useEffect(() => { draftRef.current = draft })

  const needsKey = PROVIDER_NEEDS_KEY[draft.type]
  const needsUrl = PROVIDER_NEEDS_URL[draft.type]
  const presetModels = PROVIDER_MODELS[draft.type]

  // All models to show in dropdown — fetched takes priority over preset
  const displayModels = fetch.models.length > 0 ? fetch.models : presetModels

  // ── Fetch helpers ──────────────────────────────────────────────────────────

  const doFetch = useCallback(async (
    type: ProviderType,
    apiKey: string,
    baseUrl: string
  ): Promise<void> => {
    setFetch({ status: 'fetching', models: [], error: '' })
    try {
      const result = await window.api.generate.listModels({ type, apiKey, baseUrl })
      if (result.success && result.models?.length > 0) {
        setFetch({ status: 'ok', models: result.models, error: '' })
        // Auto-select first model if current selection isn't in the list
        setDraft((d) => {
          const inList = result.models.includes(d.model)
          return inList ? d : { ...d, model: result.models[0] }
        })
      } else if (result.success) {
        // Server reachable but /models not supported — stay idle so text input shows
        setFetch({ status: 'idle', models: [], error: '' })
      } else {
        setFetch({ status: 'error', models: [], error: result.error ?? 'No models returned' })
      }
    } catch (err) {
      setFetch({
        status: 'error',
        models: [],
        error: err instanceof Error ? err.message : 'Connection failed',
      })
    }
  }, [])

  // ── Auto-fetch when provider type changes ─────────────────────────────────

  useEffect(() => {
    setFetch({ status: 'idle', models: [], error: '' })
    setTest({ status: 'idle', latencyMs: 0, response: '', error: '' })

    const { type, apiKey, baseUrl } = draftRef.current
    const url = baseUrl || PROVIDER_DEFAULT_URLS[type] || ''

    if (type === 'ollama' || type === 'lmstudio') {
      // local — no key needed, fetch immediately
      void doFetch(type, '', url)
    } else if (PROVIDER_NEEDS_KEY[type] && apiKey) {
      // cloud provider and key already saved — fetch immediately
      void doFetch(type, apiKey, url)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft.type, doFetch])

  // ── Auto-fetch when API key changes (cloud providers, debounced) ───────────

  useEffect(() => {
    if (!PROVIDER_NEEDS_KEY[draft.type]) return
    if (draft.apiKey.trim().length < 10) return // too short to be a real key

    const timer = setTimeout(() => {
      const { type, apiKey, baseUrl } = draftRef.current
      void doFetch(type, apiKey, baseUrl || PROVIDER_DEFAULT_URLS[type] || '')
    }, 1200)

    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft.apiKey, doFetch])

  // ── Auto-fetch when base URL changes (local/custom, debounced) ────────────

  useEffect(() => {
    if (!PROVIDER_NEEDS_URL[draft.type]) return
    if (!draft.baseUrl) return

    const timer = setTimeout(() => {
      const { type, apiKey, baseUrl } = draftRef.current
      void doFetch(type, apiKey, baseUrl)
    }, 900)

    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft.baseUrl, doFetch])

  // ── Provider change ───────────────────────────────────────────────────────

  function handleProviderChange(type: ProviderType): void {
    setDraft({
      type,
      apiKey: '',
      baseUrl: PROVIDER_DEFAULT_URLS[type] ?? '',
      model: PROVIDER_DEFAULT_MODELS[type],
    })
    setSaveError('')
    setSaved(false)
  }

  function patch(fields: Partial<ProviderConfig>): void {
    setDraft((d) => ({ ...d, ...fields }))
  }

  // ── Test connection ───────────────────────────────────────────────────────

  async function handleTest(): Promise<void> {
    if (!draft.model) return
    setTest({ status: 'testing', latencyMs: 0, response: '', error: '' })
    try {
      const result = await window.api.generate.testConnection(draft)
      if (result.success) {
        setTest({ status: 'ok', latencyMs: result.latencyMs, response: result.response ?? '', error: '' })
      } else {
        setTest({ status: 'error', latencyMs: result.latencyMs, response: '', error: result.error ?? 'Unknown error' })
      }
    } catch (err) {
      setTest({
        status: 'error',
        latencyMs: 0,
        response: '',
        error: err instanceof Error ? err.message : 'Test failed',
      })
    }
  }

  // ── Save ──────────────────────────────────────────────────────────────────

  async function handleSave(): Promise<void> {
    if (needsKey && !draft.apiKey.trim()) {
      setSaveError('API key is required for this provider')
      return
    }
    if (needsUrl && !draft.baseUrl.trim()) {
      setSaveError('Base URL is required for this provider')
      return
    }
    if (!draft.model.trim()) {
      setSaveError('Select or enter a model name')
      return
    }
    setSaving(true)
    setSaveError('')
    try {
      const result = await window.api.settings.setConfig({ ...draft, apiKey: draft.apiKey.trim() })
      if (result?.success === false) {
        setSaveError(result.error ?? 'Failed to save')
      } else {
        setProviderConfig({ ...draft, apiKey: draft.apiKey.trim() })
        setSaved(true)
        setTimeout(() => setShowSettings(false), 800)
      }
    } catch {
      setSaveError('Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  const canClose =
    providerConfig.model &&
    (!PROVIDER_NEEDS_KEY[providerConfig.type] || providerConfig.apiKey)

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 border border-slate-700 rounded-xl w-full max-w-lg shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 shrink-0">
          <h2 className="text-lg font-semibold text-slate-100">LLM Provider</h2>
          {canClose && (
            <button
              onClick={() => setShowSettings(false)}
              className="text-slate-500 hover:text-slate-300 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-6 pb-6 space-y-5">

          {/* Provider grid */}
          <div>
            <label className="block text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">
              Provider
            </label>
            <div className="grid grid-cols-3 gap-2">
              {PROVIDER_ORDER.map((type) => (
                <button
                  key={type}
                  onClick={() => handleProviderChange(type)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium border transition-colors text-left leading-tight ${
                    draft.type === type
                      ? 'border-indigo-500 bg-indigo-900/40 text-indigo-200'
                      : 'border-slate-600 text-slate-400 hover:border-slate-500 hover:text-slate-300 hover:bg-slate-700/40'
                  }`}
                >
                  {PROVIDER_LABELS[type]}
                </button>
              ))}
            </div>
            {PROVIDER_HINTS[draft.type] && (
              <p className="mt-2 text-xs text-slate-500">{PROVIDER_HINTS[draft.type]}</p>
            )}
          </div>

          {/* Base URL */}
          {needsUrl && (
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1.5">Base URL</label>
              <input
                type="text"
                value={draft.baseUrl}
                onChange={(e) => patch({ baseUrl: e.target.value })}
                placeholder={PROVIDER_DEFAULT_URLS[draft.type] ?? 'http://localhost:1234/v1'}
                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2.5 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500"
              />
            </div>
          )}

          {/* API Key */}
          {(needsKey || draft.type === 'custom') && (
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1.5">
                API Key{!needsKey && ' (optional)'}
              </label>
              <input
                type="password"
                value={draft.apiKey}
                onChange={(e) => patch({ apiKey: e.target.value })}
                placeholder={needsKey ? 'sk-...' : 'Optional'}
                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2.5 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500"
              />
              <p className="mt-1 text-xs text-slate-600">
                Stored encrypted on this device — never leaves your machine.
              </p>
            </div>
          )}

          {/* Model selector */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-sm font-medium text-slate-400">Model</label>
              <div className="flex items-center gap-2">
                {fetch.status === 'fetching' && (
                  <span className="flex items-center gap-1 text-xs text-slate-500">
                    <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                    </svg>
                    Fetching…
                  </span>
                )}
                {fetch.status === 'ok' && (
                  <span className="text-xs text-emerald-400">
                    ✓ {fetch.models.length} models
                  </span>
                )}
                {fetch.status === 'error' && !needsUrl && (
                  <span className="text-xs text-slate-600">Using preset list</span>
                )}
                {fetch.status === 'error' && needsUrl && (
                  <span className="text-xs text-red-400" title={fetch.error}>
                    ✗ Can't reach server
                  </span>
                )}
                <button
                  onClick={() => doFetch(draft.type, draft.apiKey, draft.baseUrl || PROVIDER_DEFAULT_URLS[draft.type] || '')}
                  disabled={fetch.status === 'fetching'}
                  className="text-xs text-indigo-400 hover:text-indigo-300 disabled:opacity-40 transition-colors"
                >
                  ↻ Refresh
                </button>
              </div>
            </div>

            {displayModels.length > 0 ? (
              <select
                value={draft.model}
                onChange={(e) => patch({ model: e.target.value })}
                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-indigo-500 appearance-none"
              >
                {displayModels.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            ) : (
              <div>
                <input
                  type="text"
                  list="model-suggestions"
                  value={draft.model}
                  onChange={(e) => patch({ model: e.target.value })}
                  placeholder={
                    draft.type === 'ollama'
                      ? 'e.g. llama3.2  (or click Refresh to auto-detect)'
                      : 'Model name or ID'
                  }
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2.5 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                />
                {draft.type === 'ollama' && (
                  <datalist id="model-suggestions">
                    {OLLAMA_SUGGESTIONS.map((m) => <option key={m} value={m} />)}
                  </datalist>
                )}
              </div>
            )}
          </div>

          {/* Test connection */}
          <div>
            <button
              onClick={handleTest}
              disabled={test.status === 'testing' || !draft.model}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg border border-slate-600 text-slate-300 hover:border-indigo-500 hover:text-indigo-300 hover:bg-indigo-900/10 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-sm font-medium"
            >
              {test.status === 'testing' ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                  </svg>
                  Testing connection…
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  Test Connection
                </>
              )}
            </button>

            {test.status === 'ok' && (
              <div className="mt-2 px-3 py-2.5 bg-emerald-900/20 border border-emerald-800/50 rounded-lg">
                <div className="flex items-center gap-2 text-sm text-emerald-400 font-medium mb-0.5">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Connected — {test.latencyMs}ms
                </div>
                <p className="text-xs text-emerald-600">
                  Model responded: <span className="text-emerald-400">"{test.response}"</span>
                </p>
              </div>
            )}

            {test.status === 'error' && (
              <div className="mt-2 px-3 py-2.5 bg-red-900/20 border border-red-800/50 rounded-lg">
                <div className="flex items-center gap-2 text-sm text-red-400 font-medium mb-0.5">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  Connection failed
                </div>
                <p className="text-xs text-red-500 break-all">{test.error}</p>
              </div>
            )}
          </div>

          {/* Save errors / success */}
          {saveError && (
            <p className="text-sm text-red-400 bg-red-900/20 px-3 py-2 rounded-lg">{saveError}</p>
          )}
          {saved && (
            <p className="text-sm text-emerald-400 bg-emerald-900/20 px-3 py-2 rounded-lg">
              ✓ Settings saved
            </p>
          )}
        </div>

        {/* Footer buttons */}
        <div className="px-6 pb-6 flex gap-2 shrink-0">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-medium py-2.5 rounded-lg transition-colors"
          >
            {saving ? 'Saving…' : 'Save Settings'}
          </button>
          {canClose && (
            <button
              onClick={() => setShowSettings(false)}
              className="px-4 py-2.5 text-sm text-slate-400 hover:text-slate-200 border border-slate-600 hover:border-slate-500 rounded-lg transition-colors"
            >
              Cancel
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
