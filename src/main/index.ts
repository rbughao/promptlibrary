import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { initDb } from './db'
import { loadSettings, saveSettings, getProviderConfig } from './settings'
import { registerCrawlHandlers } from './ipc/crawl'
import { registerGenerateHandlers } from './ipc/generate'
import { registerDbHandlers } from './ipc/db'
import type { ProviderConfig } from '../types'

let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#0f172a',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
    },
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow!.show()
  })

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

function registerSettingsHandlers(): void {
  ipcMain.handle('settings:getConfig', (): ProviderConfig => {
    return getProviderConfig()
  })

  ipcMain.handle('settings:setConfig', (_, config: ProviderConfig) => {
    try {
      saveSettings(config)
      return { success: true }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) }
    }
  })
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.promptlibrary.builder')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  initDb()
  loadSettings()

  registerCrawlHandlers(ipcMain, () => mainWindow)
  registerGenerateHandlers(ipcMain, () => mainWindow)
  registerDbHandlers(ipcMain)
  registerSettingsHandlers()

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
