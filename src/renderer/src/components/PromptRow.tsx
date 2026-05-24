import { useState, useRef, useEffect } from 'react'
import { useStore } from '../store/useStore'
import type { Prompt } from '@shared/index'

interface Props {
  prompt: Prompt
}

const CLUSTER_COLORS: Record<number, string> = {
  0: 'bg-indigo-900/50 text-indigo-300',
  1: 'bg-purple-900/50 text-purple-300',
  2: 'bg-cyan-900/50 text-cyan-300',
  3: 'bg-emerald-900/50 text-emerald-300',
  4: 'bg-amber-900/50 text-amber-300',
  5: 'bg-rose-900/50 text-rose-300',
  6: 'bg-sky-900/50 text-sky-300',
  7: 'bg-teal-900/50 text-teal-300',
}

const clusterColorCache = new Map<string, string>()
let colorIndex = 0

function getClusterColor(cluster: string): string {
  if (!clusterColorCache.has(cluster)) {
    clusterColorCache.set(cluster, CLUSTER_COLORS[colorIndex % 8])
    colorIndex++
  }
  return clusterColorCache.get(cluster)!
}

export default function PromptRow({ prompt }: Props): JSX.Element {
  const { updatePrompt } = useStore()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(prompt.text)
  const [addingTag, setAddingTag] = useState(false)
  const [tagDraft, setTagDraft] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (editing && textareaRef.current) {
      textareaRef.current.focus()
      textareaRef.current.select()
    }
  }, [editing])

  async function saveEdit(): Promise<void> {
    const trimmed = draft.trim()
    if (!trimmed || trimmed === prompt.text) {
      setEditing(false)
      setDraft(prompt.text)
      return
    }
    updatePrompt(prompt.id, { text: trimmed, edited: true })
    await window.api.db.updatePrompt(prompt.id, { text: trimmed })
    setEditing(false)
  }

  async function handleDelete(): Promise<void> {
    updatePrompt(prompt.id, { deleted: true })
    await window.api.db.updatePrompt(prompt.id, { deleted: true })
  }

  async function handleRestore(): Promise<void> {
    updatePrompt(prompt.id, { deleted: false })
    await window.api.db.updatePrompt(prompt.id, { deleted: false })
  }

  async function addTag(): Promise<void> {
    const tag = tagDraft.trim()
    if (!tag || prompt.tags.includes(tag)) {
      setAddingTag(false)
      setTagDraft('')
      return
    }
    const newTags = [...prompt.tags, tag]
    updatePrompt(prompt.id, { tags: newTags })
    await window.api.db.updatePrompt(prompt.id, { tags: newTags })
    setTagDraft('')
    setAddingTag(false)
  }

  async function removeTag(tag: string): Promise<void> {
    const newTags = prompt.tags.filter((t) => t !== tag)
    updatePrompt(prompt.id, { tags: newTags })
    await window.api.db.updatePrompt(prompt.id, { tags: newTags })
  }

  const clusterColor = getClusterColor(prompt.cluster)

  return (
    <tr
      className={`border-b border-slate-800 hover:bg-slate-800/40 transition-colors group ${
        prompt.deleted ? 'opacity-40' : ''
      }`}
    >
      {/* Cluster */}
      <td className="px-3 py-2.5 w-36 shrink-0">
        <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium truncate max-w-full ${clusterColor}`}>
          {prompt.cluster}
        </span>
      </td>

      {/* Prompt text */}
      <td className="px-3 py-2.5" onDoubleClick={() => !prompt.deleted && setEditing(true)}>
        {editing ? (
          <textarea
            ref={textareaRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={saveEdit}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                saveEdit()
              }
              if (e.key === 'Escape') {
                setEditing(false)
                setDraft(prompt.text)
              }
            }}
            className="w-full bg-slate-700 border border-indigo-500 rounded px-2 py-1 text-sm text-slate-100 resize-none focus:outline-none"
            rows={3}
          />
        ) : (
          <span className="text-sm text-slate-200 leading-relaxed">{prompt.text}</span>
        )}
        {prompt.edited && !editing && (
          <span className="ml-2 text-xs text-slate-600">edited</span>
        )}
      </td>

      {/* Trust word */}
      <td className="px-3 py-2.5 w-28 text-center">
        <span className="text-xs text-amber-400 font-medium">{prompt.trustWord}</span>
      </td>

      {/* Persona */}
      <td className="px-3 py-2.5 w-28">
        {prompt.persona ? (
          <span className="text-xs text-slate-400">{prompt.persona}</span>
        ) : (
          <span className="text-xs text-slate-700">—</span>
        )}
      </td>

      {/* Tags */}
      <td className="px-3 py-2.5 w-44">
        <div className="flex flex-wrap gap-1">
          {prompt.tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-slate-700 rounded text-xs text-slate-300 group/tag"
            >
              {tag}
              <button
                onClick={() => removeTag(tag)}
                className="opacity-0 group-hover/tag:opacity-100 text-slate-500 hover:text-red-400 transition-opacity"
              >
                ×
              </button>
            </span>
          ))}
          {addingTag ? (
            <input
              autoFocus
              value={tagDraft}
              onChange={(e) => setTagDraft(e.target.value)}
              onBlur={addTag}
              onKeyDown={(e) => {
                if (e.key === 'Enter') addTag()
                if (e.key === 'Escape') { setAddingTag(false); setTagDraft('') }
              }}
              className="w-20 bg-slate-700 border border-indigo-500 rounded px-1.5 py-0.5 text-xs text-slate-100 focus:outline-none"
              placeholder="tag…"
            />
          ) : (
            !prompt.deleted && (
              <button
                onClick={() => setAddingTag(true)}
                className="text-xs text-slate-700 hover:text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                + tag
              </button>
            )
          )}
        </div>
      </td>

      {/* Actions */}
      <td className="px-3 py-2.5 w-16 text-right">
        {prompt.deleted ? (
          <button
            onClick={handleRestore}
            className="text-xs text-slate-600 hover:text-emerald-400 transition-colors"
          >
            Restore
          </button>
        ) : (
          <button
            onClick={handleDelete}
            className="text-slate-700 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </td>
    </tr>
  )
}
