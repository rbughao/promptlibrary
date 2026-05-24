import { fetch } from 'undici'
import { parsePage } from './parser'
import type { PageContent } from '../../types'

export interface CrawlOptions {
  url: string
  maxDepth?: number
  maxPages?: number
  onProgress: (progress: { pagesVisited: number; currentUrl: string }) => void
  signal?: AbortSignal
}

export async function crawlSite(options: CrawlOptions): Promise<PageContent[]> {
  const { url, maxDepth = 3, maxPages = 25, onProgress, signal } = options

  let baseUrl: URL
  try {
    baseUrl = new URL(url)
  } catch {
    throw new Error(`Invalid URL: ${url}`)
  }

  const visited = new Set<string>()
  const queue: Array<{ url: string; depth: number }> = [
    { url: baseUrl.href, depth: 0 }
  ]
  const results: PageContent[] = []

  while (queue.length > 0 && results.length < maxPages) {
    if (signal?.aborted) break

    const item = queue.shift()!
    const normalizedUrl = normalizeUrl(item.url)

    if (visited.has(normalizedUrl)) continue
    visited.add(normalizedUrl)

    onProgress({ pagesVisited: results.length, currentUrl: item.url })

    try {
      const response = await fetch(item.url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; PromptLibraryBot/1.0; +research)',
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
        },
        signal: AbortSignal.timeout(12000),
        redirect: 'follow',
      })

      if (!response.ok) continue

      const contentType = response.headers.get('content-type') ?? ''
      if (!contentType.includes('text/html')) continue

      const html = await response.text()
      const pageContent = parsePage(html, item.url)
      results.push(pageContent)

      if (item.depth < maxDepth) {
        for (const link of pageContent.internalLinks) {
          try {
            const linkUrl = new URL(link, baseUrl)
            // Same origin only
            if (linkUrl.hostname !== baseUrl.hostname) continue
            // Skip non-http protocols
            if (!linkUrl.protocol.startsWith('http')) continue
            const normalized = normalizeUrl(linkUrl.href)
            if (!visited.has(normalized)) {
              queue.push({ url: linkUrl.href, depth: item.depth + 1 })
            }
          } catch {
            // Invalid URL — skip
          }
        }
      }
    } catch {
      // Network error or timeout — skip page
    }
  }

  return results
}

function normalizeUrl(url: string): string {
  try {
    const u = new URL(url)
    u.hash = ''
    return u.href.replace(/\/$/, '')
  } catch {
    return url
  }
}
