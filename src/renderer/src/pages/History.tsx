import { useEffect } from 'react'
import { useStore } from '../store/useStore'
import type { Session } from '@shared/index'

function formatDate(ts: number): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(ts))
}

function domainOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

export default function History(): JSX.Element {
  const { sessions, setSessions, setCurrentSession, setClusters, setPrompts, setPage } = useStore()

  useEffect(() => {
    window.api.db.list().then(setSessions)
  }, [setSessions])

  async function handleOpen(session: Session): Promise<void> {
    const full = await window.api.db.load(session.id)
    if (full) {
      setCurrentSession(full)
      setClusters(full.clusters)
      setPrompts(full.prompts)
      setPage('library')
    }
  }

  async function handleDelete(id: string, e: React.MouseEvent): Promise<void> {
    e.stopPropagation()
    const result = await window.api.db.delete(id)
    if (result.success) {
      setSessions(sessions.filter((s) => s.id !== id))
    }
  }

  if (sessions.length === 0) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <p className="text-slate-500 text-sm">No saved libraries yet.</p>
          <p className="text-slate-600 text-xs mt-1">Generate your first library in New Library.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-3xl mx-auto px-6 py-8">
        <h1 className="text-xl font-bold text-slate-100 mb-6">Saved Libraries</h1>

        <div className="space-y-3">
          {sessions.map((session) => (
            <div
              key={session.id}
              onClick={() => handleOpen(session)}
              className="group flex items-center gap-4 bg-slate-800/60 hover:bg-slate-800 border border-slate-700 hover:border-slate-600 rounded-xl px-5 py-4 cursor-pointer transition-colors"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-semibold text-slate-200 truncate">
                    {domainOf(session.url)}
                  </span>
                  <span className="text-xs px-2 py-0.5 bg-indigo-900/50 text-indigo-300 rounded-full shrink-0">
                    {session.category}
                  </span>
                </div>
                <p className="text-xs text-slate-600 truncate">{session.url}</p>
                <p className="text-xs text-slate-600 mt-1">
                  {formatDate(session.createdAt)}
                  {session.pageCount > 0 && (
                    <>
                      <span className="mx-1.5 text-slate-700">·</span>
                      {session.pageCount} pages crawled
                    </>
                  )}
                </p>
              </div>

              <div className="shrink-0 text-right">
                <div className="text-lg font-bold text-slate-300">{session.promptCount}</div>
                <div className="text-xs text-slate-600">prompts</div>
              </div>

              <button
                onClick={(e) => handleDelete(session.id, e)}
                className="shrink-0 p-2 text-slate-700 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all rounded-lg hover:bg-slate-700"
                title="Delete session"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  />
                </svg>
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
