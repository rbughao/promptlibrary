import { useMemo, useState } from 'react'
import { useStore } from '../store/useStore'
import PromptRow from '../components/PromptRow'
import ExportPanel from '../components/ExportPanel'
import { INDUSTRY_PERSONAS, TRUST_WORDS } from '@shared/index'
import type { Prompt } from '@shared/index'

export default function Library(): JSX.Element {
  const {
    prompts, clusters, currentSession,
    searchText, setSearchText,
    filterCluster, setFilterCluster,
    filterPersona, setFilterPersona,
    filterTrustWord, setFilterTrustWord,
    showDeleted, setShowDeleted,
    selectedPersonas, setGeneratingPersona,
    setPrompts, setError,
  } = useStore()

  const [rerunning, setRerunning] = useState(false)

  const clusterNames = useMemo(
    () => Array.from(new Set(prompts.map((p) => p.cluster))),
    [prompts]
  )

  const allPersonas = useMemo(() => Object.values(INDUSTRY_PERSONAS).flat(), [])

  const personasInLibrary = useMemo(() => {
    const ids = new Set(prompts.map((p) => p.persona).filter(Boolean) as string[])
    return allPersonas.filter((p) => ids.has(p.id))
  }, [prompts, allPersonas])

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

    try {
      const activePersonas = allPersonas.filter((p) => selectedPersonas.includes(p.id))
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
        return
      }

      const newPrompts = result.prompts ?? []
      if (newPrompts.length > 0) {
        await window.api.db.save(
          { url: currentSession.url, category: currentSession.category },
          clusters,
          newPrompts
        )
        const updated = await window.api.db.load(currentSession.id)
        if (updated) setPrompts(updated.prompts)
      }
    } finally {
      setRerunning(false)
      setGeneratingPersona(false)
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
              <PromptRow key={prompt.id} prompt={prompt} />
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
