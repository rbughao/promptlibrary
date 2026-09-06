import { useStore } from '../store/useStore'

interface Props {
  onCancel: () => void
}

export default function CrawlProgress({ onCancel }: Props): JSX.Element {
  const { crawlProgress, crawledPages, generating, generatingPersona, generateProgress } =
    useStore()

  const pagesVisited = crawlProgress?.pagesVisited ?? 0
  const maxPages = 25
  const progress = Math.min((pagesVisited / maxPages) * 100, 100)

  const isError = crawlProgress?.status === 'error'
  const isDone = crawlProgress?.status === 'complete'

  // Persona rewriting runs one batch at a time across every selected persona,
  // so we can show real progress instead of an indeterminate pulse.
  const gp = generateProgress
  const personaDetail =
    generatingPersona && gp?.stage === 'persona' && gp.personaTotal && gp.batchTotal
      ? {
          label: gp.personaLabel ?? 'Persona',
          personaIndex: gp.personaIndex ?? 1,
          personaTotal: gp.personaTotal,
          batchIndex: gp.batchIndex ?? 1,
          batchTotal: gp.batchTotal,
          percent: Math.round(
            (((gp.personaIndex ?? 1) - 1 + (gp.batchIndex ?? 1) / gp.batchTotal) /
              gp.personaTotal) *
              100
          ),
        }
      : null

  let statusLabel = 'Crawling website…'
  if (generating) statusLabel = 'Generating prompt library…'
  else if (generatingPersona) statusLabel = 'Applying Persona Filter…'
  else if (isDone && !generating) statusLabel = `Crawl complete — ${crawledPages.length} pages analyzed`
  else if (isError) statusLabel = `Error: ${crawlProgress?.error}`

  return (
    <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium text-slate-300">{statusLabel}</span>
        {!isDone && !isError && !generating && !generatingPersona && (
          <button
            onClick={onCancel}
            className="text-xs text-slate-500 hover:text-red-400 transition-colors"
          >
            Cancel
          </button>
        )}
      </div>

      {!generating && !generatingPersona && (
        <div className="mb-4">
          <div className="flex justify-between text-xs text-slate-500 mb-1.5">
            <span>{pagesVisited} pages</span>
            <span>max {maxPages}</span>
          </div>
          <div className="w-full bg-slate-700 rounded-full h-1.5">
            <div
              className={`h-1.5 rounded-full transition-all duration-300 ${
                isError ? 'bg-red-500' : isDone ? 'bg-emerald-500' : 'bg-indigo-500'
              }`}
              style={{ width: `${isDone ? 100 : progress}%` }}
            />
          </div>
        </div>
      )}

      {(generating || generatingPersona) && (
        <div className="mb-4">
          {personaDetail ? (
            <>
              <div className="flex justify-between text-xs text-slate-500 mb-1.5">
                <span>{personaDetail.label}</span>
                <span>
                  persona {personaDetail.personaIndex} of {personaDetail.personaTotal}
                  {' · '}batch {personaDetail.batchIndex}/{personaDetail.batchTotal}
                </span>
              </div>
              <div className="w-full bg-slate-700 rounded-full h-1.5">
                <div
                  className="h-1.5 bg-indigo-500 rounded-full transition-all duration-300"
                  style={{ width: `${personaDetail.percent}%` }}
                />
              </div>
            </>
          ) : (
            <div className="w-full bg-slate-700 rounded-full h-1.5 overflow-hidden">
              <div className="h-1.5 bg-indigo-500 rounded-full animate-pulse w-full" />
            </div>
          )}
        </div>
      )}

      {crawlProgress?.currentUrl && !generating && !generatingPersona && (
        <div className="mt-3 max-h-28 overflow-y-auto space-y-0.5">
          <p className="text-xs text-slate-500 font-mono truncate">
            → {crawlProgress.currentUrl}
          </p>
        </div>
      )}
    </div>
  )
}
