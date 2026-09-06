import type { PageContent, RawTerm } from '@shared/index'

interface Props {
  url: string
  pages: PageContent[]
  excluded: string[]
  terms: RawTerm[]
  termsLoading: boolean
  canGenerate: boolean
  onToggle: (pageUrl: string) => void
  onIncludeAll: () => void
  onGenerate: () => void
  onRecrawl: () => void
}

/** Show the path so a long list of pages stays readable; fall back to the raw
 *  URL if it will not parse. */
function shortPath(raw: string): string {
  try {
    const u = new URL(raw)
    return u.pathname === '/' ? '/' : u.pathname + u.search
  } catch {
    return raw
  }
}

export default function CrawlReview({
  url,
  pages,
  excluded,
  terms,
  termsLoading,
  canGenerate,
  onToggle,
  onIncludeAll,
  onGenerate,
  onRecrawl,
}: Props): JSX.Element {
  const includedCount = pages.length - excluded.length
  const topTerms = terms.slice(0, 25)

  return (
    <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-5 mb-5">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div className="min-w-0">
          <h2 className="text-sm font-medium text-slate-300">
            Crawl complete — {pages.length} {pages.length === 1 ? 'page' : 'pages'} found
          </h2>
          <p className="text-xs text-slate-600 font-mono truncate mt-0.5">{url}</p>
        </div>
        <span className="text-xs text-slate-500 whitespace-nowrap shrink-0">
          {includedCount} included
        </span>
      </div>

      <div className="mb-4">
        <div className="flex items-center justify-between mb-1.5">
          <label className="block text-xs font-medium text-slate-400">Pages</label>
          {excluded.length > 0 && (
            <button
              onClick={onIncludeAll}
              className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
            >
              Include all
            </button>
          )}
        </div>
        <div className="max-h-56 overflow-y-auto rounded-lg border border-slate-700 divide-y divide-slate-700/60">
          {pages.map((page) => {
            const isExcluded = excluded.includes(page.url)
            return (
              <label
                key={page.url}
                className="flex items-start gap-3 px-3 py-2 hover:bg-slate-800 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={!isExcluded}
                  onChange={() => onToggle(page.url)}
                  className="mt-0.5 accent-indigo-500"
                />
                <span className="min-w-0">
                  <span
                    className={`block text-sm truncate ${
                      isExcluded ? 'text-slate-600 line-through' : 'text-slate-100'
                    }`}
                  >
                    {page.title || shortPath(page.url)}
                  </span>
                  <span className="block text-xs text-slate-600 font-mono truncate">
                    {shortPath(page.url)}
                  </span>
                </span>
              </label>
            )
          })}
        </div>
      </div>

      <div className="mb-5">
        <label className="block text-xs font-medium text-slate-400 mb-1.5">
          Top terms found{' '}
          <span className="text-slate-600 font-normal">
            (from the pages crawled, before any LLM call)
          </span>
        </label>
        {termsLoading ? (
          <p className="text-xs text-slate-600">Reading terms…</p>
        ) : topTerms.length === 0 ? (
          <p className="text-xs text-slate-600">No terms to preview.</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {topTerms.map((t) => (
              <span
                key={t.term}
                className="px-2 py-0.5 bg-slate-800 border border-slate-600 rounded-full text-xs text-slate-400"
                title={`${t.count} mentions`}
              >
                {t.term}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <button
          onClick={onGenerate}
          disabled={!canGenerate || includedCount === 0}
          className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-colors text-sm"
        >
          Generate Prompt Library
        </button>
        <button
          onClick={onRecrawl}
          className="px-4 py-3 bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-300 text-sm font-medium rounded-xl transition-colors"
        >
          Re-crawl
        </button>
      </div>
      {includedCount === 0 && (
        <p className="mt-2 text-xs text-slate-500">Include at least one page to generate.</p>
      )}
    </div>
  )
}
