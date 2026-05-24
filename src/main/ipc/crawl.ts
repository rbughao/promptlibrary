import type { IpcMain, BrowserWindow } from 'electron'
import { crawlSite } from '../crawler'
import type { PageContent } from '../../types'

const activeCrawls = new Map<string, AbortController>()

export function registerCrawlHandlers(
  ipcMain: IpcMain,
  getWindow: () => BrowserWindow | null
): void {
  ipcMain.handle('crawl:start', async (_, url: string) => {
    const controller = new AbortController()
    activeCrawls.set(url, controller)

    try {
      const pages: PageContent[] = await crawlSite({
        url,
        maxDepth: 3,
        maxPages: 25,
        signal: controller.signal,
        onProgress: ({ pagesVisited, currentUrl }) => {
          getWindow()?.webContents.send('crawl:progress', {
            pagesVisited,
            currentUrl,
            status: 'crawling',
          })
        },
      })

      getWindow()?.webContents.send('crawl:progress', {
        pagesVisited: pages.length,
        currentUrl: '',
        status: 'complete',
      })

      return { success: true, pages }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      getWindow()?.webContents.send('crawl:progress', {
        pagesVisited: 0,
        currentUrl: '',
        status: 'error',
        error: message,
      })
      return { success: false, error: message }
    } finally {
      activeCrawls.delete(url)
    }
  })

  ipcMain.handle('crawl:cancel', async (_, url: string) => {
    activeCrawls.get(url)?.abort()
    activeCrawls.delete(url)
    return { success: true }
  })
}
