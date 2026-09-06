import { fetch } from 'undici'
import { parsePage } from './parser'
import type { PageContent } from '../../types'

/** Simultaneous requests. Enough to hide latency without hammering one host. */
const CONCURRENCY = 5
const REQUEST_TIMEOUT_MS = 12_000
/** Content pages are never this large; anything bigger is a download. */
const MAX_HTML_BYTES = 5_000_000

/** Query parameters that never change what a page says. */
const TRACKING_PARAMS = [
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'utm_id',
  'gclid', 'fbclid', 'msclkid', 'dclid', 'yclid', 'igshid',
  'mc_cid', 'mc_eid', 'ref', 'ref_src', '_ga', '_gl', 'pk_campaign', 'pk_kwd',
]

export interface CrawlOptions {
  url: string
  maxDepth?: number
  maxPages?: number
  onProgress: (progress: { pagesVisited: number; currentUrl: string; maxPages: number }) => void
  signal?: AbortSignal
}

/**
 * Collapse URLs that point at the same content so the page budget is not spent
 * crawling one page several times over. Strips the fragment and tracking
 * parameters, sorts what remains, lowercases the host and drops default ports
 * and meaningless trailing slashes.
 */
function normalizeUrl(raw: string): string {
  try {
    const u = new URL(raw)
    u.hash = ''
    u.hostname = u.hostname.toLowerCase()

    if ((u.protocol === 'http:' && u.port === '80') ||
        (u.protocol === 'https:' && u.port === '443')) {
      u.port = ''
    }

    for (const param of TRACKING_PARAMS) u.searchParams.delete(param)
    u.searchParams.sort()

    // A trailing slash is only meaningful on the root path.
    if (u.pathname !== '/' && u.pathname.endsWith('/')) {
      u.pathname = u.pathname.replace(/\/+$/, '')
    }

    return u.href
  } catch {
    return raw
  }
}

/** Run `worker` over `items` with at most `limit` in flight at once. */
async function runPool<T>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<void>
): Promise<void> {
  let cursor = 0
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      await worker(items[cursor++])
    }
  })
  await Promise.all(runners)
}

async function fetchPage(pageUrl: string, signal?: AbortSignal): Promise<PageContent | null> {
  const timeout = AbortSignal.timeout(REQUEST_TIMEOUT_MS)
  try {
    const response = await fetch(pageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; PromptLibraryBot/1.0; +research)',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
      signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
      redirect: 'follow',
    })

    if (!response.ok) return null
    if (!(response.headers.get('content-type') ?? '').includes('text/html')) return null
    if (Number(response.headers.get('content-length') ?? 0) > MAX_HTML_BYTES) return null

    return parsePage(await response.text(), pageUrl)
  } catch {
    // Network error, timeout or cancellation — skip this page.
    return null
  }
}

export async function crawlSite(options: CrawlOptions): Promise<PageContent[]> {
  const { url, maxDepth = 3, maxPages = 25, onProgress, signal } = options

  let baseUrl: URL
  try {
    baseUrl = new URL(url)
  } catch {
    throw new Error(`Invalid URL: ${url}`)
  }

  const host = baseUrl.hostname.toLowerCase()
  const visited = new Set<string>([normalizeUrl(baseUrl.href)])
  const results: PageContent[] = []
  let level: string[] = [baseUrl.href]

  // One depth level at a time, each level fetched concurrently. This keeps BFS
  // ordering — the shallow pages that matter most are still collected first —
  // while removing the per-request latency that made crawls take minutes.
  for (let depth = 0; depth <= maxDepth && level.length > 0; depth++) {
    if (signal?.aborted || results.length >= maxPages) break

    const nextLevel: string[] = []

    await runPool(level, CONCURRENCY, async (pageUrl) => {
      if (signal?.aborted || results.length >= maxPages) return

      const page = await fetchPage(pageUrl, signal)
      if (!page || results.length >= maxPages) return

      results.push(page)
      onProgress({ pagesVisited: results.length, currentUrl: pageUrl, maxPages })

      if (depth >= maxDepth) return

      for (const link of page.internalLinks) {
        try {
          // Resolved against the page the link was found on, not the site root,
          // so relative hrefs on nested pages resolve correctly.
          const linkUrl = new URL(link, pageUrl)
          if (!linkUrl.protocol.startsWith('http')) continue
          if (linkUrl.hostname.toLowerCase() !== host) continue

          const key = normalizeUrl(linkUrl.href)
          if (visited.has(key)) continue
          visited.add(key)
          nextLevel.push(linkUrl.href)
        } catch {
          // Unparseable href — skip.
        }
      }
    })

    level = nextLevel
  }

  return results.slice(0, maxPages)
}
