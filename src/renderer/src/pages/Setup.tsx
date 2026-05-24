import { useEffect, useState } from 'react'
import { useStore } from '../store/useStore'
import CrawlProgress from '../components/CrawlProgress'
import { CATEGORIES, INDUSTRY_PERSONAS, PROVIDER_NEEDS_KEY, type PersonaDef } from '@shared/index'

export default function Setup(): JSX.Element {
  const {
    url, setUrl,
    category, setCategory,
    customCategory, setCustomCategory,
    selectedPersonas, togglePersona, clearPersonas,
    crawling, setCrawling,
    crawlProgress, setCrawlProgress,
    crawledPages, setCrawledPages,
    generating, setGenerating,
    generatingPersona, setGeneratingPersona,
    setPrompts, setClusters, setCurrentSession,
    providerConfig, setShowSettings,
    setPage, setError, error,
  } = useStore()

  const [customPersonas, setCustomPersonas] = useState<PersonaDef[]>([])
  const [showCustomInput, setShowCustomInput] = useState(false)
  const [customInputValue, setCustomInputValue] = useState('')

  const isCustomCategory = !CATEGORIES.includes(category as typeof CATEGORIES[number])

  useEffect(() => {
    const unsub = window.api.on.crawlProgress((progress) => {
      setCrawlProgress(progress)
    })
    return unsub
  }, [setCrawlProgress])

  const effectiveCategory = isCustomCategory ? customCategory || category : category
  const personaList: PersonaDef[] = INDUSTRY_PERSONAS[effectiveCategory] ?? []
  const isRunning = crawling || generating || generatingPersona

  const providerReady =
    !PROVIDER_NEEDS_KEY[providerConfig.type] || Boolean(providerConfig.apiKey)

  async function handleStart(): Promise<void> {
    if (!url.trim()) return
    if (!providerReady) {
      setShowSettings(true)
      return
    }

    setError(null)
    setCrawlProgress(null)
    setCrawledPages([])
    setCrawling(true)

    // Step 1: Crawl
    const crawlResult = await window.api.crawl.start(url.trim())

    if (!crawlResult.success) {
      setCrawling(false)
      setError(crawlResult.error ?? 'Crawl failed')
      return
    }

    const pages = crawlResult.pages
    setCrawledPages(pages)
    setCrawling(false)

    // Step 2: Generate base prompts
    setGenerating(true)
    const genResult = await window.api.generate.prompts(pages, effectiveCategory)

    if (!genResult.success) {
      setGenerating(false)
      setError(genResult.error ?? 'Generation failed')
      return
    }

    let allPrompts = genResult.prompts
    const clusters = genResult.clusters

    // Step 3: Apply persona filter if selected
    if (selectedPersonas.length > 0) {
      setGenerating(false)
      setGeneratingPersona(true)

      const activePersonas = [...personaList, ...customPersonas].filter((p) =>
        selectedPersonas.includes(p.id)
      )
      const basePrompts = allPrompts.map(({ text, cluster, trustWord }) => ({ text, cluster, trustWord }))

      const personaResult = await window.api.generate.persona(
        basePrompts,
        activePersonas,
        effectiveCategory
      )

      if (personaResult.success) {
        allPrompts = [...allPrompts, ...(personaResult.prompts ?? [])]
      }
      setGeneratingPersona(false)
    } else {
      setGenerating(false)
    }

    // Step 4: Save to DB
    const saveResult = await window.api.db.save(
      { url: url.trim(), category: effectiveCategory },
      clusters,
      allPrompts
    )

    if (!saveResult.success) {
      setError(saveResult.error ?? 'Failed to save')
      return
    }

    // Step 5: Load full session and go to Library
    const session = await window.api.db.load(saveResult.sessionId!)
    if (session) {
      setCurrentSession(session)
      setClusters(session.clusters)
      setPrompts(session.prompts)
      setPage('library')
    }
  }

  function handleAddCustomPersona(): void {
    const label = customInputValue.trim()
    if (!label) return
    const id = `custom-${Date.now()}`
    const persona: PersonaDef = { id, label, description: label }
    setCustomPersonas((prev) => [...prev, persona])
    togglePersona(id)
    setCustomInputValue('')
    setShowCustomInput(false)
  }

  async function handleCancel(): Promise<void> {
    await window.api.crawl.cancel(url.trim())
    setCrawling(false)
    setCrawlProgress(null)
  }

  const canStart = url.trim() && !isRunning && (isCustomCategory ? customCategory.trim() : true)

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-2xl mx-auto px-6 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-slate-100 mb-1.5">New Prompt Library</h1>
          <p className="text-slate-500 text-sm">
            Enter a website URL and industry category. The app crawls the site, extracts topics,
            and generates 50+ AI-ready customer questions.
          </p>
        </div>

        {/* URL Input */}
        <div className="mb-5">
          <label className="block text-sm font-medium text-slate-400 mb-1.5">Website URL</label>
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://www.example.com"
            disabled={isRunning}
            className="w-full bg-slate-800 border border-slate-600 rounded-lg px-4 py-3 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 disabled:opacity-50 text-sm"
          />
        </div>

        {/* Category */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-slate-400 mb-1.5">
            Industry Category
          </label>
          <select
            value={isCustomCategory ? 'custom' : category}
            onChange={(e) => {
              if (e.target.value === 'custom') {
                setCategory('custom')
              } else {
                setCategory(e.target.value)
                setCustomCategory('')
              }
              setCustomPersonas([])
              clearPersonas()
            }}
            disabled={isRunning}
            className="w-full bg-slate-800 border border-slate-600 rounded-lg px-4 py-3 text-slate-100 focus:outline-none focus:border-indigo-500 disabled:opacity-50 text-sm appearance-none"
          >
            {CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
            <option value="custom">Custom…</option>
          </select>
          {(category === 'custom' || isCustomCategory) && (
            <input
              type="text"
              value={customCategory}
              onChange={(e) => setCustomCategory(e.target.value)}
              placeholder="e.g. Luxury Yacht Charter"
              disabled={isRunning}
              className="w-full mt-2 bg-slate-800 border border-slate-600 rounded-lg px-4 py-3 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500 disabled:opacity-50 text-sm"
            />
          )}
        </div>

        {/* Personas */}
        <div className="mb-8">
          <label className="block text-sm font-medium text-slate-400 mb-1.5">
            Personas <span className="text-slate-600 font-normal">(optional)</span>
          </label>
          <p className="text-xs text-slate-600 mb-3">
            Prompts will be rewritten to match each selected persona's language and priorities.
          </p>

          {/* Dropdown */}
          <select
            value=""
            onChange={(e) => {
              const val = e.currentTarget.value
              e.currentTarget.value = ''
              if (!val) return
              if (val === '__add_new__') {
                setShowCustomInput(true)
                return
              }
              if (!selectedPersonas.includes(val)) togglePersona(val)
            }}
            disabled={isRunning}
            className="w-full bg-slate-800 border border-slate-600 rounded-lg px-4 py-3 text-slate-400 focus:outline-none focus:border-indigo-500 disabled:opacity-50 text-sm appearance-none"
          >
            <option value="" disabled>Select a persona to add…</option>
            {personaList.filter((p) => !selectedPersonas.includes(p.id)).map((p) => (
              <option key={p.id} value={p.id}>{p.label} — {p.description}</option>
            ))}
            <option value="__add_new__">+ Add new persona…</option>
          </select>

          {/* Custom persona input */}
          {showCustomInput && (
            <div className="flex gap-2 mt-2">
              <input
                type="text"
                value={customInputValue}
                onChange={(e) => setCustomInputValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAddCustomPersona()
                  if (e.key === 'Escape') { setShowCustomInput(false); setCustomInputValue('') }
                }}
                placeholder="e.g. Eco Traveller"
                autoFocus
                className="flex-1 bg-slate-800 border border-slate-600 rounded-lg px-3 py-2.5 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500"
              />
              <button
                onClick={handleAddCustomPersona}
                disabled={!customInputValue.trim()}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-sm font-medium rounded-lg transition-colors"
              >
                Add
              </button>
              <button
                onClick={() => { setShowCustomInput(false); setCustomInputValue('') }}
                className="px-3 py-2 text-slate-500 hover:text-slate-300 text-sm transition-colors"
              >
                Cancel
              </button>
            </div>
          )}

          {/* Selected chips */}
          {selectedPersonas.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3">
              {[...personaList, ...customPersonas]
                .filter((p) => selectedPersonas.includes(p.id))
                .map((p) => (
                  <span
                    key={p.id}
                    className="flex items-center gap-1.5 px-3 py-1 bg-indigo-900/30 border border-indigo-700 rounded-full text-sm text-indigo-300"
                  >
                    {p.label}
                    <button
                      onClick={() => {
                        togglePersona(p.id)
                        if (p.id.startsWith('custom-')) {
                          setCustomPersonas((prev) => prev.filter((c) => c.id !== p.id))
                        }
                      }}
                      disabled={isRunning}
                      className="text-indigo-500 hover:text-indigo-200 disabled:opacity-40 leading-none"
                      aria-label={`Remove ${p.label}`}
                    >
                      ×
                    </button>
                  </span>
                ))}
              <button
                onClick={() => { setCustomPersonas([]); useStore.getState().clearPersonas() }}
                disabled={isRunning}
                className="text-xs text-slate-600 hover:text-slate-400 disabled:opacity-40 transition-colors self-center"
              >
                Clear all
              </button>
            </div>
          )}
        </div>

        {!providerReady && (
          <div className="mb-5 p-3 bg-amber-900/20 border border-amber-800 rounded-lg text-sm text-amber-400 flex items-center gap-2">
            <span>No LLM configured.</span>
            <button onClick={() => setShowSettings(true)} className="underline hover:text-amber-300">
              Open Settings
            </button>
          </div>
        )}

        {error && (
          <div className="mb-5 p-3 bg-red-900/20 border border-red-800 rounded-lg text-sm text-red-400">
            {error}
          </div>
        )}

        {(crawling || crawlProgress || generating || generatingPersona) && (
          <div className="mb-5">
            <CrawlProgress onCancel={handleCancel} />
          </div>
        )}

        {!isRunning && (
          <button
            onClick={handleStart}
            disabled={!canStart || !providerReady}
            className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-colors text-sm"
          >
            Analyze & Generate Prompt Library
          </button>
        )}
      </div>
    </div>
  )
}
