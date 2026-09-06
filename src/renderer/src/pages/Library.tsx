import { useMemo, useState } from 'react'
import { useStore } from '../store/useStore'
import PromptRow, { CLUSTER_COLORS } from '../components/PromptRow'
import ExportPanel from '../components/ExportPanel'
import { ALL_PERSONAS, TRUST_WORDS, getPersonaLabel } from '@shared/index'
import type { Prompt } from '@shared/index'

const CLUSTER_TOP_UP_COUNT = 10

export default function Library(): JSX.Element {
  const {
    prompts, currentSession, setCurrentSession,
    searchText, setSearchText,
    filterCluster, setFilterCluster,
    filterPersona, setFilterPersona,
    filterTrustWord, setFilterTrustWord,
    showDeleted, setShowDeleted,
    selectedPersonas, setGeneratingPersona,
    setPrompts, error, setError, warnings, setWarnings,
  } = useStore()

  const [rerunning, setRerunning] = useState(false)
  const [toppingUp, setToppingUp] = useState(false)

  const clusterNames = useMemo(
    () => Array.from(new Set(prompts.map((p) => p.cluster))),
    [prompts]
  )

  // Colours are assigned by position in this session's cluster list, so they
  // are stable while a library is open and reset when another one is loaded.
  const clusterColors = useMemo(() => {
    const map = new Map<string, string>()
    clusterNames.forEach((name, i) => map.set(name, CLUSTER_COLORS[i % CLUSTER_COLORS.length]))
    return map
  }, [clusterNames])

  // Built from the prompts rather than INDUSTRY_PERSONAS so custom personas,
  // which have no entry there, still appear in the filter.
  const personasInLibrary = useMemo(() => {
    const seen = new Map<string, string>()
    for (const p of prompts) {
      if (p.persona && !seen.has(p.persona)) {
        seen.set(p.persona, getPersonaLabel(p.persona, p.personaLabel))
      }
    }
    return Array.from(seen, ([id, label]) => ({ id, label }))
  }, [prompts])

  const trustWordsInLibrary = useMemo(() => {
    const words = new Set(prompts.map((p) => p.trustWord))
    return TRUST_WORDS.filter((w) => words.has(w))
  }, [prompts])

  const visiblePrompts = useMemo<Prompt[]>(() => {
    return prompts.filter((p) => {
      if (!showDeleted && p.deleted) return false
      if (filterCluster && p.cluster !== filterCluster) return false
      if (filterPersona) {
        if (filterPersona === '__base__' && p.persona) return false
        if (filterPersona !== '__base__' && p.persona !== filterPersona) return false
      }
      if (filterTrustWord && p.trustWord !== filterTrustWord) return false
      if (searchText) {
        const q = searchText.toLowerCase()
        if (!p.text.toLowerCase().includes(q) && !p.cluster.toLowerCase().includes(q)) return false
      }
      return true
    })
  }, [prompts, showDeleted, filterCluster, filterPersona, filterTrustWord, searchText])

  async function handleRerunPersonas(): Promise<void> {
    if (!currentSession) return
    setRerunning(true)
    setGeneratingPersona(true)
    setError(null)
    setWarnings([])

    try {
      // Skip personas already present — re-running one would duplicate every prompt.
      const existing = new Set(prompts.map((p) => p.persona).filter(Boolean) as string[])
      const activePersonas = ALL_PERSONAS.filter(
        (p) => selectedPersonas.includes(p.id) && !existing.has(p.id)
      )

      if (activePersonas.length === 0) {
        setError('Those personas are already in this library.')
        return
      }

      const basePrompts = prompts
        .filter((p) => !p.persona && !p.deleted)
        .map(({ text, cluster, trustWord }) => ({ text, cluster, trustWord }))

      const result = await window.api.generate.persona(
        basePrompts,
        activePersonas,
        currentSession.category
      )

      if (!result.success) {
        setError(result.error ?? 'Persona generation failed')
        setWarnings(result.warnings ?? [])
        return
      }

      const newPrompts = result.prompts ?? []
      if (newPrompts.length === 0) {
        setError('The model returned no persona prompts — it may have run out of output tokens.')
        return
      }

      // Partial success: some personas or batches may still have failed.
      setWarnings(result.warnings ?? [])

      const appended = await window.api.db.appendPrompts(currentSession.id, newPrompts)
      if (!appended.success) {
        setError(appended.error ?? 'Failed to save persona prompts')
        return
      }

      const updated = await window.api.db.load(currentSession.id)
      if (updated) {
        setCurrentSession(updated)
        setPrompts(updated.prompts)
      }
    } finally {
      setRerunning(false)
      setGeneratingPersona(false)
    }
  }

  async function handleGenerateInCluster(): Promise<void> {
    if (!currentSession || !filterCluster) return
    setToppingUp(true)
    setError(null)
    setWarnings([])

    try {
      // Deleted prompts are included so the model is not asked to reinvent
      // something the user has already thrown away.
      const existing = prompts.map(({ text, cluster, trustWord }) => ({
        text,
        cluster,
        trustWord,
      }))

      const result = await window.api.generate.cluster(
        filterCluster,
        existing,
        currentSession.category,
        CLUSTER_TOP_UP_COUNT
      )

      if (!result.success) {
        setError(result.error ?? 'Cluster generation failed')
        setWarnings(result.warnings ?? [])
        return
      }

      setWarnings(result.warnings ?? [])

      const appended = await window.api.db.appendPrompts(currentSession.id, result.prompts)
      if (!appended.success) {
        setError(appended.error ?? 'Failed to save the new prompts')
        return
      }

      const updated = await window.api.db.load(currentSession.id)
      if (updated) {
        setCurrentSession(updated)
        setPrompts(updated.prompts)
      }
    } finally {
      setToppingUp(false)
    }
  }

  if (prompts.length === 0) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <p className="text-slate-500 text-sm">No library loaded.</p>
          <p className="text-slate-600 text-xs mt-1">Go to New Library to generate one.</p>
        </div>
      </div>
    )
  }

  const selectClass =
    'bg-slate-800 border border-slate-700 text-slate-300 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-indigo-500'

  return (
    <div className="h-full flex flex-col">
      {/* Header bar */}
      <div className="shrink-0 flex items-center gap-3 px-4 py-2.5 border-b border-slate-800 bg-slate-900">
        {currentSession && (
          <div className="flex-1 min-w-0">
            <p className="text-xs text-slate-500 truncate">
              <span className="text-slate-400 font-medium">{currentSession.url}</span>
              <span className="mx-1.5 text-slate-700">·</span>
              <span>{currentSession.category}</span>
            </p>
          </div>
        )}
        <div className="ml-auto shrink-0">
          <ExportPanel visiblePrompts={visiblePrompts} />
        </div>
      </div>

      {/* Filter bar */}
      <div className="shrink-0 flex items-center gap-2 px-4 py-2 border-b border-slate-800 bg-slate-900/80 flex-wrap">
        <input
          type="text"
          placeholder="Search prompts…"
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          className="bg-slate-800 border border-slate-700 text-slate-300 text-xs rounded-lg px-3 py-1.5 focus:outline-none focus:border-indigo-500 w-48"
        />

        <select value={filterCluster} onChange={(e) => setFilterCluster(e.target.value)} className={selectClass}>
          <option value="">All clusters</option>
          {clusterNames.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>

        {filterCluster && (
          <button
            onClick={handleGenerateInCluster}
            disabled={toppingUp}
            className="text-xs px-3 py-1.5 bg-indigo-700 hover:bg-indigo-600 disabled:opacity-50 text-white rounded-lg transition-colors"
          >
            {toppingUp
              ? 'Generating…'
              : `Generate ${CLUSTER_TOP_UP_COUNT} more in this cluster`}
          </button>
        )}

        {personasInLibrary.length > 0 && (
          <select value={filterPersona} onChange={(e) => setFilterPersona(e.target.value)} className={selectClass}>
            <option value="">All personas</option>
            <option value="__base__">Base (no persona)</option>
            {personasInLibrary.map((p) => (
              <option key={p.id} value={p.id}>{p.label}</option>
            ))}
          </select>
        )}

        <select value={filterTrustWord} onChange={(e) => setFilterTrustWord(e.target.value)} className={selectClass}>
          <option value="">All trust words</option>
          {trustWordsInLibrary.map((w) => (
            <option key={w} value={w}>{w}</option>
          ))}
        </select>

        <label className="flex items-center gap-1.5 text-xs text-slate-500 cursor-pointer">
          <input
            type="checkbox"
            checked={showDeleted}
            onChange={(e) => setShowDeleted(e.target.checked)}
            className="w-3 h-3 accent-indigo-500"
          />
          Show deleted
        </label>

        {selectedPersonas.length > 0 && (
          <button
            onClick={handleRerunPersonas}
            disabled={rerunning}
            className="ml-auto text-xs px-3 py-1.5 bg-indigo-700 hover:bg-indigo-600 disabled:opacity-50 text-white rounded-lg transition-colors"
          >
            {rerunning ? 'Generating…' : 'Re-run Personas'}
          </button>
        )}
      </div>

      {error && (
        <div className="shrink-0 flex items-start gap-2 px-4 py-2.5 bg-red-900/20 border-b border-red-800/60 text-sm text-red-400">
          <span className="flex-1">{error}</span>
          <button
            onClick={() => setError(null)}
            className="shrink-0 text-red-600 hover:text-red-300 transition-colors leading-none"
            aria-label="Dismiss error"
          >
            ×
          </button>
        </div>
      )}

      {warnings.length > 0 && (
        <div className="shrink-0 flex items-start gap-2 px-4 py-2.5 bg-amber-900/20 border-b border-amber-800/60 text-sm text-amber-400">
          <div className="flex-1 space-y-0.5">
            {warnings.map((w, i) => (
              <p key={i}>{w}</p>
            ))}
          </div>
          <button
            onClick={() => setWarnings([])}
            className="shrink-0 text-amber-600 hover:text-amber-300 transition-colors leading-none"
            aria-label="Dismiss warnings"
          >
            ×
          </button>
        </div>
      )}

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full">
          <thead className="sticky top-0 bg-slate-900 z-10">
            <tr className="border-b border-slate-800">
              <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wide w-36">Cluster</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wide">Prompt</th>
              <th className="px-3 py-2 text-center text-xs font-medium text-slate-500 uppercase tracking-wide w-28">Trust Word</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wide w-28">Persona</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wide w-44">Tags</th>
              <th className="px-3 py-2 w-16" />
            </tr>
          </thead>
          <tbody>
            {visiblePrompts.map((prompt) => (
              <PromptRow
                key={prompt.id}
                prompt={prompt}
                clusterColor={clusterColors.get(prompt.cluster)}
              />
            ))}
          </tbody>
        </table>

        {visiblePrompts.length === 0 && (
          <div className="flex items-center justify-center h-32">
            <p className="text-slate-600 text-sm">No prompts match the current filters.</p>
          </div>
        )}
      </div>
    </div>
  )
}
