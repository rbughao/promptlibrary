import type { IpcMain } from 'electron'
import { saveSession, loadSession, listSessions, deleteSession, updatePromptRecord } from '../db'
import type { Cluster } from '../../types'

export function registerDbHandlers(ipcMain: IpcMain): void {
  ipcMain.handle(
    'db:save',
    (
      _,
      sessionData: { url: string; category: string },
      clusters: Cluster[],
      prompts: Array<{ text: string; cluster: string; trustWord: string; persona?: string }>
    ) => {
      try {
        const result = saveSession(sessionData, clusters, prompts)
        return { success: true, ...result }
      } catch (err) {
        return { success: false, error: err instanceof Error ? err.message : String(err) }
      }
    }
  )

  ipcMain.handle('db:load', (_, sessionId: string) => {
    return loadSession(sessionId)
  })

  ipcMain.handle('db:list', () => {
    return listSessions()
  })

  ipcMain.handle('db:delete', (_, sessionId: string) => {
    try {
      deleteSession(sessionId)
      return { success: true }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) }
    }
  })

  ipcMain.handle(
    'db:updatePrompt',
    (_, promptId: string, changes: { text?: string; tags?: string[]; deleted?: boolean }) => {
      try {
        updatePromptRecord(promptId, changes)
        return { success: true }
      } catch (err) {
        return { success: false, error: err instanceof Error ? err.message : String(err) }
      }
    }
  )
}
