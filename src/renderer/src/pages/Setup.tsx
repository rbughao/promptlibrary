import { useEffect, useState } from 'react'
import { useStore } from '../store/useStore'
import CrawlProgress from '../components/CrawlProgress'
import CrawlReview from '../components/CrawlReview'
import {
  CATEGORIES, CRAWL_LIMITS, INDUSTRY_PERSONAS, PROVIDER_NEEDS_KEY,
  clampCrawlOptions, type PersonaDef, type RawTerm,
} from '@shared/index'

export default function Setup(): JSX.Element {
  const {
    url, setUrl,
    category, setCategory,
    customCategory, setCustomCategory,
    selectedPersonas, togglePersona, clearPersonas,
    pipelineStage, setPipelineStage,
    crawlMaxPages, setCrawlMaxPages,
    crawlMaxDepth, setCrawlMaxDepth,
    crawling, setCrawling,
    setCrawlProgress,
    crawledPages, setCrawledPages,
    excludedUrls, toggleExcludedUrl, setExcludedUrls,
    generating, setGenerating,
    generatingPersona, setGeneratingPersona,
    setGenerateProgress,
    setPrompts, setClusters, setCurrentSession,
    providerConfig, setShowSettings,
    setPage, setError, error, setWarnings,
  } = useStore()

  const [customPersonas, setCustomPersonas] = useState<PersonaDef[]>([])
  const [showCustomInput, setShowCustomInput] = useState(false)
  const [customInputValue, setCustomInputValue] = useState('')
  const [terms, setTerms] = useState<RawTerm[]>([])
  const [termsLoading, setTermsLoading] = useState(false)

  const isCustomCategory = !CATEGORIES.includes(category as typeof CATEGORIES[number])

  useEffect(() => {
    const unsub = window.api.on.crawlProgress((progress) => {
      setCrawlProgress(progress)
    })
    return unsub
  }, [setCrawlProgress])

  useEffect(() => {
    const unsub = window.api.on.generateProgress((progress) => {
      setGenerateProgress(progress)
    })
    return unsub
  }, [setGenerateProgress])

  // Terms are a preview only — a failure here must not block generation.
  useEffect(() => {
    if (pipelineStage !== 'crawled' || crawledPages.length === 0) return
    let cancelled = false
    setTermsLoading(true)
    window.api.generate
      .terms(crawledPages)
      .then((res) => {
        if (!cancelled) setTerms(res.success ? res.terms : [])
      })
      .catch(() => {
        if (!cancelled) setTerms([])
      })
      .finally(() => {
        if (!cancelled) setTermsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [pipelineStage, crawledPages])

  const effectiveCategory = isCustomCategory ? customCategory || category : category
  const personaList: PersonaDef[] = INDUSTRY_PERSONAS[effectiveCategory] ?? []
  const isRunning = crawling || generating || generatingPersona
  const inReview = pipelineStage === 'crawled'
  // The URL and the page budget only shape the crawl, so once pages are in hand
  // they are locked until the user chooses to re-crawl.
  const crawlFieldsLocked = isRunning || inReview

  const providerReady =
    !PROVIDER_NEEDS_KEY[providerConfig.type] || Boolean(providerConfig.apiKey)

  async function handleCrawl(): Promise<void> {
    if (!url.trim()) return

    setError(null)
    setWarnings([])
    setCrawlProgress(null)
    setGenerateProgress(null)
    setCrawledPages([])
    setExcludedUrls([])
    setTerms([])
    setPipelineStage('crawling')
    setCrawling(true)

    const result = await window.api.crawl.start(
      url.trim(),
      clampCrawlOptions({ maxPages: crawlMaxPages, maxDepth: crawlMaxDepth })
    )
    setCrawling(false)

    if (!result.success) {
      setPipelineStage('idle')
      setError(result.error ?? 'Crawl failed')
      return
    }

    setCrawledPages(result.pages)
    setPipelineStage('crawled')
  }

  async function handleGenerate(): Promise<void> {
    if (!providerReady) {
      setShowSettings(true)
      return
    }

    const pages = crawledPages.filter((p) => !excludedUrls.includes(p.url))
    if (pages.length === 0) return

    setError(null)
    setWarnings([])
    setGenerateProgress(null)
    setPipelineStage('generating')
    setGenerating(true)

    // Step 1: Generate base prompts
    const genResult = await window.api.generate.prompts(pages, effectiveCategory)

    if (!genResult.success) {
      setGenerating(false)
      // The crawl is still good — go back to review so the user can change
      // model or settings and generate again without re-crawling.
      setPipelineStage('crawled')
      setError(genResult.error ?? 'Generation failed')
      return
    }

    let allPrompts = genResult.prompts
    const clusters = genResult.clusters

    // Step 2: Apply persona filter if selected
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
        // Some personas may still have failed — keep the library, report them.
        setWarnings(personaResult.warnings ?? [])
      } else {
        // The base library is still good, so save it and surface the problem
        // rather than discarding a successful crawl and generation.
        setWarnings([
          personaResult.error ?? 'Persona generation failed.',
          ...(personaResult.warnings ?? []),
        ])
      }
      setGeneratingPersona(false)
    } else {
      setGenerating(false)
    }

    // Step 3: Save to DB
    const saveResult = await window.api.db.save(
      { url: url.trim(), category: effectiveCategory, pageCount: pages.length },
      clusters,
      allPrompts
    )

    if (!saveResult.success) {
      setPipelineStage('crawled')
      setError(saveResult.error ?? 'Failed to save')
      return
    }

    // Step 4: Load full session and go to Library
    const session = await window.api.db.load(saveResult.sessionId!)
    if (!session) {
      setPipelineStage('crawled')
      setError('The library was saved but could not be loaded. Open it from History.')
      return
    }

    setCurrentSession(session)
    setClusters(session.clusters)
    setPrompts(session.prompts)
    setPipelineStage('idle')
    setPage('library')
  }

  function handleRecrawl(): void {
    setCrawledPages([])
    setExcludedUrls([])
    setTerms([])
    setCrawlProgress(null)
    setError(null)
    setPipelineStage('idle')
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
    setPipelineStage('idle')
  }

  const canCrawl = url.trim() && !isRunning && (isCustomCategory ? customCategory.trim() : true)
  const canGenerate = Boolean(
    !isRunning && providerReady && (isCustomCategory ? customCategory.trim() : true)
  )

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-2xl mx-auto px-6 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-slate-100 mb-1.5">New Prompt Library</h1>
          <p className="text-slate-500 text-sm">
            Enter a website URL and industry category. The app crawls the site first, so you can
            review what was found before spending time on generation.
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
            disabled={crawlFieldsLocked}
            className="w-full bg-slate-800 border border-slate-600 rounded-lg px-4 py-3 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 disabled:opacity-50 text-sm"
          />
        </div>

        {/* Crawl budget */}
        <div className="mb-5 flex gap-3">
          <div className="flex-1">
            <label className="block text-sm font-medium text-slate-400 mb-1.5">Max pages</label>
            <input
              type="number"
              min={CRAWL_LIMITS.minPages}
              max={CRAWL_LIMITS.maxPages}
              value={crawlMaxPages}
              onChange={(e) => {
                const n = parseInt(e.target.value, 10)
                if (!Number.isNaN(n)) setCrawlMaxPages(n)
              }}
              onBlur={() =>
                setCrawlMaxPages(clampCrawlOptions({ maxPages: crawlMaxPages }).maxPages)
              }
              disabled={crawlFieldsLocked}
              className="w-full bg-slate-800 border border-slate-600 rounded-lg px-4 py-2.5 text-slate-100 focus:outline-none focus:border-indigo-500 disabled:opacity-50 text-sm"
            />
            <p className="text-xs text-slate-600 mt-1">
              {CRAWL_LIMITS.minPages}–{CRAWL_LIMITS.maxPages}
            </p>
          </div>
          <div className="flex-1">
            <label className="block text-sm font-medium text-slate-400 mb-1.5">Max depth</label>
            <input
              type="number"
              min={CRAWL_LIMITS.minDepth}
              max={CRAWL_LIMITS.maxDepth}
              value={crawlMaxDepth}
              onChange={(e) => {
                const n = parseInt(e.target.value, 10)
                if (!Number.isNaN(n)) setCrawlMaxDepth(n)
              }}
              onBlur={() =>
                setCrawlMaxDepth(clampCrawlOptions({ maxDepth: crawlMaxDepth }).maxDepth)
              }
              disabled={crawlFieldsLocked}
              className="w-full bg-slate-800 border border-slate-600 rounded-lg px-4 py-2.5 text-slate-100 focus:outline-none focus:border-indigo-500 disabled:opacity-50 text-sm"
            />
            <p className="text-xs text-slate-600 mt-1">
              Links to follow from the start page ({CRAWL_LIMITS.minDepth}–{CRAWL_LIMITS.maxDepth})
            </p>
          </div>
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
            {inReview && crawledPages.length > 0 && (
              <span className="block mt-1 text-red-300/80">
                The crawl has been kept. Adjust your settings and generate again.
              </span>
            )}
          </div>
        )}

        {(crawling || generating || generatingPersona) && (
          <div className="mb-5">
            <CrawlProgress onCancel={handleCancel} />
          </div>
        )}

        {inReview && (
          <CrawlReview
            url={url.trim()}
            pages={crawledPages}
            excluded={excludedUrls}
            terms={terms}
            termsLoading={termsLoading}
            canGenerate={canGenerate}
            onToggle={toggleExcludedUrl}
            onIncludeAll={() => setExcludedUrls([])}
            onGenerate={handleGenerate}
            onRecrawl={handleRecrawl}
          />
        )}

        {!isRunning && !inReview && (
          <button
            onClick={handleCrawl}
            disabled={!canCrawl}
            className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-colors text-sm"
          >
            Crawl Website
          </button>
        )}
      </div>
    </div>
  )
}
