import { useState } from 'react'
import { useStore } from '../store/useStore'
import type { Prompt } from '@shared/index'

function promptsToCsv(prompts: Prompt[]): string {
  const header = 'id,cluster,trust_word,persona,tags,text'
  const rows = prompts.map((p) =>
    [
      p.id,
      `"${p.cluster.replace(/"/g, '""')}"`,
      p.trustWord,
      p.persona ?? '',
      `"${p.tags.join(', ')}"`,
      `"${p.text.replace(/"/g, '""')}"`,
    ].join(',')
  )
  return [header, ...rows].join('\n')
}

function promptsToJson(prompts: Prompt[], session: { url: string; category: string } | null): string {
  return JSON.stringify(
    {
      source: session?.url ?? '',
      category: session?.category ?? '',
      generated: new Date().toISOString(),
      total: prompts.length,
      prompts: prompts.map((p) => ({
        text: p.text,
        cluster: p.cluster,
        trustWord: p.trustWord,
        persona: p.persona,
        tags: p.tags,
      })),
    },
    null,
    2
  )
}

function promptsToTxt(prompts: Prompt[]): string {
  return prompts.map((p) => p.text).join('\n')
}

function downloadFile(content: string, filename: string, mime: string): void {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

interface Props {
  visiblePrompts: Prompt[]
}

export default function ExportPanel({ visiblePrompts }: Props): JSX.Element {
  const { currentSession } = useStore()
  const [copied, setCopied] = useState(false)

  const sessionInfo = currentSession
    ? { url: currentSession.url, category: currentSession.category }
    : null

  const slug = (currentSession?.url ?? 'prompts')
    .replace(/https?:\/\//, '')
    .replace(/[^a-z0-9]/gi, '-')
    .slice(0, 30)

  function handleCsv(): void {
    downloadFile(promptsToCsv(visiblePrompts), `${slug}-prompts.csv`, 'text/csv')
  }

  function handleJson(): void {
    downloadFile(promptsToJson(visiblePrompts, sessionInfo), `${slug}-prompts.json`, 'application/json')
  }

  function handleTxt(): void {
    downloadFile(promptsToTxt(visiblePrompts), `${slug}-prompts.txt`, 'text/plain')
  }

  async function handleCopy(): Promise<void> {
    await navigator.clipboard.writeText(promptsToTxt(visiblePrompts))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const btnClass =
    'px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-600 text-slate-300 hover:text-white hover:border-slate-500 hover:bg-slate-700 transition-colors'

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-slate-500 mr-1">{visiblePrompts.length} prompts</span>
      <button onClick={handleCsv} className={btnClass}>CSV</button>
      <button onClick={handleJson} className={btnClass}>JSON</button>
      <button onClick={handleTxt} className={btnClass}>TXT</button>
      <button
        onClick={handleCopy}
        className={`${btnClass} ${copied ? 'border-emerald-600 text-emerald-400' : ''}`}
      >
        {copied ? '✓ Copied' : 'Copy All'}
      </button>
    </div>
  )
}
