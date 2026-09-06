import type { IpcMain } from 'electron'
import {
  saveSession, appendPrompts, loadSession, listSessions, deleteSession, updatePromptRecord,
} from '../db'
import type { Cluster } from '../../types'

type NewPrompt = {
  text: string
  cluster: string
  trustWord: string
  persona?: string
  personaLabel?: string
}

export function registerDbHandlers(ipcMain: IpcMain): void {
  ipcMain.handle(
    'db:save',
    (
      _,
      sessionData: { url: string; category: string; pageCount?: number },
      clusters: Cluster[],
      prompts: NewPrompt[]
    ) => {
      try {
        const result = saveSession(sessionData, clusters, prompts)
        return { success: true, ...result }
      } catch (err) {
        return { success: false, error: err instanceof Error ? err.message : String(err) }
      }
    }
  )

  ipcMain.handle('db:appendPrompts', (_, sessionId: string, prompts: NewPrompt[]) => {
    try {
      const result = appendPrompts(sessionId, prompts)
      if (!result.success) return { success: false, error: 'Session not found', added: 0 }
      return { success: true, added: result.added }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err), added: 0 }
    }
  })

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
