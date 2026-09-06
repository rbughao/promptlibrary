import type { IpcMain, BrowserWindow } from 'electron'
import { crawlSite } from '../crawler'
import { clampCrawlOptions } from '../../types'
import type { PageContent, CrawlRequestOptions } from '../../types'

// The UI runs one crawl at a time. Keying this by URL meant an edit to the URL
// field mid-crawl made Cancel unable to find the controller.
let active: AbortController | null = null

export function registerCrawlHandlers(
  ipcMain: IpcMain,
  getWindow: () => BrowserWindow | null
): void {
  ipcMain.handle('crawl:start', async (_, url: string, opts?: CrawlRequestOptions) => {
    active?.abort()
    const controller = new AbortController()
    active = controller

    const { maxPages, maxDepth } = clampCrawlOptions(opts)

    try {
      const pages: PageContent[] = await crawlSite({
        url,
        maxDepth,
        maxPages,
        signal: controller.signal,
        onProgress: ({ pagesVisited, currentUrl }) => {
          getWindow()?.webContents.send('crawl:progress', {
            pagesVisited,
            currentUrl,
            maxPages,
            status: 'crawling',
          })
        },
      })

      getWindow()?.webContents.send('crawl:progress', {
        pagesVisited: pages.length,
        currentUrl: '',
        maxPages,
        status: 'complete',
      })

      if (pages.length === 0) {
        return {
          success: false,
          error:
            'No pages could be read from that URL. Check the address is reachable ' +
            'and serves HTML.',
        }
      }

      return { success: true, pages }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      getWindow()?.webContents.send('crawl:progress', {
        pagesVisited: 0,
        currentUrl: '',
        maxPages,
        status: 'error',
        error: message,
      })
      return { success: false, error: message }
    } finally {
      if (active === controller) active = null
    }
  })

  ipcMain.handle('crawl:cancel', async () => {
    active?.abort()
    active = null
    return { success: true }
  })
}
